// SQLite (sql.js – WebAssembly) lưu trong một file meow.db ở thư mục dữ liệu của app.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks(
  id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT, duration INTEGER DEFAULT 0, thumb TEXT, added_at INTEGER);
CREATE TABLE IF NOT EXISTS playlists(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT, source TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS playlist_tracks(
  playlist_id INTEGER NOT NULL, track_id TEXT NOT NULL, pos INTEGER NOT NULL,
  PRIMARY KEY(playlist_id, track_id));
CREATE TABLE IF NOT EXISTS likes(track_id TEXT PRIMARY KEY, liked_at INTEGER);
CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, played_at INTEGER);
CREATE INDEX IF NOT EXISTS ix_history_time ON history(played_at DESC);
CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, value TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
`;

const COLORS = ['#8a6ad1', '#e8732c', '#1f9e8f', '#c9862a', '#4f86d9', '#df568a', '#2f9467', '#d1495b'];

class DB {
  constructor(file) { this.file = file; this.db = null; this.timer = null; }

  async open() {
    const wasm = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
    const SQL = await initSqlJs({ wasmBinary: wasm });
    let data = null;
    try { data = fs.readFileSync(this.file); } catch (_) {}
    try { this.db = data ? new SQL.Database(data) : new SQL.Database(); }
    catch (e) { // file hỏng → giữ bản sao, tạo mới
      try { fs.renameSync(this.file, this.file + '.broken-' + Date.now()); } catch (_) {}
      this.db = new SQL.Database();
    }
    this.db.exec(SCHEMA);
    this.trimHistory();
    this.save(true);
  }

  all(sql, params = []) {
    const st = this.db.prepare(sql); st.bind(params);
    const rows = []; while (st.step()) rows.push(st.getAsObject());
    st.free(); return rows;
  }
  get(sql, params = []) { return this.all(sql, params)[0] || null; }
  run(sql, params = []) { this.db.run(sql, params); this.save(); }

  save(now) {
    clearTimeout(this.timer);
    const write = () => {
      try {
        const buf = Buffer.from(this.db.export());
        const tmp = this.file + '.tmp';
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(tmp, buf); fs.renameSync(tmp, this.file);
      } catch (e) { console.error('DB save failed', e); }
    };
    if (now) write(); else this.timer = setTimeout(write, 400);
  }
  flush() { if (this.timer) { clearTimeout(this.timer); this.save(true); } }

  trimHistory() {
    this.db.run(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY played_at DESC LIMIT 500)`);
    this.db.run(`DELETE FROM cache WHERE expires < ?`, [Date.now()]);
  }

  // ---------- settings ----------
  getSettings() {
    const out = {}; for (const r of this.all('SELECT key,value FROM settings')) {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    } return out;
  }
  setSetting(key, value) { this.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', [key, JSON.stringify(value)]); }

  // ---------- cache ----------
  cacheGet(key) { const r = this.get('SELECT value,expires FROM cache WHERE key=?', [key]); if (!r || r.expires < Date.now()) return null; try { return JSON.parse(r.value); } catch { return null; } }
  cacheSet(key, value, ttlMs) { this.run('INSERT OR REPLACE INTO cache(key,value,expires) VALUES(?,?,?)', [key, JSON.stringify(value), Date.now() + ttlMs]); }

  // ---------- tracks ----------
  upsertTrack(t) {
    if (!t || !t.id) return;
    this.db.run(`INSERT INTO tracks(id,title,artist,duration,thumb,added_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist=COALESCE(excluded.artist,tracks.artist),
      duration=CASE WHEN excluded.duration>0 THEN excluded.duration ELSE tracks.duration END, thumb=COALESCE(excluded.thumb,tracks.thumb)`,
      [t.id, t.title || 'Không rõ tên', t.artist || '', t.duration || 0, t.thumb || null, Date.now()]);
  }

  // ---------- playlists ----------
  listPlaylists() {
    return this.all(`SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id=p.id) AS count,
      (SELECT t.thumb FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id WHERE pt.playlist_id=p.id ORDER BY pt.pos LIMIT 1) AS cover
      FROM playlists p ORDER BY p.created_at`);
  }
  createPlaylist(name, source) {
    const n = this.get('SELECT COUNT(*) c FROM playlists').c;
    this.db.run('INSERT INTO playlists(name,color,source,created_at) VALUES(?,?,?,?)', [name, COLORS[n % COLORS.length], source || null, Date.now()]);
    const id = this.get('SELECT last_insert_rowid() id').id; this.save(); return id;
  }
  renamePlaylist(id, name) { this.run('UPDATE playlists SET name=? WHERE id=?', [name, id]); }
  deletePlaylist(id) { this.db.run('DELETE FROM playlist_tracks WHERE playlist_id=?', [id]); this.run('DELETE FROM playlists WHERE id=?', [id]); }
  playlistTracks(id) {
    return this.all(`SELECT t.* FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id WHERE pt.playlist_id=? ORDER BY pt.pos`, [id]);
  }
  addToPlaylist(id, tracks) {
    let pos = (this.get('SELECT MAX(pos) m FROM playlist_tracks WHERE playlist_id=?', [id]).m ?? -1) + 1;
    let added = 0;
    for (const t of tracks) {
      this.upsertTrack(t);
      const exists = this.get('SELECT 1 x FROM playlist_tracks WHERE playlist_id=? AND track_id=?', [id, t.id]);
      if (!exists) { this.db.run('INSERT INTO playlist_tracks(playlist_id,track_id,pos) VALUES(?,?,?)', [id, t.id, pos++]); added++; }
    }
    this.save(); return added;
  }
  removeFromPlaylist(id, trackId) { this.run('DELETE FROM playlist_tracks WHERE playlist_id=? AND track_id=?', [id, trackId]); }
  reorderPlaylist(id, ids) {
    ids.forEach((tid, i) => this.db.run('UPDATE playlist_tracks SET pos=? WHERE playlist_id=? AND track_id=?', [i, id, tid]));
    this.save();
  }

  // ---------- likes / history ----------
  likedIds() { return this.all('SELECT track_id FROM likes').map(r => r.track_id); }
  likedTracks() { return this.all('SELECT t.* FROM likes l JOIN tracks t ON t.id=l.track_id ORDER BY l.liked_at DESC'); }
  toggleLike(t) {
    this.upsertTrack(t);
    if (this.get('SELECT 1 x FROM likes WHERE track_id=?', [t.id])) { this.run('DELETE FROM likes WHERE track_id=?', [t.id]); return false; }
    this.run('INSERT INTO likes(track_id,liked_at) VALUES(?,?)', [t.id, Date.now()]); return true;
  }
  addLikes(tracks) {
    let n = 0; const now = Date.now();
    tracks.forEach((t, i) => { this.upsertTrack(t);
      if (!this.get('SELECT 1 x FROM likes WHERE track_id=?', [t.id])) { this.db.run('INSERT INTO likes(track_id,liked_at) VALUES(?,?)', [t.id, now - i]); n++; } });
    this.save(); return n;
  }
  addHistory(t) {
    this.upsertTrack(t);
    const last = this.get('SELECT track_id FROM history ORDER BY played_at DESC LIMIT 1');
    if (last && last.track_id === t.id) return;
    this.run('INSERT INTO history(track_id,played_at) VALUES(?,?)', [t.id, Date.now()]);
  }
  history(limit = 200) {
    return this.all('SELECT t.*, h.played_at FROM history h JOIN tracks t ON t.id=h.track_id ORDER BY h.played_at DESC LIMIT ?', [limit]);
  }
  recentUnique(limit = 12) {
    return this.all(`SELECT t.*, MAX(h.played_at) last FROM history h JOIN tracks t ON t.id=h.track_id GROUP BY t.id ORDER BY last DESC LIMIT ?`, [limit]);
  }
  clearHistory() { this.run('DELETE FROM history'); }
  clearCache() { this.run('DELETE FROM cache'); }
  stats() { return { tracks: this.get('SELECT COUNT(*) c FROM tracks').c, liked: this.get('SELECT COUNT(*) c FROM likes').c }; }

  // ---------- export / import ----------
  exportJSON() {
    return {
      app: 'Meow Hearing', version: 1, exported_at: new Date().toISOString(),
      playlists: this.listPlaylists().map(p => ({ name: p.name, color: p.color, tracks: this.playlistTracks(p.id) })),
      liked: this.likedTracks(),
    };
  }
  importJSON(data) {
    if (!data || !Array.isArray(data.playlists)) throw new Error('File không đúng định dạng Meow Hearing');
    let n = 0;
    for (const p of data.playlists) { const id = this.createPlaylist(p.name || 'Playlist', 'import'); this.addToPlaylist(id, p.tracks || []); n++; }
    for (const t of data.liked || []) { this.upsertTrack(t); this.db.run('INSERT OR IGNORE INTO likes(track_id,liked_at) VALUES(?,?)', [t.id, Date.now()]); }
    this.save(); return n;
  }
}

module.exports = { DB };

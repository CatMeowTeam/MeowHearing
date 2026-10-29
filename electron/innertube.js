// Gọi API nội bộ của trang youtube.com (giống trình duyệt), dùng phiên đăng nhập trong app nếu có.
// Không cần API key, không bị giới hạn 100 lượt/ngày.
const { net } = require('electron');
const crypto = require('crypto');

const ORIGIN = 'https://www.youtube.com';
const CV = '2.20250925.01.00';

function walk(o, key, out = []) {
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o)) { for (const x of o) walk(x, key, out); return out; }
  for (const k of Object.keys(o)) { if (k === key) out.push(o[k]); else walk(o[k], key, out); }
  return out;
}
const txt = x => !x ? '' : typeof x === 'string' ? x : x.simpleText != null ? x.simpleText : x.content != null ? x.content : Array.isArray(x.runs) ? x.runs.map(r => r.text).join('') : '';
const dur = s => { s = String(s || '').trim(); if (!/^\d+(:\d+)+$/.test(s)) return 0; return s.split(':').reduce((a, b) => a * 60 + (+b), 0); };
const cleanArtist = s => String(s || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function videosFrom(d) {
  const out = []; const seen = new Set();
  const push = t => { if (t.id && !seen.has(t.id) && t.title) { seen.add(t.id); out.push(t); } };
  for (const v of [...walk(d, 'videoRenderer'), ...walk(d, 'compactVideoRenderer')]) {
    if (!v || !v.videoId) continue;
    push({ id: v.videoId, title: txt(v.title), artist: cleanArtist(txt(v.ownerText || v.longBylineText || v.shortBylineText)), duration: dur(txt(v.lengthText)), thumb: thumb(v.videoId) });
  }
  for (const v of walk(d, 'playlistVideoRenderer')) {
    if (!v || !v.videoId || v.isPlayable === false) continue;
    push({ id: v.videoId, title: txt(v.title), artist: cleanArtist(txt(v.shortBylineText)), duration: +v.lengthSeconds || dur(txt(v.lengthText)), thumb: thumb(v.videoId) });
  }
  for (const l of walk(d, 'lockupViewModel')) {
    if (!l || l.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO' || !l.contentId) continue;
    const md = l.metadata && l.metadata.lockupMetadataViewModel;
    const parts = walk(md, 'metadataParts').flat();
    const badge = walk(l.contentImage, 'thumbnailBadgeViewModel').map(b => b.text).find(x => /^\d+(:\d+)+$/.test(x || ''));
    push({ id: l.contentId, title: txt(md && md.title), artist: cleanArtist(parts[0] ? txt(parts[0].text) : ''), duration: dur(badge), thumb: thumb(l.contentId) });
  }
  return out;
}

class InnerTube {
  constructor(sess) { this.sess = sess; }

  async authHeader() {
    const cs = await this.sess.cookies.get({ url: ORIGIN }).catch(() => []);
    const sap = cs.find(c => c.name === 'SAPISID') || cs.find(c => c.name === '__Secure-3PAPISID');
    if (!sap) return null;
    const ts = Math.floor(Date.now() / 1000);
    return `SAPISIDHASH ${ts}_${crypto.createHash('sha1').update(`${ts} ${sap.value} ${ORIGIN}`).digest('hex')}`;
  }
  async loggedIn() { return !!(await this.authHeader()); }

  async call(endpoint, body = {}) {
    const auth = await this.authHeader();
    const payload = JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: CV, hl: 'vi', gl: 'VN' } }, ...body });
    return new Promise((resolve, reject) => {
      let req;
      try { req = net.request({ method: 'POST', url: `${ORIGIN}/youtubei/v1/${endpoint}?prettyPrint=false`, session: this.sess, useSessionCookies: true }); }
      catch (e) { return reject(Object.assign(new Error('Không kết nối được YouTube.'), { code: 'network' })); }
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('X-Origin', ORIGIN);
      req.setHeader('X-Youtube-Client-Name', '1');
      req.setHeader('X-Youtube-Client-Version', CV);
      req.setHeader('X-Goog-AuthUser', '0');
      if (auth) req.setHeader('Authorization', auth);
      req.on('response', res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) return reject(Object.assign(new Error(`YouTube trả lỗi (${res.statusCode}).`), { code: res.statusCode === 401 || res.statusCode === 403 ? 'auth' : 'http' }));
          try { resolve(JSON.parse(text)); } catch { reject(Object.assign(new Error('YouTube trả dữ liệu lạ.'), { code: 'http' })); }
        });
      });
      req.on('error', () => reject(Object.assign(new Error('Không kết nối được YouTube. Kiểm tra mạng.'), { code: 'network' })));
      req.write(payload); req.end();
    });
  }

  async search(q) {
    const d = await this.call('search', { query: q, params: 'EgIQAQ==' }); // chỉ lấy video
    return videosFrom(d);
  }

  async browseAll(browseId, max = 500) {
    let d = await this.call('browse', { browseId });
    const title = txt(d.metadata && d.metadata.playlistMetadataRenderer && d.metadata.playlistMetadataRenderer.title) ||
      txt(walk(d.header, 'title')[0]) || '';
    let tracks = videosFrom(d); const seenTok = new Set();
    for (let i = 0; i < 20 && tracks.length < max; i++) {
      const tok = walk(d, 'continuationCommand').map(c => c && c.token).find(t => t && !seenTok.has(t));
      if (!tok) break; seenTok.add(tok);
      d = await this.call('browse', { continuation: tok });
      const more = videosFrom(d).filter(t => !tracks.some(x => x.id === t.id));
      if (!more.length) break;
      tracks = tracks.concat(more);
    }
    return { title, tracks: tracks.slice(0, max) };
  }

  playlist(listId) { return this.browseAll('VL' + listId); }
  async liked() { if (!(await this.loggedIn())) throw Object.assign(new Error('Cần đăng nhập YouTube.'), { code: 'auth' }); return (await this.browseAll('VLLL')).tracks; }
  async home() { const d = await this.call('browse', { browseId: 'FEwhat_to_watch' }); return videosFrom(d).filter(t => t.duration === 0 || t.duration < 1200).slice(0, 30); }

  async myPlaylists() {
    if (!(await this.loggedIn())) throw Object.assign(new Error('Cần đăng nhập YouTube.'), { code: 'auth' });
    const d = await this.call('browse', { browseId: 'FEplaylist_aggregation' });
    const out = []; const seen = new Set();
    for (const l of walk(d, 'lockupViewModel')) {
      if (!l || l.contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST' || !l.contentId || seen.has(l.contentId)) continue;
      seen.add(l.contentId);
      const md = l.metadata && l.metadata.lockupMetadataViewModel;
      const badge = walk(l.contentImage, 'thumbnailBadgeViewModel').map(b => b.text).find(Boolean) || '';
      const img = walk(l.contentImage, 'sources').flat().find(s => s && s.url);
      out.push({ id: l.contentId, title: txt(md && md.title), count: parseInt(String(badge).replace(/\D/g, ''), 10) || 0, thumb: img ? img.url : null });
    }
    for (const p of [...walk(d, 'gridPlaylistRenderer'), ...walk(d, 'playlistRenderer')]) {
      if (!p || !p.playlistId || seen.has(p.playlistId)) continue; seen.add(p.playlistId);
      out.push({ id: p.playlistId, title: txt(p.title), count: parseInt(txt(p.videoCountShortText || p.videoCountText).replace(/\D/g, ''), 10) || 0, thumb: null });
    }
    return out.filter(p => p.id !== 'LL' && p.id !== 'WL');
  }

  async account() {
    const d = await this.call('account/account_menu', {});
    const h = walk(d, 'activeAccountHeaderRenderer')[0];
    if (!h) return null;
    const ph = h.accountPhoto && h.accountPhoto.thumbnails && h.accountPhoto.thumbnails.slice(-1)[0];
    return { name: txt(h.accountName) || txt(h.channelHandle) || 'YouTube', avatar: ph ? ph.url : null };
  }
}

module.exports = { InnerTube, videosFrom, walk };

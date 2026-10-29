// Gọi API ngoài từ tiến trình chính: YouTube Data API v3, YouTube oEmbed, LRCLIB.
const { net } = require('electron');

const YT = 'https://www.googleapis.com/youtube/v3/';
const DAY = 86400000;

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#039;': "'", '&apos;': "'" };
const decode = s => String(s || '').replace(/&(amp|lt|gt|quot|apos|#0?39);/g, m => ENT[m] || m)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

function isoDur(s) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ''); if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
const cleanArtist = s => decode(s).replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
const thumbOf = (id, sn) => (sn && sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.high || sn.thumbnails.default) || {}).url || (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null);

class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

async function getJSON(url, opts = {}) {
  let res;
  try { res = await net.fetch(url, { headers: { 'User-Agent': 'MeowHearing/0.2 (CatMeow Team)', ...(opts.headers || {}) } }); }
  catch (e) { throw new ApiError('network', 'Không kết nối được mạng. Kiểm tra Internet rồi thử lại.'); }
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  if (!res.ok) {
    if (res.status === 401) { const e = new ApiError('auth', 'Phiên đăng nhập hết hạn, hãy đăng nhập lại.'); e.status = 401; throw e; }
    const reason = data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new ApiError('quota', 'Đã hết lượt gọi YouTube API hôm nay (giới hạn của Google). Ngày mai sẽ dùng lại được.');
    if (reason === 'keyInvalid' || (res.status === 400 && /API key/i.test(text))) throw new ApiError('key', 'API key không hợp lệ. Kiểm tra lại key trong Cài đặt.');
    if (reason === 'accessNotConfigured' || res.status === 403) throw new ApiError('key', 'API key chưa bật "YouTube Data API v3". Vào Google Cloud Console bật API này cho project của key.');
    if (res.status === 404) throw new ApiError('notfound', 'Không tìm thấy nội dung này trên YouTube.');
    throw new ApiError('http', `Lỗi máy chủ (${res.status}). Thử lại sau.`);
  }
  return data;
}

class Api {
  constructor(db, auth, it) { this.db = db; this.auth = auth; this.it = it; }
  async viaIt(fn) {
    try { return await fn(); }
    catch (e) { throw new ApiError(e.code || 'http', e.message || 'Lỗi khi gọi YouTube.'); }
  }
  key() { return (this.db.getSettings().apiKey || '').trim(); }

  // Ưu tiên API key; nếu không có thì dùng tài khoản đã đăng nhập
  async cred(mine) {
    if (!mine) { const k = this.key(); if (k) return { key: k }; }
    if (this.auth && this.auth.loggedIn()) {
      try { const tok = await this.auth.getToken(); if (tok) return { token: tok }; }
      catch (e) { throw new ApiError(e.code === 'network' ? 'network' : 'auth', e.message); }
    }
    if (mine) throw new ApiError('auth', 'Cần đăng nhập tài khoản YouTube.');
    throw new ApiError('nokey', 'Cần đăng nhập YouTube hoặc nhập API key trong Cài đặt để tìm kiếm.');
  }
  async yt(pathq, c) {
    const url = YT + pathq + (c.key ? `&key=${encodeURIComponent(c.key)}` : '');
    try { return await getJSON(url, c.token ? { headers: { Authorization: 'Bearer ' + c.token } } : {}); }
    catch (e) {
      if (c.token && e.status === 401) { const tok = await this.auth.getToken(true); return getJSON(url, { headers: { Authorization: 'Bearer ' + tok } }); }
      throw e;
    }
  }

  async cached(key, ttl, fn) {
    const hit = this.db.cacheGet(key); if (hit) return hit;
    const v = await fn(); this.db.cacheSet(key, v, ttl); return v;
  }

  async videosByIds(ids, c) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const d = await this.yt(`videos?part=snippet,contentDetails,status&id=${ids.slice(i, i + 50).join(',')}`, c);
      for (const v of d.items || []) out.push(mapVideo(v));
    }
    const order = new Map(ids.map((id, i) => [id, i]));
    return out.sort((a, b) => order.get(a.id) - order.get(b.id));
  }

  async search(q) {
    q = String(q || '').trim(); if (!q) return [];
    if (!this.key()) return this.cached('its:' + q.toLowerCase(), DAY, () => this.viaIt(() => this.it.search(q)));
    const c = await this.cred();
    return this.cached('search:' + q.toLowerCase(), 7 * DAY, async () => {
      const d = await this.yt(`search?part=snippet&type=video&maxResults=25&regionCode=VN&q=${encodeURIComponent(q)}`, c);
      const ids = (d.items || []).map(it => it.id && it.id.videoId).filter(Boolean);
      return ids.length ? (await this.videosByIds(ids, c)) : [];
    });
  }

  async trending() {
    if (!this.key()) return this.cached('ithome', DAY / 24, () => this.viaIt(() => this.it.home())).catch(() => []);
    let c; try { c = await this.cred(); } catch { return []; }
    return this.cached('trending:VN', DAY / 4, async () => {
      const d = await this.yt('videos?part=snippet,contentDetails,status&chart=mostPopular&regionCode=VN&videoCategoryId=10&maxResults=30', c);
      return (d.items || []).map(mapVideo);
    });
  }

  async playlist(listId) {
    if (!this.key()) return this.cached('itpl:' + listId, DAY, () => this.viaIt(() => this.it.playlist(listId)));
    const c = await this.cred();
    return this.cached('pl:' + listId, DAY, () => this.readPlaylist(listId, c));
  }
  async readPlaylist(listId, c) {
    const meta = await this.yt(`playlists?part=snippet&id=${encodeURIComponent(listId)}`, c);
    if (!meta.items || !meta.items.length) throw new ApiError('notfound', 'Không đọc được playlist. Playlist phải ở chế độ Công khai hoặc Không công khai.');
    const title = decode(meta.items[0].snippet.title);
    const ids = []; let page = '';
    do {
      const d = await this.yt(`playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(listId)}${page ? '&pageToken=' + page : ''}`, c);
      ids.push(...(d.items || []).map(i => i.contentDetails.videoId));
      page = d.nextPageToken || '';
    } while (page && ids.length < 500);
    const tracks = (await this.videosByIds([...new Set(ids)], c));
    return { title, tracks };
  }

  async testKey(k) {
    const key = String(k || '').trim(); if (!key) throw new ApiError('nokey', 'Chưa nhập API key.');
    await this.yt('videos?part=id&id=jNQXAC9IVRw', { key }); // tốn 1 đơn vị
    return true;
  }

  async video(id) {
    let c = null; try { c = await this.cred(); } catch {}
    if (c) { try { const [t] = await this.videosByIds([id], c); if (t) return t; } catch (e) { if (!['key', 'quota', 'auth'].includes(e.code)) throw e; } }
    // không có key: dùng oEmbed (miễn phí, không tốn lượt)
    const d = await getJSON(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    return { id, title: decode(d.title), artist: cleanArtist(d.author_name), duration: 0, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
  }

  // ----- dữ liệu của tài khoản đã đăng nhập -----
  async me() {
    const p = await this.viaIt(() => this.it.account());
    this.db.setSetting('profile', p); return p;
  }
  myPlaylists() { return this.viaIt(() => this.it.myPlaylists()); }
  myPlaylist(listId) { return this.viaIt(() => this.it.playlist(listId)); }
  myLiked() { return this.viaIt(() => this.it.liked()); }

  async lyrics({ title, artist, duration }) {
    const { track, art, alt, unsure } = guessSong(title, artist);
    const ck = 'lrc3:' + (track + '|' + art).toLowerCase();
    const hit = this.db.cacheGet(ck); if (hit) return hit.v;
    const names = [norm(track), ...(unsure && art ? [norm(art)] : [])].filter(Boolean);
    const tries = [
      `track_name=${encodeURIComponent(track)}${art ? '&artist_name=' + encodeURIComponent(art) : ''}`,
      `q=${encodeURIComponent((art + ' ' + track).trim())}`,
      `track_name=${encodeURIComponent(track)}`,
      ...(unsure && art ? [`track_name=${encodeURIComponent(art)}&artist_name=${encodeURIComponent(track)}`] : []),
      ...(alt ? [`q=${encodeURIComponent(alt)}`] : []),
    ];
    let best = null, bestScore = Infinity;
    try {
      for (const qs of tries) {
        const list = await getJSON('https://lrclib.net/api/search?' + qs);
        for (const x of Array.isArray(list) ? list : []) {
          if (!x.syncedLyrics && !x.plainLyrics) continue;
          const nx = norm(x.trackName);
          const nameOk = nx && names.some(nt => nx === nt || (nt.length > 2 && nx.includes(nt)) || (nx.length > 2 && nt.includes(nx)));
          if (!nameOk) continue;
          const na = norm(x.artistName); const artOk = [art, track].some(v => v && na.includes(norm(v).split(' ')[0]));
          // video MV thường dài hơn bản audio (có intro/outro) nên không loại theo thời lượng, chỉ dùng để xếp hạng
          const sc = (x.syncedLyrics ? 0 : 500) + (artOk ? 0 : 60) + (duration && x.duration ? Math.abs(x.duration - duration) : 30);
          if (sc < bestScore) { bestScore = sc; best = { synced: x.syncedLyrics || null, plain: x.plainLyrics || null, source: 'LRCLIB', name: x.trackName, artist: x.artistName, lrcDuration: x.duration || 0 }; }
        }
        if (best && best.synced && bestScore < 40) break;
      }
    } catch (e) { if (e.code === 'network') throw e; }
    this.db.cacheSet(ck, { v: best }, best ? 30 * DAY : DAY / 4);
    return best;
  }
}

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const mapVideo = v => ({ id: v.id, title: decode(v.snippet.title), artist: cleanArtist(v.snippet.channelTitle), duration: isoDur(v.contentDetails && v.contentDetails.duration), thumb: thumbOf(v.id, v.snippet), embeddable: v.status ? v.status.embeddable !== false : true });

// "Sơn Tùng M-TP | CHÚNG TA CỦA TƯƠNG LAI | Official MV" → bài + ca sĩ
function guessSong(title, artist) {
  const raw = String(title || '');
  let t = raw
    .replace(/[\(\[【「][^\)\]】」]*[\)\]】」]/g, ' ')                      // bỏ mọi thứ trong ngoặc: (Official MV), [Lyrics], (feat. X)
    .replace(/\b(official\s+(music\s+)?video|official\s+mv|official\s+audio|official\s+lyrics?(\s+video)?|lyrics?\s+video|music\s+video|m\/v|mv|visualizer|performance|live\s+(at|version|session)\b.*)$/gi, ' ')
    .replace(/#\S+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  let a = String(artist || '').replace(/\s*(official|channel|music|entertainment)\b/gi, '').trim();
  const junk = /^(official|lyrics?|mv|m\/v|audio|video|music video|official (music )?video|vietsub|karaoke|4k|hd|remix|cover|live)$/i;
  const parts = t.split(/\s+[-–—|~•]\s+|\s*[|｜]\s*|\s+-\s*|\s*-\s+/).map(x => x.trim()).filter(x => x && !junk.test(x));
  if (parts.length >= 2) {
    const na = norm(a);
    let ai = parts.findIndex(p => na && (norm(p).includes(na) || na.includes(norm(p))));
    if (ai < 0) { ai = 0; var unsure = true; }
    a = parts[ai]; t = parts[ai === 0 ? 1 : 0];
  } else if (parts.length === 1) t = parts[0];
  t = t.replace(/\s*(ft\.?|feat\.?|featuring|x)\s.*$/i, m => /^\s*x\s/i.test(m) ? m : '').replace(/\s*(ft\.?|feat\.?|featuring)\s.*$/i, '').trim();
  a = a.replace(/\s*(ft\.?|feat\.?|featuring)\s.*$/i, '').replace(/\s+x\s.*$/i, '').trim();
  return { track: t, art: a, unsure: !!unsure, alt: raw.replace(/[\(\[][^\)\]]*[\)\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) };
}

module.exports = { Api, ApiError, guessSong };

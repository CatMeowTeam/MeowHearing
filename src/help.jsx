import React from 'react';
import { useUI, I } from './ctx';
import { Signature } from './views';

const VI = {
  title: 'Hướng dẫn sử dụng',
  sub: 'Nghe nhạc YouTube như Spotify, ngay trên Windows. Đọc 2 phút là dùng được hết.',
  start: { cap: 'Bắt đầu', h: 'Nghe bài đầu tiên trong 30 giây', steps: [
    ['Tìm bài', 'Gõ tên bài hoặc ca sĩ vào ô tìm kiếm trên cùng (Ctrl+K) rồi Enter. Không cần tài khoản hay API key.'],
    ['Phát', 'Nhấp đúp vào một bài, hoặc bấm nút ▶ khi rê chuột vào bài. Cả danh sách kết quả sẽ thành hàng chờ.'],
    ['Dán link', 'Có link YouTube? Dán thẳng vào ô tìm kiếm: link video thì phát ngay, link playlist thì bấm “Nhập cả playlist”.'],
  ] },
  lib: { cap: 'Thư viện', h: 'Playlist, bài đã thích, lịch sử', steps: [
    ['Thả tim', 'Bấm ♡ ở thanh phát hoặc ở từng bài. Bài sẽ vào mục “Bài đã thích”.'],
    ['Tạo playlist', 'Bấm “＋ Tạo hoặc nhập playlist” ở thanh bên, hoặc bấm ＋ trên một bài để thêm vào playlist có sẵn.'],
    ['Sắp xếp', 'Trong playlist, kéo thả bài (giữ biểu tượng ⋮⋮) để đổi thứ tự. Chuột phải vào bài để xem thêm lựa chọn.'],
    ['Nghe tiếp', 'Trang chủ luôn có các bài nghe gần đây. Tắt app rồi mở lại vẫn nhớ đang nghe tới đâu.'],
  ] },
  account: { cap: 'Tài khoản', h: 'Đăng nhập YouTube (không bắt buộc)', text: 'Bấm “Đăng nhập YouTube” ở góc dưới thanh bên. App mở Chrome / Edge / Cốc Cốc (cửa sổ riêng, không đụng tới trình duyệt bạn đang dùng); đăng nhập Google ở đó cho tới khi vào trang YouTube, rồi bấm “Xong” trong app (hoặc đóng cửa sổ đó). App tự nhận tài khoản. Sau khi đăng nhập: vào Thư viện → “Từ YouTube của bạn” để lấy video đã thích và playlist; tài khoản Premium sẽ không có quảng cáo; xem được video giới hạn độ tuổi.' },
  play: { cap: 'Phát nhạc', h: 'Điều khiển và tiện ích', items: [
    ['Lời bài hát', 'Ô “Đang phát” bên phải có tab Lời bài hát, chạy theo nhạc. Bấm vào một dòng để tua tới đó. Nút ⤢ mở chế độ toàn màn hình.'],
    ['Hàng chờ', 'Tab Hàng chờ cho xem bài tiếp theo, bấm để nhảy tới, ✕ để bỏ. Trên bài bất kỳ có nút “Thêm vào hàng chờ”.'],
    ['Mini player', 'Nút ▣ ở góc phải thanh phát: cửa sổ nhỏ luôn nổi trên cùng, tiện khi làm việc hoặc chơi game.'],
    ['Chạy dưới khay', 'Bấm ✕ cửa sổ thì nhạc vẫn chạy, biểu tượng mèo nằm dưới khay hệ thống. Chuột phải biểu tượng để điều khiển hoặc thoát.'],
    ['Hẹn giờ tắt nhạc', 'Nút ⏻ trên cùng → chọn 15–90 phút. Đồng hồ đếm ngược hiện cạnh nút.'],
    ['Chặn quảng cáo', 'Cài đặt → Phát nhạc → Chặn quảng cáo. Mặc định tắt; có thể không chặn được hết.'],
  ] },
  keys: { cap: 'Phím tắt', h: 'Dùng nhanh bằng bàn phím', rows: [
    ['Ctrl + Alt + Space', 'Bật / ẩn app (ở bất kỳ đâu, đổi được trong Cài đặt)'], ['Phím Play/Next/Prev trên bàn phím', 'Điều khiển nhạc kể cả khi app ẩn'],
    ['Space', 'Phát / tạm dừng'], ['Ctrl + K', 'Tìm kiếm'], ['← / →', 'Tua lùi / tới 5 giây'], ['Ctrl + ← / →', 'Bài trước / bài sau'],
    ['↑ / ↓', 'Tăng / giảm âm lượng'], ['L', 'Thả tim bài đang phát'], ['Alt + ← / →', 'Quay lại / tiến tới trang'], ['Esc', 'Thoát chế độ toàn màn hình'],
  ] },
  faq: { cap: 'Hỏi đáp', h: 'Gặp vấn đề?', items: [
    ['Bài báo “không phát được”, tự chuyển bài', 'Video đó đã bị xoá, để riêng tư hoặc chặn theo vùng. Video giới hạn độ tuổi cần đăng nhập YouTube.'],
    ['Đăng nhập báo “trình duyệt không an toàn”', 'Bản mới đăng nhập qua Chrome/Edge thật nên không còn bị chặn. Nếu máy không có Chrome/Edge/Cốc Cốc thì cài Chrome rồi thử lại.'],
    ['Không thấy lời bài hát', 'Lời lấy từ kho LRCLIB nên một số bài Việt chưa có. Bài có tên dạng “Ca sĩ - Tên bài” dễ tìm thấy hơn.'],
    ['Windows cảnh báo khi cài', 'App chưa có chữ ký số. Bấm “More info → Run anyway”.'],
    ['Dữ liệu của tôi nằm ở đâu?', 'Trong file meow.db ở thư mục dữ liệu của app (Cài đặt → Mở thư mục dữ liệu). Có thể Xuất thư viện ra JSON để sao lưu.'],
    ['Máy hơi tốn RAM', 'Trình phát chạy trang YouTube thật nên cần khoảng vài trăm MB. Đóng mini player và để app dưới khay sẽ nhẹ hơn.'],
  ] },
};

const EN = {
  title: 'User guide', sub: 'Listen to YouTube like Spotify, right on Windows. Two minutes to learn it all.',
  start: { cap: 'Get started', h: 'Your first song in 30 seconds', steps: [
    ['Search', 'Type a song or artist in the top search box (Ctrl+K) and press Enter. No account or API key needed.'],
    ['Play', 'Double-click a song or press ▶ when hovering. The whole result list becomes your queue.'],
    ['Paste a link', 'Paste any YouTube link into search: a video plays right away; for a playlist press “Import playlist”.'],
  ] },
  lib: { cap: 'Library', h: 'Playlists, likes, history', steps: [
    ['Like', 'Press ♡ on the player bar or any song to add it to Liked songs.'],
    ['Make playlists', 'Use “＋ New or import playlist” in the sidebar, or ＋ on a song to add it to a playlist.'],
    ['Reorder', 'Inside a playlist drag songs by the ⋮⋮ handle. Right-click a song for more options.'],
    ['Pick up again', 'Home shows what you played recently, and the app remembers where you stopped.'],
  ] },
  account: { cap: 'Account', h: 'Sign in to YouTube (optional)', text: 'Press “Sign in with YouTube” at the bottom of the sidebar. The app opens Chrome / Edge in a separate window; sign in to Google there and the app picks it up automatically. Then open Library → “From your YouTube” to bring in liked videos and playlists; Premium accounts get no ads; age-restricted videos play.' },
  play: { cap: 'Playback', h: 'Controls and extras', items: [
    ['Lyrics', 'The Now playing panel has synced lyrics. Click a line to jump there; ⤢ opens full screen.'],
    ['Queue', 'The Queue tab shows what is next. Click to jump, ✕ to remove.'],
    ['Mini player', 'The ▣ button opens a small always-on-top window.'],
    ['Tray', 'Closing the window keeps the music playing in the system tray.'],
    ['Sleep timer', 'The ⏻ button at the top: stop music after 15–90 minutes.'],
    ['Ad block', 'Settings → Playback → Block ads. Off by default.'],
  ] },
  keys: { cap: 'Shortcuts', h: 'Keyboard', rows: [
    ['Ctrl + Alt + Space', 'Show / hide the app anywhere'], ['Media keys', 'Control music even when hidden'], ['Space', 'Play / pause'], ['Ctrl + K', 'Search'],
    ['← / →', 'Seek 5 s'], ['Ctrl + ← / →', 'Previous / next song'], ['↑ / ↓', 'Volume'], ['L', 'Like current song'], ['Alt + ← / →', 'Back / forward'], ['Esc', 'Leave full screen'],
  ] },
  faq: { cap: 'FAQ', h: 'Having trouble?', items: [
    ['A song says “can’t be played” and skips', 'The video was removed, made private or is region-blocked. Age-restricted videos need a YouTube sign-in.'],
    ['Sign-in says “browser may not be secure”', 'Google sometimes blocks in-app sign-in. Try again later; the app works fine signed out.'],
    ['No lyrics', 'Lyrics come from LRCLIB, which lacks some songs.'],
    ['Windows warns when installing', 'The app is not code-signed yet. Click “More info → Run anyway”.'],
    ['Where is my data?', 'In meow.db in the app data folder (Settings → Open data folder). Export your library to JSON for backups.'],
    ['RAM usage', 'The player runs the real YouTube page, so it needs a few hundred MB.'],
  ] },
};

export function Help({ go }) {
  const { lang, t } = useUI();
  const C = lang === 'en' ? EN : VI;
  return (
    <div className="view" style={{ maxWidth: 980 }}>
      <div className="vh"><div><h1>{C.title}</h1><small>{C.sub}</small></div></div>
      <div className="guide">
        <section className="g-sec"><p className="g-cap">{C.start.cap}</p><h2>{C.start.h}</h2>
          <ol className="g-steps">{C.start.steps.map(([b, p], i) => <li key={i}><span className="g-n">{i + 1}</span><b>{b}</b><p>{p}</p></li>)}</ol></section>
        <section className="g-sec"><p className="g-cap">{C.lib.cap}</p><h2>{C.lib.h}</h2>
          <ol className="g-steps">{C.lib.steps.map(([b, p], i) => <li key={i}><span className="g-n">{i + 1}</span><b>{b}</b><p>{p}</p></li>)}</ol></section>
        <section className="g-sec"><p className="g-cap">{C.account.cap}</p><h2>{C.account.h}</h2><p>{C.account.text}</p>
          <div className="row"><button className="btn" onClick={() => go({ view: 'settings' })}>{I.gear}{t('settings')}</button></div></section>
        <section className="g-sec"><p className="g-cap">{C.play.cap}</p><h2>{C.play.h}</h2>
          <ul className="g-steps">{C.play.items.map(([b, p], i) => <li key={i}><b>{b}</b><p>{p}</p></li>)}</ul></section>
        <section className="g-sec"><p className="g-cap">{C.keys.cap}</p><h2>{C.keys.h}</h2>
          <div className="g-keys">{C.keys.rows.map(([k, d], i) => <div className="g-key" key={i}><kbd>{k}</kbd><span>{d}</span></div>)}</div></section>
        <section className="g-sec"><p className="g-cap">{C.faq.cap}</p><h2>{C.faq.h}</h2>
          <div className="g-faq">{C.faq.items.map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
        <div className="g-foot"><Signature /></div>
      </div>
    </div>
  );
}

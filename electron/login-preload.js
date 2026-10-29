// Chạy trước trang đăng nhập Google: cho trang thấy một trình duyệt bình thường (khớp với User-Agent Firefox).
try { Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined, configurable: true }); } catch (_) {}
try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}
try { delete window.chrome; } catch (_) {}

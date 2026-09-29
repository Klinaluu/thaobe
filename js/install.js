// ============================================================
// Gợi ý cài game vào màn hình chính (chỉ hiện trên điện thoại / máy tính bảng).
//
// Ba tình huống:
//   1. Mở từ Messenger / Zalo / Instagram… → trình duyệt trong app không thêm được
//      vào màn hình chính, phải mở bằng Safari / Chrome trước.
//   2. iPhone / iPad + Safari → iOS không có API cài đặt, chỉ hướng dẫn thao tác.
//   3. Android + Chrome → dùng sự kiện beforeinstallprompt để bật hộp thoại cài thật.
// Máy tính không hiện gì (đã có nút toàn màn hình).
// ============================================================
import { getLang } from "./i18n.js";

// path riêng cho từng site: GitHub Pages phục vụ mọi bản (demo lẫn từng khách)
// dưới cùng một origin "klinaluu.github.io", nên nếu chỉ khoá theo tên biến thì
// hễ đã xem trên 1 bản là mọi bản khác (khác /<slug>/) cũng bị coi là "đã xem".
const SEEN_KEY = "mfu-install-hint:" + location.pathname;
const SEEN_DAYS = 7;

// Trình duyệt nhúng trong các app nhắn tin / mạng xã hội
const IN_APP = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|Line\/|MicroMessenger|TikTok|Twitter/i;
// Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Opera (OPiOS) trên iOS
const OTHER_IOS_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS/i;

export function detectPlatform(ua = navigator.userAgent, touch = matchMedia("(hover: none)").matches) {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (!(ios || android || touch)) return "desktop";
  // Trình duyệt nhúng trong app nhắn tin: không thêm được vào màn hình chính
  if (IN_APP.test(ua)) return ios ? "in-app-ios" : "in-app";
  // iPhone/iPad: chỉ Safari mới có "Thêm vào MH chính"; Chrome/Firefox/Edge trên iOS thì không
  if (ios) return OTHER_IOS_BROWSER.test(ua) ? "ios-other" : "ios";
  return "android";
}

export function isInstalled() {
  return !!(window.navigator.standalone || matchMedia("(display-mode: standalone)").matches);
}

function seenRecently() {
  try {
    const ts = Number(localStorage.getItem(SEEN_KEY) || 0);
    return Date.now() - ts < SEEN_DAYS * 864e5;
  } catch (e) {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch (e) {
    /* chế độ riêng tư: bỏ qua */
  }
}

// Bản tiếng Anh ghi kèm tên nút tiếng Việt trong ngoặc: người dùng máy tiếng Anh nhưng
// menu hệ thống có thể vẫn là tiếng Việt. Bản tiếng Việt thì ghi thẳng tên nút tiếng Việt.
// Safari trên iPhone đời mới để nút Chia sẻ trong menu ≡ / ••• cạnh thanh địa chỉ.
const IOS_SHARE = "Tap Share □↑ (Chia sẻ) — on newer iPhones it's inside the ≡ or ••• menu next to the address bar";
const IOS_ADD = "Choose “Add to Home Screen” (Thêm vào MH chính) — scroll down if you don't see it";
const OPEN_ICON = "Open it from the new icon — full screen, no address bar";

const COPY = {
  "in-app": {
    title: "OPEN_IN_BROWSER",
    heading: "Open in your browser",
    steps: [
      "Tap the ⋮ or ••• menu in the top corner",
      "Choose “Open in browser” (Mở bằng trình duyệt)",
      "Then add it to your Home Screen to play full screen",
    ],
    action: "Copy link",
  },
  "in-app-ios": {
    title: "OPEN_IN_SAFARI",
    heading: "Open it in Safari",
    steps: [
      "Tap the ••• menu in the corner and choose “Open in Safari” (Mở bằng Safari)",
      "No such option? Tap “Copy link” below, open the Safari app and paste it",
      "In Safari: tap Share (Chia sẻ), then “Add to Home Screen” (Thêm vào MH chính)",
    ],
    note: "On iPhone only Safari can add a site to the Home Screen.",
    action: "Copy link",
  },
  ios: {
    title: "ADD_TO_HOME",
    heading: "Play it like an app",
    steps: [IOS_SHARE, IOS_ADD, OPEN_ICON],
    action: "Got it",
  },
  "ios-other": {
    title: "OPEN_IN_SAFARI",
    heading: "Open it in Safari",
    steps: [
      "Reopen this link in the Safari app — or tap “Copy link” below and paste it into Safari",
      "In Safari: " + IOS_SHARE.charAt(0).toLowerCase() + IOS_SHARE.slice(1),
      IOS_ADD,
    ],
    note: "On iPhone only Safari can add a site to the Home Screen.",
    action: "Copy link",
  },
  android: {
    title: "ADD_TO_HOME",
    heading: "Play it like an app",
    steps: [
      "Open the browser menu — ⋮ at the top (Chrome) or ≡ at the bottom (Samsung Internet)",
      "Choose “Install app” or “Add to Home screen” (Thêm vào màn hình chính)",
      OPEN_ICON,
    ],
    // chỉ hiện "Install app" khi trình duyệt đã cho phép cài trực tiếp (beforeinstallprompt)
    action: "Got it",
    installAction: "Install app",
  },
};

const VI_SHARE = "Bấm nút Chia sẻ □↑ — iPhone đời mới để nút này trong menu ≡ hoặc ••• cạnh thanh địa chỉ";
const VI_ADD = "Chọn “Thêm vào MH chính” — không thấy thì kéo xuống dưới";
const VI_OPEN = "Mở game từ biểu tượng mới — toàn màn hình, không còn thanh địa chỉ";
const VI_SAFARI_ONLY = "Trên iPhone chỉ Safari mới thêm được trang web vào màn hình chính.";

const COPY_VI = {
  "in-app": {
    title: "OPEN_IN_BROWSER",
    heading: "Mở bằng trình duyệt",
    steps: [
      "Bấm menu ⋮ hoặc ••• ở góc trên",
      "Chọn “Mở bằng trình duyệt”",
      "Sau đó thêm vào màn hình chính để chơi toàn màn hình",
    ],
    action: "Sao chép link",
  },
  "in-app-ios": {
    title: "OPEN_IN_SAFARI",
    heading: "Mở bằng Safari",
    steps: [
      "Bấm menu ••• ở góc và chọn “Mở bằng Safari”",
      "Không có mục đó? Bấm “Sao chép link” bên dưới, mở app Safari rồi dán vào",
      "Trong Safari: bấm Chia sẻ, rồi chọn “Thêm vào MH chính”",
    ],
    note: VI_SAFARI_ONLY,
    action: "Sao chép link",
  },
  ios: {
    title: "ADD_TO_HOME",
    heading: "Chơi như một app",
    steps: [VI_SHARE, VI_ADD, VI_OPEN],
    action: "Đã hiểu",
  },
  "ios-other": {
    title: "OPEN_IN_SAFARI",
    heading: "Mở bằng Safari",
    steps: [
      "Mở lại link này bằng app Safari — hoặc bấm “Sao chép link” bên dưới rồi dán vào Safari",
      "Trong Safari: " + VI_SHARE.charAt(0).toLowerCase() + VI_SHARE.slice(1),
      VI_ADD,
    ],
    note: VI_SAFARI_ONLY,
    action: "Sao chép link",
  },
  android: {
    title: "ADD_TO_HOME",
    heading: "Chơi như một app",
    steps: [
      "Mở menu trình duyệt — ⋮ ở trên (Chrome) hoặc ≡ ở dưới (Samsung Internet)",
      "Chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”",
      VI_OPEN,
    ],
    action: "Đã hiểu",
    installAction: "Cài app",
  },
};

let deferredPrompt = null;

function buildModal(platform, text) {
  const copy = { ...(getLang() === "vi" ? COPY_VI : COPY)[platform], ...(text || {})[platform] };
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "modal-install";
  modal.innerHTML = `
    <div class="win small">
      <div class="win-bar"><span>${copy.title}</span><button class="win-x btn" data-close>✕</button></div>
      <div class="win-body">
        <div class="install-heading">${copy.heading}</div>
        <ol class="install-steps">${copy.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        ${copy.note ? `<p class="install-note">${copy.note}</p>` : ""}
        <button class="pixel-btn primary" data-action data-install-label="${copy.installAction || ""}">${platform === "android" && deferredPrompt && copy.installAction ? copy.installAction : copy.action}</button>
        <input class="install-link hidden" data-link readonly>
      </div>
    </div>`;
  // gán qua thuộc tính, không ghép vào HTML: link có dấu " sẽ không chèn được mã vào trang
  modal.querySelector("[data-link]").value = location.href;
  return modal;
}

/**
 * Hiện gợi ý cài đặt nếu hợp lý.
 * @param {{text?: object, force?: boolean}} opts  text: chuỗi ghi đè theo từng nền tảng
 */
export function maybeShowInstallHint(opts = {}) {
  const platform = detectPlatform();
  if (platform === "desktop" || isInstalled()) return false;
  if (!opts.force && seenRecently()) return false;

  const modal = buildModal(platform, opts.text);
  const copyText = opts.text && opts.text.common;
  document.body.appendChild(modal);
  remember();

  const close = () => modal.remove();
  modal.querySelector("[data-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  const copiedLabel = (copyText && copyText.copied) || (getLang() === "vi" ? "Đã sao chép link ✓" : "Link copied ✓");
  const action = modal.querySelector("[data-action]");
  action.addEventListener("click", async () => {
    if (platform === "android" && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt = null;
      close();
      return;
    }
    if (platform.startsWith("in-app") || platform === "ios-other") {
      try {
        await navigator.clipboard.writeText(location.href);
        action.textContent = copiedLabel;
        return;
      } catch (e) {
        // không copy được (thường do trình duyệt trong app): hiện ô link để tự chọn
        const box = modal.querySelector("[data-link]");
        box.classList.remove("hidden");
        box.focus();
        box.setSelectionRange(0, box.value.length);
        return;
      }
    }
    close();
  });
  return true;
}

/** Gọi một lần lúc khởi động: bắt sự kiện cài đặt của Android và hẹn giờ hiện gợi ý. */
export function initInstallHint(opts = {}) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // tự hiện hộp thoại của mình thay vì thanh mặc định
    deferredPrompt = e;
    // gợi ý đã mở trước khi trình duyệt cho phép cài → đổi nút thành "Install app"
    const btn = document.querySelector("#modal-install [data-action]");
    if (btn && btn.dataset.installLabel) btn.textContent = btn.dataset.installLabel;
  });
  setTimeout(() => maybeShowInstallHint(opts), opts.delay ?? 0);
}

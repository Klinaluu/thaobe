// ============================================================
// Ngôn ngữ giao diện: mặc định tiếng Anh. Người chơi bấm nút VIE ở màn hình mở đầu để đổi
// sang tiếng Việt (bấm ENG để đổi lại); lựa chọn được nhớ cho lần mở sau. Không tự đổi theo
// ngôn ngữ máy. Link có ?lang=vi hoặc ?lang=en thì mở thẳng ngôn ngữ đó (thử nghiệm).
//
// Chỉ lo phần chữ CỐ ĐỊNH của game (nút, gợi ý, hộp thoại). Chữ do khách viết trong
// config.js dùng nguyên văn; muốn hai thứ tiếng thì viết { en: "...", vi: "..." } (xem pick()).
// ============================================================

// nhớ theo từng bản (path): demo và các bản khách chung một tên miền klinaluu.github.io
const STORE_KEY = "mfu-lang:" + location.pathname;

function initialLang() {
  try {
    const forced = new URLSearchParams(location.search).get("lang");
    if (forced === "vi" || forced === "en") return forced;
  } catch (e) {
    /* không đọc được URL */
  }
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch (e) {
    /* chế độ riêng tư */
  }
  return "en";
}

let lang = initialLang();

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = next === "vi" ? "vi" : "en";
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch (e) {
    /* chế độ riêng tư: chỉ đổi cho lần này */
  }
}

const STRINGS = {
  en: {
    // ---- mặc định cho các mục TEXT trong config.js ----
    manLine: "Found you.",
    meetText: "I'm on my solo mission but the stars guide me to you",
    systemMessage: "The next level is not unlocked yet.\nWould you like to continue the journey?",
    envelopeLabel: "Highly confidential document",
    letterTitle: "Your love letter",
    letter: "Write your love letter",
    videoMissing: "Wait for your video 🎬",
    photoPlaceholder: "(insert pictures here)",
    rotateTitle: "Please rotate to landscape",
    rotateText: "This journey is made for a sideways screen.",
    rotateTip: "⟳ Hold your device sideways to play",

    // ---- màn hình mở đầu ----
    loading: "Loading…",
    start: "▶ Start the journey",
    tipKeyboard: "◀ ▶ move · ▲ jump · ▲▲ double jump · F full screen",
    tipGamepad: "🎮 gamepad: stick / D-pad to move · A to jump",
    tipInstall: "+ Add to Home Screen — play full screen",

    // ---- lúc chơi ----
    controlsKeyboard: "◀ ▶ move · ▲ jump · ▲▲ double jump · tap to open",
    controlsTouch: "hold ◀ ▶ to move · tap ▲ to jump · tap ▲ twice to jump higher",
    hintGear: "Grab your key and helmet, then hop on the bike",
    hintGearDone: "All set — hop on the bike!",
    hintSolo: "Collect all 5 gifts — press ▲ twice to jump higher",
    hintAllGifts: "All 5 gifts! Now go find her ♥",
    hintBoss: "A cloud of doubt! Jump over it 3 times",
    hintDodge: "Nice! {n}/3",
    hintBossDone: "Doubt cleared — the road is open ✦",
    hintRain: "It's raining! Jump the walls and grab the umbrella",
    hintRainDone: "Rain's over — let's keep going ♥",
    hintLastStop: "One more stop — keep riding ♥",
    together: "Together ♥",
    level2: "Level 2 · unlocked ♥",
    missionStats: "MISSION COMPLETE<br>score <b>{score}</b> · time <b>{time}</b> · gifts <b>{gifts}</b>",

    // ---- chữ vẽ trên canvas (engine) ----
    popCollectFirst: "Collect all 5 gifts first!",
    popForgot: "Forgot your {x}!",
    popRide: "Let's ride!",
    popDoubtCleared: "Doubt cleared ✦",
    popRainOver: "☂ Rain's over",
    gearKey: "Key",
    gearHelmet: "Helmet",
    itemUmbrella: "Umbrella",
    itemEgg: "Golden egg",
    promptOpen: "Open",
    bikeMine: "MY BIKE",
    bikeGo: "LET'S GO",
    bossDoubt: "DOUBT",

    // ---- hộp thoại & màn hình ----
    continue: "Continue ▸",
    levelUnlocked: "Level Unlocked",
    gameOverTitle: "Out of hearts!",
    gameOverText: "The gifts you found are safe. Try that stretch again.",
    tryAgain: "↻ Try again",
    sysMaybe: "Maybe",
    sysYes: "Definitely!",
    sysStop: "Stop!",
    sysReplyMaybe: "> Maybe? Take your time… the button is still waiting.",
    sysReplyStop: "> Nice try. That option has been disabled by admin ♥",
    stampConfidential: "CONFIDENTIAL",
    readLetter: "Read ➜",
    continueJourney: "Continue the journey ▸",
    close: "Close",
    endingTitle: "Completed",
    endingLetter: "💌 Love letter",
    endingVideo: "🎬 Little movie",
    endingSub: "— or ride it again —",
    playAgain: "▶ Play again",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "VIE",
    langSwitchLabel: "Chuyển sang tiếng Việt",
  },

  vi: {
    manLine: "Tìm thấy em rồi.",
    meetText: "Anh đang trên hành trình một mình, nhưng những vì sao đã dẫn anh đến bên em",
    systemMessage: "Màn tiếp theo vẫn chưa được mở khoá.\nBạn có muốn đi tiếp hành trình không?",
    envelopeLabel: "Tài liệu tuyệt mật",
    letterTitle: "Lá thư gửi bạn",
    letter: "Viết lá thư của bạn ở đây",
    videoMissing: "Video của hai bạn sẽ ở đây 🎬",
    photoPlaceholder: "(chèn ảnh vào đây)",
    rotateTitle: "Xoay ngang màn hình nhé",
    rotateText: "Hành trình này dành cho màn hình nằm ngang.",
    rotateTip: "⟳ Xoay ngang máy để chơi",

    loading: "Đang tải…",
    start: "▶ Bắt đầu hành trình",
    tipKeyboard: "◀ ▶ di chuyển · ▲ nhảy · ▲▲ nhảy đôi · F toàn màn hình",
    tipGamepad: "🎮 tay cầm: cần analog / D-pad để đi · A để nhảy",
    tipInstall: "+ Thêm vào màn hình chính — chơi toàn màn hình",

    controlsKeyboard: "◀ ▶ di chuyển · ▲ nhảy · ▲▲ nhảy đôi · chạm để mở",
    controlsTouch: "giữ ◀ ▶ để đi · chạm ▲ để nhảy · chạm ▲ hai lần để nhảy cao hơn",
    hintGear: "Nhặt chìa khoá và mũ bảo hiểm rồi lên xe nào",
    hintGearDone: "Đủ đồ rồi — lên xe thôi!",
    hintSolo: "Nhặt đủ 5 món quà — chạm ▲ hai lần để nhảy cao hơn",
    hintAllGifts: "Đủ 5 món quà rồi! Giờ đi tìm cô ấy thôi ♥",
    hintBoss: "Mây nghi ngờ! Nhảy qua nó 3 lần",
    hintDodge: "Giỏi lắm! {n}/3",
    hintBossDone: "Hết nghi ngờ — đường đã thông ✦",
    hintRain: "Trời mưa rồi! Nhảy qua tường và nhặt chiếc ô",
    hintRainDone: "Tạnh mưa rồi — đi tiếp thôi ♥",
    hintLastStop: "Còn một chặng nữa — đi tiếp nào ♥",
    together: "Bên nhau ♥",
    level2: "Màn 2 · đã mở khoá ♥",
    missionStats: "HOÀN THÀNH NHIỆM VỤ<br>điểm <b>{score}</b> · thời gian <b>{time}</b> · quà <b>{gifts}</b>",

    popCollectFirst: "Nhặt đủ 5 món quà trước đã!",
    popForgot: "Quên {x} rồi!",
    popRide: "Lên đường thôi!",
    popDoubtCleared: "Hết nghi ngờ ✦",
    popRainOver: "☂ Tạnh mưa rồi",
    gearKey: "Chìa khoá",
    gearHelmet: "Mũ bảo hiểm",
    itemUmbrella: "Chiếc ô",
    itemEgg: "Trứng vàng",
    promptOpen: "Mở",
    bikeMine: "XE CỦA ANH",
    bikeGo: "ĐI THÔI",
    bossDoubt: "NGHI NGỜ",

    continue: "Tiếp tục ▸",
    levelUnlocked: "Đã mở khoá màn mới",
    gameOverTitle: "Hết tim rồi!",
    gameOverText: "Quà đã nhặt vẫn còn nguyên. Thử lại đoạn này nhé.",
    tryAgain: "↻ Thử lại",
    sysMaybe: "Để xem đã",
    sysYes: "Chắc chắn rồi!",
    sysStop: "Dừng lại!",
    sysReplyMaybe: "> Để xem đã á? Cứ từ từ… nút vẫn đang chờ nè.",
    sysReplyStop: "> Không được đâu. Nút này đã bị admin khoá ♥",
    stampConfidential: "TUYỆT MẬT",
    readLetter: "Đọc thư ➜",
    continueJourney: "Đi tiếp hành trình ▸",
    close: "Đóng",
    endingTitle: "Hoàn thành",
    endingLetter: "💌 Lá thư",
    endingVideo: "🎬 Thước phim",
    endingSub: "— hoặc đi lại từ đầu —",
    playAgain: "▶ Chơi lại",
    fullScreen: "Toàn màn hình",
    exitFullScreen: "Thoát toàn màn hình",
    soundOn: "Bật âm thanh",
    soundOff: "Tắt âm thanh",
    langSwitch: "ENG",
    langSwitchLabel: "Switch to English",
  },
};

// Tên món quà hay gặp → tiếng Việt. Khách đặt tên khác thì giữ nguyên chữ khách viết.
const GIFT_VI = {
  Matcha: "Matcha",
  Chocolate: "Sô-cô-la",
  Flowers: "Bó hoa",
  Lipstick: "Son môi",
  Letter: "Lá thư",
  Coffee: "Cà phê",
  Camera: "Máy ảnh",
  "Film Camera": "Máy ảnh film",
  "Film Roll": "Cuộn phim",
  "Blue Flower": "Hoa xanh",
  "Gift Box": "Hộp quà",
  "Tabby Cat": "Mèo mướp",
  "Snow Cat": "Mèo trắng",
};

/** Chữ cố định của game theo ngôn ngữ đang dùng; {tên} trong câu được thay bằng vars.tên. */
export function t(key, vars, inLang = lang) {
  let s = STRINGS[inLang][key] ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Chữ khách viết trong config.js: một chuỗi (dùng cho cả hai thứ tiếng) hoặc { en, vi }. */
export function pick(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value[lang] ?? value.en ?? value.vi ?? "";
  return value ?? "";
}

/** Tên món quà: { en, vi } theo ngôn ngữ; tên tiếng Anh quen thuộc thì tự dịch sang tiếng Việt. */
export function giftLabel(label) {
  const v = pick(label);
  return lang === "vi" && GIFT_VI[v] ? GIFT_VI[v] : v;
}

/** Chữ có dấu tiếng Việt (hay ký tự ngoài bảng ASCII) — font Press Start 2P không vẽ được. */
export function hasAccents(s) {
  return /[À-ɏḀ-ỿ]/.test(s || "");
}

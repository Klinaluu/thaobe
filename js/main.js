// ============================================================
// Điều phối màn hình, HUD, âm thanh, điều khiển và các đoạn cắt cảnh.
// ============================================================
import {
  GAME_TITLE, GAME_SUBTITLE, WINDOW_NAME, TEXT, GIFTS, MILESTONES, VIDEO_SRC, MUSIC_SRC, TITLE_PHOTO, SHOW_EMPTY_PHOTO_FRAMES,
  SCENE_LAYERS, COUPLE_FRAMES,
} from "./config.js";
import { IMG, PROPS, PROP_SETS, SCENES, SCENE_SPEEDS, SCENE_SINK, SCENE_TOP, GRASS_SCENES } from "./assets.js";
import {
  SOLO_SEGMENTS, SOLO_SEG_W, MAX_HEARTS, WALK_TERRAIN, BOSS_TERRAIN, MEET_TERRAIN, COUPLE_TERRAIN,
} from "./levels.js";
import { initAudio, sfx, setMuted, isMuted, initMusic, playMusic, duckMusicForVideo, setRainIntensity } from "./audio.js";
import { initInstallHint, maybeShowInstallHint, detectPlatform, isInstalled } from "./install.js";
import { getLang, setLang, t, pick, giftLabel, hasAccents } from "./i18n.js";
import { JourneyGame } from "./engine.js";

// Chữ trong TEXT của config.js. Để trống → câu mặc định theo ngôn ngữ đang chọn. Config khách
// làm trước khi có bản tiếng Việt chép nguyên câu mặc định tiếng Anh: còn y nguyên thì cũng
// coi như chưa đổi, để bấm VIE vẫn ra tiếng Việt.
function text(key) {
  const v = pick(TEXT[key]);
  return !v || v === t(key, null, "en") ? t(key) : v;
}

// Font pixel cho chữ vẽ trên canvas: Press Start 2P không có chữ có dấu nên bản tiếng Việt
// dùng VT323 (đã phóng cỡ cho khớp trong css/style.css, xem @font-face "VT323 Title").
const titleFont = () => (getLang() === "vi" ? "'VT323 Title', monospace" : "'Press Start 2P', monospace");
const ENGINE_KEYS = [
  "popCollectFirst", "popForgot", "popRide", "popDoubtCleared", "popRainOver",
  "gearKey", "gearHelmet", "itemUmbrella", "itemEgg", "promptOpen", "bikeMine", "bikeGo", "bossDoubt",
];
const engineStrings = () => Object.fromEntries(ENGINE_KEYS.map((k) => [k, t(k)]));

// Chữ ở chỗ dùng font pixel: câu có dấu (khách viết tiếng Việt) thì đổi sang VT323 cả câu,
// thay vì để Press Start 2P mượn font khác cho từng chữ có dấu → chữ lổn nhổn.
function setTitleText(el, s) {
  el.textContent = s;
  el.classList.toggle("vn-text", hasAccents(s));
}

// Mốc đi đôi dùng chung một nền; config.js chỉ khai báo phần nội dung.
const COUPLE_MILESTONES = MILESTONES.map((ms) => ({ ...ms, terrain: COUPLE_TERRAIN }));
// chữ ngày/tên mốc và tên quà lấy theo ngôn ngữ lúc bắt đầu chơi (đổi được ở màn hình mở đầu)
const giftItems = () => GIFTS.map((g) => ({ ...g, label: giftLabel(g.label) }));
const coupleMilestones = () => COUPLE_MILESTONES.map((ms) => ({ ...ms, date: pick(ms.date), name: pick(ms.name) }));

// Nền parallax: khách có thể khai báo số lớp + tốc độ riêng từng cảnh trong config.js
// (SCENE_LAYERS), không khai báo thì dùng bộ 3 lớp mặc định của assets.js.
const CUSTOM_SCENES = SCENE_LAYERS || {};
const SCENE_PATHS = Object.fromEntries(
  Object.keys(SCENES).map((id) => {
    const custom = CUSTOM_SCENES[id];
    return [id, custom && custom.layers ? custom.layers.map((f) => `assets/scenes/${id}/${f}`) : SCENES[id]];
  })
);
const SCENE_SPEEDS_BY_ID = Object.fromEntries(
  Object.keys(SCENES).map((id) => [id, (CUSTOM_SCENES[id] && CUSTOM_SCENES[id].speeds) || SCENE_SPEEDS[id]])
);

// Khung hình xe chở đôi: khách khai báo riêng (vd chỉ 1 ảnh) hoặc dùng bộ mặc định
const COUPLE_FRAME_SRCS = COUPLE_FRAMES && COUPLE_FRAMES.length ? COUPLE_FRAMES : IMG.coupleFrames;

let currentGame = null;
let timeTimer = null;

// ---------------- ảnh ----------------
const imgCache = new Map();
function getImg(src) {
  if (!imgCache.has(src)) {
    const img = new Image();
    img.src = src;
    imgCache.set(src, img);
  }
  return imgCache.get(src);
}
function preload(src) {
  return new Promise((resolve) => {
    const img = getImg(src);
    if (img.complete) return resolve(img);
    img.addEventListener("load", () => resolve(img), { once: true });
    img.addEventListener("error", () => resolve(img), { once: true });
  });
}
// Mạng chậm (4G yếu, app ngoài màn hình chính) hay một ảnh bị treo không được giữ nút Start ở
// "Loading…" mãi: chờ tối đa chừng này rồi cho chơi, ảnh nào chưa xong thì game tự vẽ khi tải xong.
const PRELOAD_TIMEOUT_MS = 8000;
function loaded(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}
// Ép ảnh về cùng hạt pixel với nhân vật: 1 pixel art ≈ 0.55 đơn vị thế giới.
// Ảnh gốc quá mịn (vd Man-Bike-Side-01 1156px cho 74 đơn vị) được thu về
// lưới tương ứng trước, để khi vẽ vào game hạt của nó khớp các sprite khác.
const ART_PX_PER_WU = 0.55;
function normalizeGrain(img, worldHeight) {
  if (!loaded(img)) return img;
  const gridH = Math.round(worldHeight / ART_PX_PER_WU);
  if (img.naturalHeight <= gridH * 1.25) return img;
  const gridW = Math.round(gridH * (img.naturalWidth / img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = gridW;
  c.height = gridH;
  c.getContext("2d").drawImage(img, 0, 0, gridW, gridH);
  return c;
}
async function preloadAll() {
  const srcs = new Set([...Object.values({ ...IMG, coupleFrames: COUPLE_FRAME_SRCS }).flat(), ...Object.values(SCENE_PATHS).flat(), ...Object.values(PROPS)]);
  GIFTS.forEach((g) => g.icon && srcs.add(g.icon));
  COUPLE_MILESTONES.forEach((ms) => {
    if (ms.photo) srcs.add(ms.photo);
  });
  await Promise.race([
    Promise.all([...srcs].map(preload)),
    new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
  ]);
}

// Canvas khớp đúng tỉ lệ màn hình thiết bị (phủ kín, không méo, không cắt).
function canvasSizeForViewport() {
  const w = window.innerWidth || 960;
  const h = window.innerHeight || 360;
  const aspect = w / h;
  // tablet nằm ngang (iPad): lấy khung nhìn cao hơn để thấy xa hơn
  const base = w >= 900 && aspect >= 1.2 ? 700 : 620;
  const width = Math.round(Math.max(480, Math.min(1280, aspect * base)));
  const height = Math.round(width / aspect);
  return { width, height };
}

// Hàng nút cảm ứng cao bao nhiêu (đổi sang px thế giới) — mặt đường luôn nằm trên nó
function bottomInsetFor(canvasHeight) {
  const pad = document.querySelector(".touch-controls");
  if (!pad || getComputedStyle(pad).display === "none") return 0;
  const padPx = pad.getBoundingClientRect().height;
  if (!padPx) return 0;
  const scale = canvasHeight / (window.innerHeight || canvasHeight);
  return Math.round(padPx * scale) + 34; // chừa thêm một khoảng cho thoáng
}
// Thanh HUD trên cùng cao bao nhiêu (đổi sang px thế giới) — khung polaroid luôn treo
// dưới nó, không để dây/khung bị thanh HUD đè lên trông như bị cắt cụt phía trên.
function topInsetFor(canvasHeight) {
  const bar = document.querySelector(".hud");
  if (!bar) return 0;
  const barPx = bar.getBoundingClientRect().height;
  if (!barPx) return 0;
  const scale = canvasHeight / (window.innerHeight || canvasHeight);
  return Math.round(barPx * scale) + 20; // chừa thêm một khoảng cho thoáng
}

// ---------------- helpers màn hình ----------------
const $ = (id) => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  // màn hình mở đầu không bắt xoay ngang, để nút "Add to Home Screen" luôn bấm được
  document.body.classList.toggle("on-title-screen", id === "screen-title");
}
const showModal = (id) => $(id).classList.remove("hidden");
const hideModal = (id) => $(id).classList.add("hidden");

// ---------------- HUD ----------------
function renderHearts(n) {
  const wrap = $("hud-hearts");
  wrap.innerHTML = "";
  for (let i = 0; i < MAX_HEARTS; i++) {
    const img = document.createElement("img");
    img.src = i < n ? IMG.heartFull : IMG.heartEmpty;
    img.alt = "";
    wrap.appendChild(img);
  }
}
function renderItemSlots(collectedIds) {
  const wrap = $("hud-items");
  wrap.innerHTML = "";
  giftItems().forEach((it) => {
    const slot = document.createElement("div");
    slot.className = "hud-slot" + (collectedIds.has(it.id) ? " got" : "");
    slot.title = it.label;
    const icon = it.icon ? getImg(it.icon) : null;
    if (loaded(icon)) {
      const img = document.createElement("img");
      img.src = it.icon;
      img.alt = "";
      slot.appendChild(img);
    } else {
      const lip = document.createElement("div");
      lip.className = "lip";
      slot.appendChild(lip);
    }
    wrap.appendChild(slot);
  });
}
let hintTimer = null;
function showHint(msg, ms = 2600) {
  const el = $("hud-hint");
  setTitleText(el, msg);
  el.classList.remove("hidden");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.add("hidden"), ms);
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function renderScore(n) {
  $("hud-score").textContent = String(n).padStart(5, "0");
}
// thanh tiến độ pixel (Bar-0/25/50/75/100) — chọn khung gần nhất với %
function renderBar(pct) {
  const idx = Math.max(0, Math.min(4, Math.round((pct / 100) * 4)));
  $("hud-bar").src = IMG.bars[idx];
}
function hudSoloMode() {
  $("hud-hearts").classList.remove("hidden");
  $("hud-items").classList.remove("hidden");
  $("hud-milestone").classList.add("hidden");
  $("hud-portrait").classList.add("hidden");
  $("hud-stats").classList.remove("hidden");
  renderBar(0);
  renderScore(0);
  $("hud-time").textContent = "0:00";
}
// chữ ngày/tên do khách viết: dựng bằng textContent để "<3" hay ký tự đặc biệt không vỡ HTML
function renderMilestoneLabel(ms) {
  const el = $("hud-milestone");
  if (!ms.date && !ms.name) {
    el.textContent = t("together");
    return;
  }
  const date = document.createElement("b");
  date.textContent = ms.date;
  el.replaceChildren(date, document.createTextNode(ms.name));
}
function hudCoupleMode() {
  $("hud-hearts").classList.add("hidden");
  $("hud-items").classList.add("hidden");
  $("hud-milestone").classList.remove("hidden");
  $("hud-portrait").classList.remove("hidden");
  $("hud-stats").classList.remove("hidden");
  $("hud-milestone").textContent = t("together");
  renderBar(0);
}

// ---------------- luồng game ----------------
function startJourney() {
  showScreen("screen-level");
  hudSoloMode();
  renderHearts(MAX_HEARTS);
  renderItemSlots(new Set());

  const canvas = $("game-canvas");
  const size = canvasSizeForViewport();
  canvas.width = size.width;
  canvas.height = size.height;

  const images = {
    playerSolo: normalizeGrain(getImg(IMG.playerSolo), 74),
    bikeIdle: getImg(IMG.bikeIdle),
    walkFrames: IMG.walkFrames.map(getImg),
    gear: { key: getImg(IMG.key), helmet: getImg(IMG.helmet) },
    coupleFrames: COUPLE_FRAME_SRCS.map(getImg),
    woman: getImg(IMG.woman),
    womanCheer: IMG.womanCheer.map(getImg),
    cloud: getImg(IMG.cloud),
    road: getImg(IMG.road),
    brick: getImg(IMG.brick),
    brickRow: getImg(IMG.brickRow),
    blockSurprise: getImg(IMG.blockSurprise),
    blockUsed: getImg(IMG.blockUsed),
    itemHeart: getImg(IMG.itemHeart),
    scenes: Object.fromEntries(Object.entries(SCENE_PATHS).map(([id, layers]) => [id, layers.map(getImg)])),
    sceneSpeeds: SCENE_SPEEDS_BY_ID,
    sceneSink: SCENE_SINK,
    sceneTop: SCENE_TOP,
    grassFloat: getImg(IMG.grassFloat),
    grassGround: getImg(IMG.grassGround),
    egg: getImg(IMG.egg),
    props: Object.fromEntries(Object.entries(PROPS).map(([k, v]) => [k, getImg(v)])),
    pickup: Object.fromEntries(GIFTS.map((g) => [g.id, g.icon ? getImg(g.icon) : null])),
    polaroids: COUPLE_MILESTONES.map((ms) => (ms.photo ? getImg(ms.photo) : null)),
  };

  const collected = new Set();
  if (currentGame) currentGame.destroy();
  currentGame = new JourneyGame(
    canvas,
    { soloSegments: SOLO_SEGMENTS, soloSegW: SOLO_SEG_W, walkTerrain: WALK_TERRAIN, bossTerrain: BOSS_TERRAIN, meetTerrain: MEET_TERRAIN, items: giftItems(), milestones: coupleMilestones(), maxHearts: MAX_HEARTS, grassScenes: GRASS_SCENES, propSets: PROP_SETS, bottomInset: bottomInsetFor(size.height), topInset: topInsetFor(size.height), emptyPolaroids: SHOW_EMPTY_PHOTO_FRAMES, photoPlaceholder: text("photoPlaceholder"), strings: engineStrings(), titleFont: titleFont() },
    images,
    {
      onItem: (item, count, total) => {
        collected.add(item.id);
        renderItemSlots(collected);
        renderBar((count / total) * 100);
        showHint(count < total ? `${item.label} ✓  ·  ${count}/${total}` : t("hintAllGifts"), count < total ? 1800 : 3200);
      },
      onHearts: (n) => renderHearts(n),
      onGameOver: () => showModal("modal-gameover"),
      onMeet: () => playMeeting(),
      onMilestone: (ms, j) => {
        if (!ms) {
          renderBar(100);
          return;
        }
        // mốc không ghi ngày/tên (vd bản khách bỏ chú thích) thì giữ dòng "Together", không để trống ô HUD
        renderMilestoneLabel(ms);
        renderBar((j / COUPLE_MILESTONES.length) * 100);
        if (ms.event === "rain") showHint(t("hintRain"), 3600);
      },
      onExtra: (ex) => { if (ex.id === "umbrella") showHint(t("hintRainDone"), 2600); },
      onThunder: () => sfx("thunder"),
      onRain: (k) => setRainIntensity(k),
      onChest: () => openSystemMessage(),
      onGift: () => openVideo(false),
      onScore: (n) => renderScore(n),
      onJump: (k) => sfx(k === 2 ? "jump2" : "jump"),
      onGear: (ge, ready) => showHint(ready ? t("hintGearDone") : `${ge.label} ✓`, ready ? 2600 : 1400),
      onMount: () => setTimeout(() => showHint(t("hintSolo"), 3600), 900),
      onBoss: (ev, b) => {
        if (ev === "start") showHint(t("hintBoss"), 3200);
        if (ev === "dodge" && b.dodges < 3) showHint(t("hintDodge", { n: b.dodges }), 1200);
        if (ev === "defeated") showHint(t("hintBossDone"), 3000);
      },
    }
  );
  currentGame.start();
  // Cờ gỡ lỗi: mở trang với #debug để truy cập ván chơi từ console (window.__game)
  if (location.hash.includes("debug")) window.__game = currentGame;
  initAudio();
  playMusic();
  clearInterval(timeTimer);
  timeTimer = setInterval(() => {
    if (currentGame && currentGame.phase === "solo") $("hud-time").textContent = fmtTime(currentGame.timeSolo);
  }, 250);
  setTimeout(() => showHint(t("hintGear"), 3600), 600);
}

// --- chương 2: gặp nhau ---
function playMeeting() {
  const bubble = $("bubble-man");
  setTitleText(bubble, text("manLine"));
  // đặt bong bóng ngay trên đầu nhân vật (đổi toạ độ canvas → % màn hình)
  const g = currentGame;
  bubble.style.left = ((g.player.x + g.player.w * 0.5 - g.camX) / g.CW) * 100 + "%";
  bubble.style.top = ((g.player.y - 12) / g.CH) * 100 + "%";
  bubble.classList.remove("hidden");
  setTimeout(() => {
    bubble.classList.add("hidden");
    setTitleText($("meet-text"), text("meetText"));
    $("meet-stats").innerHTML =
      t("missionStats", { score: g.score, time: fmtTime(g.timeSolo), gifts: `${GIFTS.length}/${GIFTS.length}` });
    showScreen("screen-meet");
  }, 1900);
}

// --- chương 4: hòm hồng → System Message ---
function openSystemMessage() {
  $("system-text").textContent = text("systemMessage");
  $("system-reply").textContent = "";
  showModal("modal-system");
}

// --- hòm quà → thư → video ---
function openEnvelope() {
  setTitleText($("envelope-label"), text("envelopeLabel"));
  showModal("modal-envelope");
}
function openLetter(fromEnding) {
  $("letter-text").textContent = text("letter");
  $("letter-close").classList.toggle("hidden", !fromEnding);
  $("btn-watch-video").classList.toggle("hidden", fromEnding);
  $("btn-watch-video").textContent = t("continueJourney");
  showModal("modal-letter");
}
function openVideo(fromEnding) {
  const video = $("video-player");
  const missing = $("video-missing");
  if (VIDEO_SRC) {
    missing.classList.add("hidden");
    video.classList.remove("hidden");
    video.src = VIDEO_SRC;
    video.load();
  } else {
    // bản demo: chưa có video của bạn
    video.classList.add("hidden");
    missing.classList.remove("hidden");
  }
  $("btn-video-done").textContent = fromEnding ? t("close") : t("continue");
  $("btn-video-done").dataset.fromEnding = fromEnding ? "1" : "";
  showModal("modal-video");
}
function closeVideo() {
  const video = $("video-player");
  video.pause();
  duckMusicForVideo(false);
  video.removeAttribute("src");
  video.load();
  hideModal("modal-video");
}

function showEnding() {
  if (currentGame) {
    currentGame.finish();
    currentGame.destroy();
    currentGame = null;
  }
  showScreen("screen-ending");
}

// ---------------- nối nút bấm ----------------
function wireUI() {
  // toàn màn hình: tự xin khi bấm Start (phải nằm trong cử chỉ người dùng), nút ⛶ và phím F để bật/tắt
  const docEl = document.documentElement;
  const fsSupported = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const enterFs = () => {
    if (!fsSupported || isFs()) return;
    const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    try {
      const r = req.call(docEl, { navigationUI: "hide" });
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* trình duyệt không cho (iPhone) */ }
  };
  const exitFs = () => {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) ex.call(document);
  };
  const fsBtn = $("btn-fullscreen");
  const renderFs = () => {
    fsBtn.textContent = isFs() ? "✕" : "⛶";
    fsBtn.setAttribute("aria-label", isFs() ? t("exitFullScreen") : t("fullScreen"));
  };
  if (!fsSupported) fsBtn.classList.add("hidden");
  fsBtn.addEventListener("click", () => (isFs() ? exitFs() : enterFs()));
  document.addEventListener("fullscreenchange", renderFs);
  document.addEventListener("webkitfullscreenchange", renderFs);
  window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") (isFs() ? exitFs() : enterFs());
  });
  renderFs();

  // VIE / ENG ở màn hình mở đầu: đổi ngôn ngữ ngay tại chỗ (không tải lại trang), nhớ cho lần sau
  $("btn-lang").addEventListener("click", () => {
    setLang(getLang() === "vi" ? "en" : "vi");
    applyLanguage();
    applyBranding();
    renderFs();
    renderSound();
  });

  $("btn-start").addEventListener("click", () => {
    enterFs();
    startJourney();
  });

  // tiếng "blip" cho mọi nút retro (pixel-btn / ✕) — bắt ở pha capture để kêu trước khi màn hình đổi
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest(".pixel-btn, .win-x.btn, .sound-btn");
      if (!b) return;
      initAudio();
      sfx("click");
    },
    true
  );
  // bật / tắt âm thanh
  // dòng gợi ý dưới nút Start: bấm để mở lại hướng dẫn thêm vào màn hình chính
  const installTip = $("title-install-tip");
  if (detectPlatform() === "desktop" || isInstalled()) installTip.classList.add("hidden");
  installTip.addEventListener("click", () => maybeShowInstallHint({ text: TEXT.install, force: true }));

  const soundBtn = $("btn-sound");
  const renderSound = () => {
    soundBtn.textContent = isMuted() ? "🔇" : "🔊";
    soundBtn.setAttribute("aria-label", isMuted() ? t("soundOff") : t("soundOn"));
  };
  renderSound();
  soundBtn.addEventListener("click", () => {
    initAudio();
    setMuted(!isMuted());
    renderSound();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") {
      setMuted(!isMuted());
      renderSound();
    }
  });

  $("btn-retry").addEventListener("click", () => {
    hideModal("modal-gameover");
    currentGame && currentGame.retrySegment();
  });

  $("btn-meet-continue").addEventListener("click", () => {
    showScreen("screen-level");
    hudCoupleMode();
    currentGame && currentGame.beginCouple();
  });

  $("btn-sys-maybe").addEventListener("click", () => {
    $("system-reply").textContent = t("sysReplyMaybe");
    $("modal-system").querySelector(".win").classList.remove("shake");
    void $("modal-system").offsetWidth;
    $("modal-system").querySelector(".win").classList.add("shake");
  });
  $("btn-sys-stop").addEventListener("click", () => {
    $("system-reply").textContent = t("sysReplyStop");
    $("modal-system").querySelector(".win").classList.remove("shake");
    void $("modal-system").offsetWidth;
    $("modal-system").querySelector(".win").classList.add("shake");
  });
  $("btn-sys-yes").addEventListener("click", () => {
    hideModal("modal-system");
    showScreen("screen-unlock");
  });
  $("btn-unlock-continue").addEventListener("click", () => {
    showScreen("screen-level");
    $("hud-milestone").textContent = t("level2");
    openEnvelope();
  });

  $("btn-open-letter").addEventListener("click", () => {
    hideModal("modal-envelope");
    openLetter(false);
  });
  $("letter-close").addEventListener("click", () => hideModal("modal-letter"));
  // đọc thư xong → đi tiếp tới mốc cuối, hòm video sẽ rơi xuống ở đó
  $("btn-watch-video").addEventListener("click", () => {
    hideModal("modal-letter");
    currentGame && currentGame.resumeJourney();
    showHint(t("hintLastStop"), 3000);
  });
  $("video-player").addEventListener("error", () => {
    $("video-player").classList.add("hidden");
    $("video-missing").classList.remove("hidden");
  });
  // tự tắt nhạc nền lúc video đang chạy, bật lại khi dừng/hết/đóng màn hình video
  $("video-player").addEventListener("play", () => duckMusicForVideo(true));
  $("video-player").addEventListener("pause", () => duckMusicForVideo(false));
  $("video-player").addEventListener("ended", () => duckMusicForVideo(false));
  $("btn-video-done").addEventListener("click", () => {
    const fromEnding = $("btn-video-done").dataset.fromEnding === "1";
    closeVideo();
    if (!fromEnding) showEnding();
  });

  $("btn-play-again").addEventListener("click", startJourney);
  $("btn-ending-letter").addEventListener("click", () => openLetter(true));
  $("btn-ending-video").addEventListener("click", () => openVideo(true));

  // chạm vào canvas = mở hòm khi đang đứng cạnh
  $("game-canvas").addEventListener("click", () => currentGame && currentGame.interact());

  // nút cảm ứng
  const bind = (id, key) => {
    const el = $(id);
    const press = (e) => {
      e.preventDefault();
      currentGame && currentGame.pressKey(key);
    };
    const release = (e) => {
      e.preventDefault();
      currentGame && currentGame.releaseKey(key);
    };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release, { passive: false });
    el.addEventListener("touchcancel", release, { passive: false });
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  };
  bind("btn-left", "ArrowLeft");
  bind("btn-right", "ArrowRight");
  bind("btn-jump", "ArrowUp");

  wireGamepad();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!currentGame) return;
      const s = canvasSizeForViewport();
      currentGame.resize(s.width, s.height, bottomInsetFor(s.height), topInsetFor(s.height));
    }, 150);
  });
}

// ---------------- tay cầm (Gamepad API) ----------------
// Trái/phải: cần analog trái hoặc D-pad. Nhảy / chọn: A B X Y. Mở hòm thư: A khi đứng cạnh.
// Ở các màn hình không phải lúc chơi, A/Start = bấm nút chính đang hiện.
const PAD_FACE = [0, 1, 2, 3];
const PAD_START = [9, 8];
const DEAD_ZONE = 0.45;

function wireGamepad() {
  if (!navigator.getGamepads) return;
  const prev = { left: false, right: false, jump: false, start: false };
  const send = (now, name, key) => {
    if (now === prev[name]) return;
    prev[name] = now;
    if (!currentGame) return;
    if (now) currentGame.pressKey(key);
    else currentGame.releaseKey(key);
  };
  // nút chính đang hiện (modal ưu tiên, rồi tới màn hình đang bật)
  const primaryButton = () => {
    const modal = document.querySelector(".modal:not(.hidden)");
    if (modal) return modal.querySelector(".pixel-btn.primary, .pixel-btn");
    const screen = document.querySelector(".screen.active:not(#screen-level)");
    return screen ? screen.querySelector(".pixel-btn.primary, .pixel-btn") : null;
  };
  const poll = () => {
    const pads = navigator.getGamepads();
    let left = false;
    let right = false;
    let jump = false;
    let start = false;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0;
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      if (ax < -DEAD_ZONE || btn(14)) left = true;
      if (ax > DEAD_ZONE || btn(15)) right = true;
      if (PAD_FACE.some(btn)) jump = true;
      if (PAD_START.some(btn)) start = true;
    }
    const pressedNow = (jump && !prev.jump) || (start && !prev.start);
    const btnEl = primaryButton();
    if (pressedNow && btnEl) {
      // đang ở màn hình / hộp thoại → bấm nút thay vì nhảy
      initAudio();
      prev.jump = jump;
      prev.start = start;
      btnEl.click();
    } else {
      if (pressedNow) initAudio();
      send(left, "left", "ArrowLeft");
      send(right, "right", "ArrowRight");
      send(jump, "jump", "ArrowUp");
      prev.start = start;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

// Đổ nội dung từ config.js vào giao diện (một nguồn duy nhất để cá nhân hoá)
function applyBranding() {
  document.title = pick(GAME_TITLE);
  setTitleText($("title-heading"), pick(GAME_TITLE));
  $("title-subtitle").textContent = pick(GAME_SUBTITLE);
  setTitleText($("title-window-name"), pick(WINDOW_NAME));
  const frame = $("title-photo-frame");
  if (TITLE_PHOTO) {
    frame.className = "title-hero photo";
    frame.innerHTML = "";
    const img = new Image();
    img.src = TITLE_PHOTO;
    img.alt = "";
    frame.appendChild(img);
  } else {
    frame.textContent = text("photoPlaceholder");
  }
  setTitleText($("letter-window-name"), text("letterTitle"));
  $("rotate-title").textContent = text("rotateTitle");
  $("rotate-text").textContent = text("rotateText");
  $("title-rotate-tip").textContent = text("rotateTip");
  $("video-missing").textContent = text("videoMissing");
}

// Chữ cố định trong index.html (các phần tử có data-i18n) → đúng ngôn ngữ máy
function applyLanguage() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const s = t(el.dataset.i18n);
    if (el.closest(".win-bar")) setTitleText(el, s);
    else el.textContent = s;
  });
  const startBtn = $("btn-start");
  if (startBtn.disabled) startBtn.textContent = t("loading"); // đang tải ảnh thì giữ chữ "Đang tải…"
  const langBtn = $("btn-lang");
  langBtn.textContent = t("langSwitch");
  langBtn.setAttribute("aria-label", t("langSwitchLabel"));
}

async function init() {
  document.body.classList.add("on-title-screen"); // màn hình mặc định khi tải trang là title
  applyLanguage();
  applyBranding();
  wireUI();
  initInstallHint({ text: TEXT.install });
  initMusic(MUSIC_SRC);
  // Tải trước font Waterfall (cả 2 file latin + vietnamese) từ lúc mở trang — chuyện mở lá
  // thư có thể xảy ra rất lâu sau (giữa game), nên tải sớm để lúc đó không bị "nhảy" từ
  // font dự phòng sang Waterfall giữa chừng khi trình duyệt vừa tải xong.
  if (document.fonts && document.fonts.load) {
    document.fonts.load("16px Waterfall", "chữ có dấu ệ ố ớ ữ ộ ẫ ẳ Đ").catch(() => {});
    document.fonts.load("16px 'VT323 Title'", "Tiếng Việt ệ ố ớ ữ ộ Đ").catch(() => {});
  }
  const startBtn = $("btn-start");
  startBtn.textContent = t("loading");
  startBtn.disabled = true;
  await preloadAll();
  startBtn.disabled = false;
  startBtn.textContent = t("start");
  // #autostart: vào thẳng màn chơi, bỏ qua màn hình tiêu đề (dùng khi thử nghiệm)
  if (location.hash.includes("autostart")) startBtn.click();
}

init();

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
import { JourneyGame } from "./engine.js";

// Mốc đi đôi dùng chung một nền; config.js chỉ khai báo phần nội dung.
const COUPLE_MILESTONES = MILESTONES.map((ms) => ({ ...ms, terrain: COUPLE_TERRAIN }));

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
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
  });
}
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
  await Promise.all([...srcs].map(preload));
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
  GIFTS.forEach((it) => {
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
function showHint(text, ms = 2600) {
  const el = $("hud-hint");
  el.textContent = text;
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
    el.textContent = "Together ♥";
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
  $("hud-milestone").textContent = "Together ♥";
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
    { soloSegments: SOLO_SEGMENTS, soloSegW: SOLO_SEG_W, walkTerrain: WALK_TERRAIN, bossTerrain: BOSS_TERRAIN, meetTerrain: MEET_TERRAIN, items: GIFTS, milestones: COUPLE_MILESTONES, maxHearts: MAX_HEARTS, grassScenes: GRASS_SCENES, propSets: PROP_SETS, bottomInset: bottomInsetFor(size.height), emptyPolaroids: SHOW_EMPTY_PHOTO_FRAMES, photoPlaceholder: TEXT.photoPlaceholder },
    images,
    {
      onItem: (item, count, total) => {
        collected.add(item.id);
        renderItemSlots(collected);
        renderBar((count / total) * 100);
        showHint(count < total ? `${item.label} ✓  ·  ${count}/${total}` : "All 5 gifts! Now go find her ♥", count < total ? 1800 : 3200);
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
        if (ms.event === "rain") showHint("It's raining! Jump the walls and grab the umbrella", 3600);
      },
      onExtra: (ex) => { if (ex.id === "umbrella") showHint("Rain's over — let's keep going ♥", 2600); },
      onThunder: () => sfx("thunder"),
      onRain: (k) => setRainIntensity(k),
      onChest: () => openSystemMessage(),
      onGift: () => openVideo(false),
      onScore: (n) => renderScore(n),
      onJump: (k) => sfx(k === 2 ? "jump2" : "jump"),
      onGear: (ge, ready) => showHint(ready ? "All set — hop on the bike!" : `${ge.label} ✓`, ready ? 2600 : 1400),
      onMount: () => setTimeout(() => showHint("Collect all 5 gifts — press ▲ twice to jump higher", 3600), 900),
      onBoss: (ev, b) => {
        if (ev === "start") showHint("A cloud of doubt! Jump over it 3 times", 3200);
        if (ev === "dodge" && b.dodges < 3) showHint(`Nice! ${b.dodges}/3`, 1200);
        if (ev === "defeated") showHint("Doubt cleared — the road is open ✦", 3000);
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
  setTimeout(() => showHint("Grab your key and helmet, then hop on the bike", 3600), 600);
}

// --- chương 2: gặp nhau ---
function playMeeting() {
  const bubble = $("bubble-man");
  bubble.textContent = TEXT.manLine;
  // đặt bong bóng ngay trên đầu nhân vật (đổi toạ độ canvas → % màn hình)
  const g = currentGame;
  bubble.style.left = ((g.player.x + g.player.w * 0.5 - g.camX) / g.CW) * 100 + "%";
  bubble.style.top = ((g.player.y - 12) / g.CH) * 100 + "%";
  bubble.classList.remove("hidden");
  setTimeout(() => {
    bubble.classList.add("hidden");
    $("meet-text").textContent = TEXT.meetText;
    $("meet-stats").innerHTML =
      `MISSION COMPLETE<br>score <b>${g.score}</b> · time <b>${fmtTime(g.timeSolo)}</b> · gifts <b>${GIFTS.length}/${GIFTS.length}</b>`;
    showScreen("screen-meet");
  }, 1900);
}

// --- chương 4: hòm hồng → System Message ---
function openSystemMessage() {
  $("system-text").textContent = TEXT.systemMessage;
  $("system-reply").textContent = "";
  showModal("modal-system");
}

// --- hòm quà → thư → video ---
function openEnvelope() {
  $("envelope-label").textContent = TEXT.envelopeLabel;
  showModal("modal-envelope");
}
function openLetter(fromEnding) {
  $("letter-text").textContent = TEXT.letter;
  $("letter-close").classList.toggle("hidden", !fromEnding);
  $("btn-watch-video").classList.toggle("hidden", fromEnding);
  $("btn-watch-video").textContent = "Continue the journey ▸";
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
  $("btn-video-done").textContent = fromEnding ? "Close" : "Continue ▸";
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
    fsBtn.setAttribute("aria-label", isFs() ? "Exit full screen" : "Full screen");
  };
  if (!fsSupported) fsBtn.classList.add("hidden");
  fsBtn.addEventListener("click", () => (isFs() ? exitFs() : enterFs()));
  document.addEventListener("fullscreenchange", renderFs);
  document.addEventListener("webkitfullscreenchange", renderFs);
  window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") (isFs() ? exitFs() : enterFs());
  });
  renderFs();

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
    soundBtn.setAttribute("aria-label", isMuted() ? "Sound off" : "Sound on");
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
    $("system-reply").textContent = "> Maybe? Take your time… the button is still waiting.";
    $("modal-system").querySelector(".win").classList.remove("shake");
    void $("modal-system").offsetWidth;
    $("modal-system").querySelector(".win").classList.add("shake");
  });
  $("btn-sys-stop").addEventListener("click", () => {
    $("system-reply").textContent = "> Nice try. That option has been disabled by admin ♥";
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
    $("hud-milestone").textContent = "Level 2 · unlocked ♥";
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
    showHint("One more stop — keep riding ♥", 3000);
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
      currentGame.resize(s.width, s.height, bottomInsetFor(s.height));
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
  document.title = GAME_TITLE;
  $("title-heading").textContent = GAME_TITLE;
  $("title-subtitle").textContent = GAME_SUBTITLE;
  $("title-window-name").textContent = WINDOW_NAME;
  const frame = $("title-photo-frame");
  if (TITLE_PHOTO) {
    frame.className = "title-hero photo";
    frame.innerHTML = "";
    const img = new Image();
    img.src = TITLE_PHOTO;
    img.alt = "";
    frame.appendChild(img);
  } else {
    frame.textContent = TEXT.photoPlaceholder;
  }
  $("letter-window-name").textContent = TEXT.letterTitle;
  $("rotate-title").textContent = TEXT.rotateTitle;
  $("rotate-text").textContent = TEXT.rotateText;
  $("title-rotate-tip").textContent = TEXT.rotateTip;
  $("video-missing").textContent = TEXT.videoMissing;
}

async function init() {
  document.body.classList.add("on-title-screen"); // màn hình mặc định khi tải trang là title
  applyBranding();
  wireUI();
  initInstallHint({ text: TEXT.install });
  initMusic(MUSIC_SRC);
  const startBtn = $("btn-start");
  startBtn.textContent = "Loading…";
  startBtn.disabled = true;
  await preloadAll();
  startBtn.disabled = false;
  startBtn.textContent = "Start the journey";
  // #autostart: vào thẳng màn chơi, bỏ qua màn hình tiêu đề (dùng khi thử nghiệm)
  if (location.hash.includes("autostart")) startBtn.click();
}

init();

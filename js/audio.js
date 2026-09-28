// Hiệu ứng âm thanh chiptune sinh bằng WebAudio (nhảy / nhảy đôi / bấm nút / sấm / mưa)
// — không cần file. Nhạc nền thì phát từ file mp3 riêng (xem MUSIC_SRC ở config.js).

let ctx = null;
let master = null;
let muted = false;

const STORE_KEY = "rtu-muted";
try {
  muted = localStorage.getItem(STORE_KEY) === "1";
} catch (e) {
  /* private mode */
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  // iPhone: gạt im lặng tắt tiếng WebAudio (tiếng nhảy) nhưng không tắt nhạc nền mp3 → lệch nhau.
  // "playback" cho cả hai cùng kêu; muốn tắt thì dùng nút 🔊 trong game.
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) {
    /* Safari cũ */
  }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  try {
    localStorage.setItem(STORE_KEY, muted ? "1" : "0");
  } catch (e) {
    /* ignore */
  }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  fadeMusicTo(targetMusicVolume(), 200);
}

// ---------- Nhạc nền (file mp3, phát song song với hiệu ứng WebAudio ở trên) ----------
let musicEl = null;
let musicDucked = false; // true trong lúc đang phát video, để tự tắt nhạc nền
const MUSIC_VOLUME = 0.35; // giữ nhỏ hơn hiệu ứng để tiếng nhảy luôn nổi lên trên nhạc
let musicFadeTimer = null;

function targetMusicVolume() {
  return muted || musicDucked ? 0 : MUSIC_VOLUME;
}
function fadeMusicTo(target, ms) {
  if (!musicEl) return;
  clearInterval(musicFadeTimer);
  const start = musicEl.volume;
  const t0 = performance.now();
  musicFadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    musicEl.volume = start + (target - start) * k;
    if (k >= 1) clearInterval(musicFadeTimer);
  }, 40);
}

export function initMusic(src) {
  if (musicEl || !src) return;
  musicEl = new Audio(src);
  musicEl.loop = true;
  musicEl.preload = "auto";
  musicEl.volume = 0;
}

let musicWanted = false; // đã bấm Start → nhạc nên đang phát (trừ lúc trang bị ẩn)

export function playMusic() {
  if (!musicEl) return;
  musicWanted = true;
  musicEl.play().then(() => fadeMusicTo(targetMusicVolume(), 1500)).catch(() => {});
}

// Chuyển sang app khác / khoá màn hình: Android vẫn phát nhạc tab nền → tạm dừng, quay lại thì phát tiếp
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (musicEl) musicEl.pause();
    if (ctx && ctx.state === "running") ctx.suspend();
    return;
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  if (musicEl && musicWanted) {
    musicEl.volume = 0;
    musicEl.play().then(() => fadeMusicTo(targetMusicVolume(), 800)).catch(() => {});
  }
});

// gọi khi màn hình video mở (on = true) / đóng hoặc dừng phát (on = false)
export function duckMusicForVideo(on) {
  musicDucked = on;
  fadeMusicTo(targetMusicVolume(), 400);
}

// nhấn nhỏ nhạc nền một nhịp mỗi lần nhảy, để tiếng "nhảy" luôn nghe rõ chứ không bị nhạc lấp
function duckMusicBriefly() {
  if (!musicEl || muted || musicDucked) return;
  clearInterval(musicFadeTimer);
  musicEl.volume = MUSIC_VOLUME * 0.35;
  fadeMusicTo(MUSIC_VOLUME, 260);
}

function tone(type, f0, f1, t0, dur, gain, dest) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest || master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// ---------- SFX ----------
export function sfx(name) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case "jump":
      tone("square", 320, 720, t, 0.14, 0.12);
      duckMusicBriefly();
      break;
    case "jump2":
      tone("square", 480, 1100, t, 0.16, 0.12);
      tone("triangle", 240, 520, t, 0.16, 0.08);
      duckMusicBriefly();
      break;
    case "click":
      tone("square", 880, 880, t, 0.045, 0.1);
      tone("square", 1320, 1320, t + 0.05, 0.07, 0.09);
      break;
    case "thunder": {
      // rền trầm kéo dài
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.55, t + 0.06);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(og);
      og.connect(master);
      o.start(t);
      o.stop(t + 1.3);
      // tiếng "rắc" ở đầu tiếng sét
      const n = ctx.createBufferSource();
      n.buffer = getNoiseBuffer();
      const nf = ctx.createBiquadFilter();
      nf.type = "lowpass";
      nf.frequency.value = 1000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.45, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(master);
      n.start(t);
      n.stop(t + 0.35);
      break;
    }
    default:
      break;
  }
}

// ---------- Mưa: tiếng nền liên tục, âm lượng theo cường độ 0..1 từ engine ----------
let noiseBuffer = null;
function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const len = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}
let rainGain = null;
export function setRainIntensity(k) {
  if (!ctx) return;
  if (!rainGain) {
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.5;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    src.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(master);
    src.start();
  }
  rainGain.gain.setTargetAtTime(Math.max(0, Math.min(1, k)) * 0.25, ctx.currentTime, 0.4);
}

// mức tín hiệu hiện tại (RMS) — dùng để kiểm tra nhanh trong console
let analyser = null;
export function level() {
  if (!ctx) return -1;
  if (!analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
  }
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

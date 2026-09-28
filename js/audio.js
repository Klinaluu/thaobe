// Hiệu ứng âm thanh chiptune sinh bằng WebAudio — không cần file mp3.
// SFX: nhảy / nhảy đôi / bấm nút. (Không có nhạc nền theo yêu cầu.)

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
      break;
    case "jump2":
      tone("square", 480, 1100, t, 0.16, 0.12);
      tone("triangle", 240, 520, t, 0.16, 0.08);
      break;
    case "click":
      tone("square", 880, 880, t, 0.045, 0.1);
      tone("square", 1320, 1320, t + 0.05, 0.07, 0.09);
      break;
    default:
      break;
  }
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

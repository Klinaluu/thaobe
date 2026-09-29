// ============================================================
// MADE FOR US — engine (canvas 2D, physics đơn giản, kiểu Mario)
// Một con đường liền mạch, các pha (this.phase):
//   walk    : đi bộ nhặt chìa khoá + mũ rồi lên xe
//   solo    : chạy xe một mình, nhảy qua gạch/gai, nhặt 5 món quà (3 tim), boss "DOUBT"
//   meeting : gặp cô ấy ở cuối chặng solo → màn bầu trời sao
//   couple  : xe chở 2 người qua các mốc polaroid, đoạn mưa nhặt ô,
//             hòm hồng (System Message → lá thư) và hòm quà rơi xuống (video)
// ============================================================

const CW = 960;
const CH = 360;

const GRAVITY = 1900;
const MOVE_SPEED = 230;
const JUMP_VELOCITY = -680;

const SEG_W = 900;
const START_PAD = 120;
const WALK_PAD = 640; // đoạn đi bộ mở màn: nhặt chìa khoá + mũ rồi mới lên xe
const WALK_SPEED = 150;
const BLOCK = 44; // 1 viên gạch

const ITEM_SIZE = 40;
const ITEM_LOW_GAP = 100;
const ITEM_HIGH_GAP = 150;
const QBLOCK_GAP = 140; // đáy ô "?" cách mặt đường
const SPIKE_W = 22;
const SPIKE_H = 26;
const JUMP2_VELOCITY = -600; // nhảy đôi (lần 2 khi đang trên không)
const BOSS_ARENA_W = 760;
const BOSS_W = 116;
const BOSS_H = 64;
const BOSS_DODGES = 3;

const INVULN_TIME = 1.3;

// Trong file Road-Straight.png, vạch kẻ trắng nằm sâu bên trong ảnh (không phải ngay mép
// trên) — nếu vẽ ảnh chạm đúng mép trên vào groundY thì vạch kẻ lại nằm THẤP hơN mặt đất
// logic một đoạn, khiến nhân vật/cây/gai trông như lơ lửng phía trên vạch kẻ. Nâng cả dải
// đường lên để vạch kẻ mới là nơi thật sự trùng với groundY (nơi mọi thứ đang neo chân).
const LANE_LIFT = 29;
// Cây/hoa ven đường đứng trên dải lề phía trên của ảnh đường (cao hơn vạch kẻ bấy nhiêu px)
const PROP_KERB = 20;

const LEFT_KEYS = ["ArrowLeft", "a", "A"];
const RIGHT_KEYS = ["ArrowRight", "d", "D"];
const JUMP_KEYS = ["ArrowUp", "w", "W", " ", "Spacebar"];

// Khoảng chừa dưới mặt đường: đủ chỗ cho dải đường + gạch, và luôn cao hơn hàng nút
// cảm ứng (bottomInset, tính bằng px thế giới) để nhân vật không bị nút che.
function groundMarginFor(ch, bottomInset = 0) {
  const margin = Math.max(60, Math.min(ch * 0.16, 170), bottomInset);
  return Math.min(margin, ch * 0.42); // không để mặt đường bị đẩy lên quá cao
}
function ready(img) {
  if (!img) return false;
  if (img instanceof HTMLCanvasElement) return img.width > 0;
  return !!(img.complete && img.naturalWidth > 0);
}
// Hạt pixel chuẩn của game lấy theo nhân vật (~0.55 đơn vị thế giới / pixel art).
// Hình vẽ bằng code bám lưới 2 đơn vị — bước nhỏ nhất còn nhìn thấy được trên màn hình.
const PX = 2;
const q = (v) => Math.round(v / PX) * PX;

// Chữ vẽ trên canvas + font pixel cho chữ đó — main.js truyền vào theo ngôn ngữ máy
// (content.strings / content.titleFont), không truyền thì dùng tiếng Anh.
const STR_EN = {
  popCollectFirst: "Collect all 5 gifts first!", popForgot: "Forgot your {x}!", popRide: "Let's ride!",
  popDoubtCleared: "Doubt cleared ✦", popRainOver: "☂ Rain's over", gearKey: "Key", gearHelmet: "Helmet",
  itemUmbrella: "Umbrella", itemEgg: "Golden egg", promptOpen: "Open", bikeMine: "MY BIKE", bikeGo: "LET'S GO",
  bossDoubt: "DOUBT",
};
let STR = STR_EN;
let TITLE_FONT = "'Press Start 2P', monospace";

export class JourneyGame {
  constructor(canvas, content, images, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.CW = canvas.width || CW;
    this.CH = canvas.height || CH;
    this.bottomInset = content.bottomInset || 0;
    this.topInset = content.topInset || 0;
    this.groundY = this.CH - groundMarginFor(this.CH, this.bottomInset);
    this.images = images;
    this.cb = callbacks;
    this.content = content;
    STR = { ...STR_EN, ...(content.strings || {}) };
    if (content.titleFont) TITLE_FONT = content.titleFont;
    this._raf = null;
    this._destroyed = false;

    // ---- bố cục thế giới ----
    const solo = content.soloSegments;
    this.soloSegW = content.soloSegW || SEG_W;
    this.soloStart = START_PAD + WALK_PAD;
    this.soloSegments = solo.map((seg, i) => ({ ...seg, index: i, start: this.soloStart + i * this.soloSegW }));
    this.arenaStart = this.soloStart + solo.length * this.soloSegW + 40;
    this.arenaEnd = this.arenaStart + BOSS_ARENA_W;
    this.meetX = this.arenaEnd + 260;
    this.barrierX = this.meetX - 150;
    const coupleStart = this.meetX + 360;
    this.milestones = content.milestones.map((ms, j) => ({
      ...ms,
      index: j,
      start: coupleStart + j * SEG_W,
      polaroidX: coupleStart + j * SEG_W + 470,
    }));
    // hòm hồng nằm trong mốc có event "chest", hòm quà rơi trong mốc có event "gift"
    const chestMs = this.milestones.find((m) => m.event === "chest") || this.milestones[this.milestones.length - 1];
    const giftMs = this.milestones.find((m) => m.event === "gift") || this.milestones[this.milestones.length - 1];
    this.chestX = chestMs.start + 620;
    this.giftMs = giftMs;
    this.giftX = giftMs.start + 560;
    this.levelWidth = this.milestones[this.milestones.length - 1].start + SEG_W + 200;
    this.letterDone = false;

    // Khối đặc (gạch trên đường, bục lơ lửng, ô "?"): { x, top (so với mặt đường, dương = cao lên), w, h, kind }
    this.solids = [];
    this.spikes = []; // { x, w, base } base = độ cao chân gai so với mặt đường
    const grassScenes = new Set(content.grassScenes || []);
    const isGrass = (terrain) => grassScenes.has(String(terrain || "").replace("scene:", ""));
    this.items = [];
    this.heartBlocks = [];
    this.heartDrops = [];
    this.soloSegments.forEach((seg) => {
      (seg.blocks || []).forEach((b) => {
        const w = (b.w || 1) * BLOCK;
        const h = (b.h || 1) * BLOCK;
        this.solids.push({ x: seg.start + b.x, top: h, w, h, kind: "brick" });
      });
      (seg.platforms || []).forEach((pf) => {
        this.solids.push({
          x: seg.start + pf.x, top: pf.y, w: pf.w * BLOCK, h: BLOCK,
          kind: pf.breakable ? "breakable" : "platform", grass: isGrass(seg.terrain),
          baseX: seg.start + pf.x, baseTop: pf.y, move: pf.move || null, phase: Math.random() * 6.28,
        });
      });
      (seg.spikes || []).forEach((sp) => {
        this.spikes.push({ x: seg.start + sp.x, w: sp.n * SPIKE_W, base: sp.y || 0 });
      });
      if (seg.heartBlock) {
        const qb = { x: seg.start + seg.heartBlock.x, used: false, bounce: 0 };
        this.heartBlocks.push(qb);
        this.solids.push({ x: qb.x, top: QBLOCK_GAP + BLOCK, w: BLOCK, h: BLOCK, kind: "qblock", qb });
      }
      const def = content.items.find((it) => it.id === seg.item);
      this.items.push({
        id: seg.item,
        label: def ? def.label : seg.item,
        x: seg.start + seg.itemAt.x,
        gap: seg.itemAt.y ?? (seg.itemAt.high ? ITEM_HIGH_GAP : ITEM_LOW_GAP),
        collected: false,
        segIndex: seg.index,
      });
    });

    // chướng ngại + vật phẩm phụ (ô che mưa) trong các mốc của chương "đi cùng nhau"
    this.extras = [];
    this.rainMs = null;
    this.milestones.forEach((ms) => {
      (ms.blocks || []).forEach((b) => {
        this.solids.push({ x: ms.start + b.x, top: (b.h || 1) * BLOCK, w: (b.w || 1) * BLOCK, h: (b.h || 1) * BLOCK, kind: "brick" });
      });
      (ms.platforms || []).forEach((pf) => {
        this.solids.push({ x: ms.start + pf.x, top: pf.y, w: pf.w * BLOCK, h: BLOCK, kind: pf.breakable ? "breakable" : "platform", grass: isGrass(ms.terrain), baseX: ms.start + pf.x, baseTop: pf.y, move: pf.move || null, phase: 0 });
      });
      if (ms.event === "rain") {
        this.rainMs = ms;
        this.extras.push({ id: "umbrella", label: STR.itemUmbrella, x: ms.start + ms.itemAt.x, gap: ms.itemAt.y, collected: false, ms });
      }
      // điểm thưởng (id "egg", vẽ bằng assets/props/Egg-Gold.png = hình trái tim) rải dọc
      // đường, vài cái phải nhảy mới tới
      if (ms.event !== "chest" && ms.event !== "gift") {
        [[250, 40], [520, 130], [790, 60]].forEach(([dx, gap]) => {
          const x = ms.start + dx;
          const blocked = (ms.blocks || []).some((b) => Math.abs(ms.start + b.x - x) < 90) || (ms.platforms || []).some((pf) => Math.abs(ms.start + pf.x - x) < 120);
          if (!blocked) this.extras.push({ id: "egg", label: STR.itemEgg, x, gap, collected: false, ms });
        });
      }
    });

    // cảnh vật ven đường: rải ngẫu nhiên (cố định theo đoạn), tránh gai/khối/quà
    // VÀ tránh chồng tán lên cây/hoa khác đã đặt trước đó, để không bị dồn cụm.
    this.props = [];
    const sets = content.propSets || {};
    const propImg = images.props || {};
    const seeded = (n) => { let t = n * 9301 + 49297; return () => { t = (t * 9301 + 49297) % 233280; return t / 233280; }; };
    const avoid = [[180, 480], [520, 720], ...this.solids.map((s) => [s.x - 40, s.x + s.w + 40]), ...this.spikes.map((sp) => [sp.x - 30, sp.x + sp.w + 30]), ...this.items.map((it) => [it.x - 50, it.x + 90]), ...this.extras.map((e) => [e.x - 50, e.x + 90])];
    // bề ngang thật của prop (theo tỉ lệ ảnh gốc đã tải), dùng để canh khoảng hở —
    // cây to (tán rộng) cần khoảng cách xa hơn bụi cỏ/hoa nhỏ mới không đè lên nhau
    const propHalfW = (name, h) => {
      const im = propImg[name];
      const ratio = im && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
      return (h * ratio) / 2;
    };
    const PROP_GAP = 18; // khoảng hở tối thiểu thêm giữa 2 tán, ngoài phần bề ngang của chính nó
    const scatter = (start, width, terrain, seed, density) => {
      const set = isGrass(terrain) ? sets.nature : sets.city;
      if (!set || !set.length) return;
      const rnd = seeded(seed);
      for (let i = 0; i < density; i++) {
        for (let attempt = 0; attempt < 16; attempt++) {
          const x = start + 40 + rnd() * (width - 120);
          if (avoid.some(([a, b]) => x > a && x < b)) continue;
          const [name, h] = set[Math.floor(rnd() * set.length)];
          const halfW = propHalfW(name, h);
          const crowded = this.props.some((pr) => Math.abs(pr.x - x) < halfW + propHalfW(pr.name, pr.h) + PROP_GAP);
          if (crowded) continue;
          this.props.push({ name, x, h, flip: rnd() < 0.5 });
          break;
        }
      }
    };
    scatter(0, WALK_PAD + START_PAD, content.walkTerrain, 7, 5);
    this.soloSegments.forEach((seg) => scatter(seg.start, this.soloSegW, seg.terrain, seg.index + 11, 7));
    scatter(this.arenaStart - 40, this.meetX - this.arenaStart + 300, content.bossTerrain, 31, 4);
    this.milestones.forEach((ms) => scatter(ms.start, SEG_W, ms.terrain, ms.index + 51, 8));
    this.rain = 0; // 0..1 cường độ mưa hiện tại
    this._rideFx = 0;

    // đoạn đi bộ: chìa khoá trên đường, mũ trên 1 viên gạch (tập nhảy), xe trùm bạt ở cuối
    this.gear = [
      { id: "key", label: STR.gearKey, x: 230, gap: 28, collected: false },
      { id: "helmet", label: STR.gearHelmet, x: 404, gap: 62, collected: false },
    ];
    this.solids.push({ x: 400, top: BLOCK, w: BLOCK, h: BLOCK, kind: "brick" });
    this.bikeX = 560;

    this.player = { x: 40, y: this.groundY - 74, w: 74, h: 74, vx: 0, vy: 0, onGround: true, facing: 1, animT: 0, jumpsLeft: 2, standingOn: null };
    this.score = 0;
    this.timeSolo = 0; // giây, chỉ đếm trong chương 1
    this.boss = { active: false, defeated: false, x: 0, dir: -1, speed: 210, dodges: 0, passed: false, hitThisPass: false, t: 0 };
    this.hearts = content.maxHearts;
    this.invuln = 0;
    this.phase = "walk"; // walk | solo | meeting | couple | chest | gift | done
    this.chest = { opened: false };
    this.gift = { active: false, y: -140, vy: 0, landed: false, opened: false };
    this.prompt = null;
    this.popups = [];
    this.particles = [];
    this.shake = 0;
    this.hitFlash = 0;
    this.camX = 0;
    this.keys = {};
    this.jumpLatch = false;
    this.paused = false;
    this.t = 0;
    this._milestoneIndex = -1;
    this._hintShown = false;
    this._wasAirborne = false;
    this._wasInRain = false;

    this._bindInput();
  }

  _bindInput() {
    this._keydown = (e) => {
      if ([...LEFT_KEYS, ...RIGHT_KEYS, ...JUMP_KEYS].includes(e.key)) e.preventDefault();
      this.keys[e.key] = true;
    };
    this._keyup = (e) => {
      this.keys[e.key] = false;
    };
    window.addEventListener("keydown", this._keydown);
    window.addEventListener("keyup", this._keyup);
  }
  pressKey(name) {
    this.keys[name] = true;
  }
  releaseKey(name) {
    this.keys[name] = false;
  }

  resize(newWidth, newHeight, bottomInset, topInset) {
    if (!newWidth || !newHeight) return;
    if (bottomInset != null) this.bottomInset = bottomInset;
    if (topInset != null) this.topInset = topInset;
    if (newWidth === this.CW && newHeight === this.CH && bottomInset == null && topInset == null) return;
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.CW = newWidth;
    this.CH = newHeight;
    this.groundY = newHeight - groundMarginFor(newHeight, this.bottomInset);
    const floor = this.groundY - this.player.h;
    if (this.player.onGround || this.player.y > floor) {
      this.player.y = floor;
      this.player.vy = 0;
      this.player.onGround = true;
    }
  }

  destroy() {
    this._destroyed = true;
    window.removeEventListener("keydown", this._keydown);
    window.removeEventListener("keyup", this._keyup);
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  start() {
    let last = performance.now();
    const loop = (t) => {
      if (this._destroyed) return;
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;
      if (!this.paused) this.update(dt);
      else this._updateFx(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  gearReady() {
    return this.gear.every((g) => g.collected);
  }
  collectedCount() {
    return this.items.filter((it) => it.collected).length;
  }
  allCollected() {
    return this.items.every((it) => it.collected);
  }
  currentSoloIndex() {
    const i = Math.floor((this.player.x - this.soloStart) / this.soloSegW);
    return Math.max(0, Math.min(this.soloSegments.length - 1, i));
  }
  currentMilestoneIndex() {
    if (!this.milestones.length) return -1;
    const j = Math.floor((this.player.x - this.milestones[0].start) / SEG_W);
    return Math.max(-1, Math.min(this.milestones.length - 1, j));
  }

  retrySegment() {
    const seg = this.soloSegments[this.currentSoloIndex()];
    this.player.x = seg.start;
    if (this.boss.active) {
      // chết giữa trận boss: đặt lại đầu sân, boss thu về chờ
      this.boss = { ...this.boss, active: false, dodges: 0, speed: 210, hitThisPass: false };
      this.player.x = this.arenaStart - 60;
    }
    this.player.y = this.groundY - this.player.h;
    this.player.vy = 0;
    this.player.onGround = true;
    this.hearts = this.content.maxHearts;
    this.invuln = 1;
    this.paused = false;
    this.cb.onHearts(this.hearts);
  }

  beginCouple() {
    this.phase = "couple";
    this.paused = false;
    this.player.w = 100;
    this.player.x = this.meetX + 40;
    this._burst(this.meetX, this.groundY - 60, 18, ["#ff6fa0", "#fff", "#ffd6e4"]);
  }

  // sau khi đọc thư ở hòm hồng: mở đường đi tiếp tới mốc cuối
  resumeJourney() {
    this.letterDone = true;
    this.phase = "couple";
    this.paused = false;
    this.prompt = null;
  }

  dropGift() {
    this.phase = "gift";
    this.gift = { active: true, y: -140, vy: 0, landed: false, opened: false };
    this.paused = false;
  }

  finish() {
    this.phase = "done";
    this.paused = true;
  }

  interact() {
    if (this.paused || !this.prompt) return false;
    if (this.phase === "chest" && !this.chest.opened) {
      this.chest.opened = true;
      this.prompt = null;
      this.paused = true;
      this._burst(this.chestX + 32, this.groundY - 40, 16, ["#fff", "#ffd6e4", "#f2c94c"]);
      this.cb.onChest();
      return true;
    }
    if (this.phase === "gift" && this.gift.landed && !this.gift.opened) {
      this.gift.opened = true;
      this.prompt = null;
      this.paused = true;
      this._burst(this.giftX + 32, this.groundY - 40, 20, ["#fff", "#ffb6cf", "#f2c94c"]);
      this.cb.onGift();
      return true;
    }
    return false;
  }

  // ---------- hiệu ứng ----------
  _riding() {
    const p = this.player;
    return this.phase !== "walk" && p.onGround && Math.abs(p.vx) > 1 && !this.paused;
  }
  _burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.5 + Math.random() * 0.5,
        color: colors[i % colors.length],
        size: 3 + Math.floor(Math.random() * 3),
        gravity: 500,
      });
    }
  }
  _dust(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: -30 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.2,
        color: "rgba(255,255,255,0.7)",
        size: 4,
        gravity: 200,
      });
    }
  }
  // mất 1 tim, bật ngược về hướng dir (-1 trái / +1 phải), bất tử ngắn
  _hurt(dir) {
    const p = this.player;
    this.hearts -= 1;
    this.invuln = INVULN_TIME;
    this.shake = 0.35;
    this.hitFlash = 0.3;
    p.x += dir * 36;
    p.vy = -380;
    p.onGround = false;
    p.jumpsLeft = 1;
    this._burst(p.x + p.w / 2, p.y + p.h / 2, 10, ["#e8615f", "#fff"]);
    this.popups.push({ x: p.x + p.w / 2, y: p.y, vy: -40, life: 0.8, text: "-1", color: "#e8615f" });
    this.cb.onHearts(this.hearts);
    if (this.hearts <= 0) {
      this.paused = true;
      this.cb.onGameOver();
    }
  }
  _addScore(n, x, y) {
    this.score += n;
    if (x !== undefined) this.popups.push({ x, y, vy: -50, life: 0.9, text: "+" + n, color: "#f2c94c" });
    this.cb.onScore && this.cb.onScore(this.score);
  }
  _updateFx(dt) {
    this.t += dt;
    for (const p of this.particles) {
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const pop of this.popups) {
      pop.y += pop.vy * dt;
      pop.life -= dt;
    }
    this.popups = this.popups.filter((pop) => pop.life > 0);
    if (this.shake > 0) this.shake -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // ---------- vòng lặp ----------
  update(dt) {
    if (this.phase === "done") return;
    this._updateFx(dt);
    const p = this.player;
    const left = LEFT_KEYS.some((k) => this.keys[k]);
    const right = RIGHT_KEYS.some((k) => this.keys[k]);
    const jump = JUMP_KEYS.some((k) => this.keys[k]);

    // nhảy theo "nhấn" (không giữ): lần 1 từ mặt đất/bục, lần 2 khi đang trên không = nhảy đôi
    if (jump && !this.jumpLatch) {
      this.jumpLatch = true;
      if (this.prompt && p.onGround && this.interact()) return;
      if (p.onGround) {
        p.vy = JUMP_VELOCITY;
        p.onGround = false;
        p.jumpsLeft = 1;
        this.cb.onJump && this.cb.onJump(1);
      } else if (p.jumpsLeft > 0) {
        p.vy = JUMP2_VELOCITY;
        p.jumpsLeft = 0;
        this._dust(p.x + p.w / 2, p.y + p.h);
        this.cb.onJump && this.cb.onJump(2);
      }
    }
    if (!jump) this.jumpLatch = false;

    const speed = this.phase === "walk" ? WALK_SPEED : MOVE_SPEED;
    p.vx = 0;
    if (left) {
      p.vx = -speed;
      p.facing = -1;
    }
    if (right) {
      p.vx = speed;
      p.facing = 1;
    }

    if (this.phase === "solo" || this.phase === "walk") this.timeSolo += dt;

    // bục di chuyển: cập nhật vị trí, và "chở" người chơi đang đứng trên nó
    for (const s of this.solids) {
      if (!s.move || s.dead) continue;
      const k = 0.5 + 0.5 * Math.sin(this.t * s.move.speed + s.phase);
      const nx = s.baseX + (s.move.dx || 0) * k;
      const ntop = s.baseTop + (s.move.dy || 0) * k;
      if (p.standingOn === s) {
        p.x += nx - s.x;
        p.y -= ntop - s.top;
      }
      s.x = nx;
      s.top = ntop;
    }

    let prevX = p.x;
    let prevY = p.y;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let maxX = this.levelWidth - p.w - 10;
    let minX = 10;
    if (this.phase === "solo" && !(this.allCollected() && this.boss.defeated)) maxX = this.barrierX - p.w;
    if (this.phase === "walk" && !this.gearReady()) maxX = this.bikeX - p.w - 16;
    if (this.boss.active && !this.boss.defeated) {
      minX = this.arenaStart - 20;
      maxX = this.arenaEnd - p.w + 20;
    }
    if (this.phase === "chest") maxX = this.chestX - p.w - 14;
    if (this.phase === "gift") maxX = this.giftX - p.w - 14;
    // mưa Nha Trang: chưa nhặt ô thì không qua được cuối đoạn
    if (this.phase === "couple" && this.rainMs) {
      const um = this.extras.find((e) => e.id === "umbrella");
      if (um && !um.collected && p.x > this.rainMs.start + 200) maxX = Math.min(maxX, this.rainMs.start + SEG_W - 120 - p.w);
    }
    if (p.x > maxX) {
      if (this.phase === "solo" && !this.allCollected() && !this._hintShown) {
        this._hintShown = true;
        this.popups.push({ x: p.x + p.w / 2, y: p.y - 10, vy: -30, life: 2.2, text: STR.popCollectFirst, color: "#e0538a" });
        setTimeout(() => (this._hintShown = false), 2500);
      }
      if (this.phase === "walk" && !this._hintShown) {
        this._hintShown = true;
        const missing = this.gear.filter((g) => !g.collected).map((g) => g.label.toLowerCase()).join(" & ");
        this.popups.push({ x: p.x + p.w / 2, y: p.y - 10, vy: -30, life: 2.2, text: STR.popForgot.replace("{x}", missing), color: "#e0538a" });
        setTimeout(() => (this._hintShown = false), 2500);
      }
      p.x = maxX;
    }
    p.x = Math.max(minX, p.x);

    const wasAirborne = !p.onGround;
    const floor = this.groundY - p.h;
    p.onGround = false;
    if (p.y >= floor) {
      p.y = floor;
      p.vy = 0;
      p.onGround = true;
    }

    // ---- khối đặc: đứng lên nóc, đội đầu từ dưới, chặn ngang (kiểu Mario) ----
    if (this.phase === "solo" || this.phase === "walk" || this.phase === "couple") {
      p.standingOn = null;
      for (const s of this.solids) {
        if (s.dead) continue;
        const top = this.groundY - s.top;
        const bottom = top + s.h;
        const overlap = p.x < s.x + s.w && p.x + p.w > s.x && p.y < bottom && p.y + p.h > top;
        if (!overlap) continue;
        const prevBottom = prevY + p.h;
        if (p.vy >= 0 && prevBottom <= top + 2) {
          p.y = top - p.h;
          p.vy = 0;
          p.onGround = true;
          p.standingOn = s;
        } else if (p.vy < 0 && prevY >= bottom - 2) {
          p.y = bottom;
          p.vy = 120;
          if (s.kind === "breakable") {
            // gạch vỡ: đội từ dưới là tan thành mảnh
            s.dead = true;
            this.shake = 0.12;
            for (let i = 0; i < 10; i++) {
              this.particles.push({ x: s.x + Math.random() * s.w, y: top + Math.random() * s.h, vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 220, life: 0.6 + Math.random() * 0.4, color: i % 3 ? "#c9764f" : "#8a4b2a", size: 6, gravity: 900 });
            }
            this._addScore(20, s.x + s.w / 2, top - 6);
          }
          if (s.kind === "qblock" && !s.qb.used) {
            const qb = s.qb;
            qb.used = true;
            qb.bounce = 1;
            this.heartDrops.push({ x: qb.x + BLOCK / 2, y: top, vy: -140, t: 0, restX: qb.x + BLOCK + 60, collected: false });
            this._burst(qb.x + BLOCK / 2, top, 10, ["#fff", "#f2c94c"]);
            this._addScore(50, qb.x + BLOCK / 2, top - 10);
          }
        } else if (prevX + p.w <= s.x + 2) {
          p.x = s.x - p.w;
        } else if (prevX >= s.x + s.w - 2) {
          p.x = s.x + s.w;
        } else {
          p.y = top - p.h;
          p.vy = 0;
          p.onGround = true;
        }
      }
      for (const qb of this.heartBlocks) if (qb.bounce > 0) qb.bounce -= dt * 4;

      // ---- bẫy gai: chạm là mất tim, bật ngược lại ----
      if (this.invuln <= 0) {
        for (const sp of this.spikes) {
          const top = this.groundY - sp.base - SPIKE_H;
          const bottom = this.groundY - sp.base;
          const hit = p.x + 12 < sp.x + sp.w && p.x + p.w - 12 > sp.x && p.y + p.h > top + 6 && p.y < bottom;
          if (!hit) continue;
          this._hurt(p.x + p.w / 2 < sp.x + sp.w / 2 ? -1 : 1);
          if (this.hearts <= 0) return;
          break;
        }
      }

      // đoạn đi bộ: nhặt chìa + mũ, tới xe là lên xe
      if (this.phase === "walk") {
        for (const ge of this.gear) {
          if (ge.collected) continue;
          const bottom = this.groundY - ge.gap;
          const overlap = p.x < ge.x + ITEM_SIZE && p.x + p.w > ge.x && p.y < bottom && p.y + p.h > bottom - ITEM_SIZE;
          if (overlap) {
            ge.collected = true;
            this._burst(ge.x + ITEM_SIZE / 2, bottom - ITEM_SIZE / 2, 12, ["#fff", "#f2c94c"]);
            this.popups.push({ x: ge.x + ITEM_SIZE / 2, y: bottom - ITEM_SIZE, vy: -45, life: 1.2, text: ge.label + " ✓", color: "#e0538a" });
            this.cb.onGear && this.cb.onGear(ge, this.gearReady());
          }
        }
        if (this.gearReady() && p.x + p.w >= this.bikeX + 30) {
          this.phase = "solo";
          p.x = this.bikeX + 10;
          p.onGround = true;
          for (let i = 0; i < 18; i++) {
            this.particles.push({ x: this.bikeX + Math.random() * 110, y: this.groundY - 20 - Math.random() * 40, vx: (Math.random() - 0.5) * 200, vy: -200 - Math.random() * 200, life: 0.7 + Math.random() * 0.5, color: i % 2 ? "#ffb6cf" : "#ff8fb8", size: 6, gravity: 500 });
          }
          this._dust(p.x + p.w / 2, this.groundY);
          this.shake = 0.15;
          this.popups.push({ x: p.x + p.w / 2, y: p.y - 16, vy: -35, life: 1.6, text: STR.popRide, color: "#e0538a" });
          this.cb.onMount && this.cb.onMount();
        }
      }

      if (this.phase === "couple") { /* chương 2: không có quà/boss */ } else {
      for (const it of this.items) {
        if (it.collected) continue;
        const bottom = this.groundY - it.gap;
        const overlap = p.x < it.x + ITEM_SIZE && p.x + p.w > it.x && p.y < bottom && p.y + p.h > bottom - ITEM_SIZE;
        if (overlap) {
          it.collected = true;
          this._burst(it.x + ITEM_SIZE / 2, bottom - ITEM_SIZE / 2, 16, ["#fff", "#ffd6e4", "#ff6fa0", "#f2c94c"]);
          this.popups.push({ x: it.x + ITEM_SIZE / 2, y: bottom - ITEM_SIZE, vy: -45, life: 1.2, text: "+ " + it.label, color: "#e0538a" });
          this._addScore(100);
          this.cb.onItem(it, this.collectedCount(), this.items.length);
        }
      }

      for (const hd of this.heartDrops) {
        if (hd.collected) continue;
        hd.t += dt;
        // bung lên khỏi ô rồi rơi xuống bên phải ô, lơ lửng sát mặt đường để chạy qua là nhặt
        if (hd.t < 0.3) hd.y += hd.vy * dt;
        else {
          hd.x += (hd.restX - hd.x) * Math.min(1, dt * 5);
          hd.y += (this.groundY - 26 - hd.y) * Math.min(1, dt * 5);
        }
        const hy = hd.y + Math.sin(hd.t * 4) * 4;
        const overlap = p.x < hd.x + 16 && p.x + p.w > hd.x - 16 && p.y < hy + 16 && p.y + p.h > hy - 16;
        if (overlap && hd.t > 0.3) {
          hd.collected = true;
          this.hearts = Math.min(this.content.maxHearts, this.hearts + 1);
          this._burst(hd.x, hy, 14, ["#ff6fa0", "#fff", "#ffb6cf"]);
          this.popups.push({ x: hd.x, y: hy - 20, vy: -45, life: 1, text: "+1 ♥", color: "#e0538a" });
          this.cb.onHearts(this.hearts);
        }
      }

      // ---- boss nhỏ: đám mây nghi ngờ lao qua lao lại, nhảy qua 3 lần để xua tan ----
      const b = this.boss;
      if (!b.active && !b.defeated && this.allCollected() && p.x + p.w / 2 >= this.arenaStart + 120) {
        b.active = true;
        b.x = this.arenaEnd - BOSS_W - 20;
        b.dir = -1;
        b.speed = 210;
        b.dodges = 0;
        this.shake = 0.25;
        this.cb.onBoss && this.cb.onBoss("start", b);
      }
      if (b.active && !b.defeated) {
        b.t += dt;
        const before = b.x + BOSS_W / 2 - (p.x + p.w / 2);
        b.x += b.dir * b.speed * dt;
        const after = b.x + BOSS_W / 2 - (p.x + p.w / 2);
        const top = this.groundY - BOSS_H;
        const hit = p.x + 10 < b.x + BOSS_W - 10 && p.x + p.w - 10 > b.x + 10 && p.y + p.h > top + 10;
        if (hit && this.invuln <= 0) {
          b.hitThisPass = true;
          this._hurt(b.dir > 0 ? 1 : -1);
          if (this.hearts <= 0) return;
        }
        // lướt qua người chơi mà không chạm = 1 lần né thành công
        if (before * after < 0) {
          if (!b.hitThisPass) {
            b.dodges += 1;
            this._addScore(100, p.x + p.w / 2, p.y - 10);
            this.popups.push({ x: p.x + p.w / 2, y: p.y - 30, vy: -40, life: 1, text: `${b.dodges}/${BOSS_DODGES}`, color: "#fff" });
            this.cb.onBoss && this.cb.onBoss("dodge", b);
          }
          b.hitThisPass = false;
          if (b.dodges >= BOSS_DODGES) {
            b.defeated = true;
            b.active = false;
            this._burst(b.x + BOSS_W / 2, top + BOSS_H / 2, 30, ["#fff", "#cfc4e6", "#ffb6cf", "#f2c94c"]);
            this.popups.push({ x: b.x + BOSS_W / 2, y: top - 10, vy: -30, life: 2, text: STR.popDoubtCleared, color: "#fff" });
            this._addScore(300);
            this.shake = 0.3;
            this.cb.onBoss && this.cb.onBoss("defeated", b);
          }
        }
        if (b.dir < 0 && b.x < this.arenaStart - 40) {
          b.dir = 1;
          b.speed += 45;
          b.hitThisPass = false;
          this.shake = 0.15;
        } else if (b.dir > 0 && b.x + BOSS_W > this.arenaEnd + 40) {
          b.dir = -1;
          b.speed += 45;
          b.hitThisPass = false;
          this.shake = 0.15;
        }
      }

      if (this.allCollected() && this.boss.defeated && p.x + p.w >= this.meetX - 50) {
        this.phase = "meeting";
        this.paused = true;
        p.x = this.meetX - 50 - p.w;
        p.vx = 0;
        this.cb.onMeet();
        return;
      }
      }
    }

    if (wasAirborne && p.onGround) this._dust(p.x + p.w / 2, p.y + p.h);
    if (p.onGround) p.jumpsLeft = 2;
    p.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;

    // xe đang chạy: khói ống xả + bụi bánh sau — cho xe trông đang chạy kể cả khi chỉ có 1 ảnh
    if (this._riding()) {
      this._rideFx -= dt;
      if (this._rideFx <= 0) {
        this._rideFx = 0.07;
        const back = -p.facing;
        const tail = p.x + p.w / 2 + back * 44;
        this.particles.push({ x: tail, y: this.groundY - 18 - Math.random() * 4, vx: back * (40 + Math.random() * 40), vy: -18 - Math.random() * 22, life: 0.5, color: "rgba(236,232,242,0.8)", size: 5, gravity: -40 });
        if (Math.random() < 0.6) {
          this.particles.push({ x: tail + back * 4, y: this.groundY - 4, vx: back * (70 + Math.random() * 60), vy: -40 - Math.random() * 50, life: 0.3, color: "rgba(206,188,168,0.85)", size: 3, gravity: 320 });
        }
      }
    }

    if (this.phase === "couple") {
      const j = this.currentMilestoneIndex();
      if (j !== this._milestoneIndex) {
        this._milestoneIndex = j;
        if (j >= 0) this.cb.onMilestone(this.milestones[j], j);
      }
      // ô che mưa
      for (const ex of this.extras) {
        if (ex.collected) continue;
        const bottom = this.groundY - ex.gap;
        const overlap = p.x < ex.x + ITEM_SIZE && p.x + p.w > ex.x && p.y < bottom && p.y + p.h > bottom - ITEM_SIZE;
        if (overlap) {
          ex.collected = true;
          if (ex.id === "egg") {
            this._burst(ex.x + ITEM_SIZE / 2, bottom - ITEM_SIZE / 2, 10, ["#fff", "#f2c94c"]);
            this._addScore(50, ex.x + ITEM_SIZE / 2, bottom - ITEM_SIZE);
          } else {
            this._burst(ex.x + ITEM_SIZE / 2, bottom - ITEM_SIZE / 2, 16, ["#fff", "#ffd6e4", "#ff6fa0"]);
            this.popups.push({ x: ex.x + ITEM_SIZE / 2, y: bottom - ITEM_SIZE, vy: -45, life: 1.4, text: STR.popRainOver, color: "#e0538a" });
            this._addScore(150);
          }
          this.cb.onExtra && this.cb.onExtra(ex);
        }
      }
      if (!this.letterDone && p.x + p.w >= this.chestX - 140) {
        this.phase = "chest";
      }
      if (this.letterDone && !this.gift.active && p.x + p.w / 2 >= this.giftMs.start + 80) {
        this.dropGift();
      }
    }
    // cường độ mưa: mưa khi trong mốc "rain" mà chưa có ô
    {
      const um = this.extras.find((e) => e.id === "umbrella");
      const inRain = this.rainMs && um && !um.collected && p.x + p.w / 2 >= this.rainMs.start - 60 && p.x < this.rainMs.start + SEG_W;
      if (inRain && !this._wasInRain && this.cb.onThunder) this.cb.onThunder(); // sấm báo hiệu lúc vừa vào mốc mưa
      this._wasInRain = inRain;
      const target = inRain ? 1 : 0;
      this.rain += (target - this.rain) * Math.min(1, dt * 1.5);
      if (this.cb.onRain) this.cb.onRain(this.rain);
    }

    this.prompt = null;
    if (this.phase === "chest" && !this.chest.opened) {
      if (Math.abs(p.x + p.w - this.chestX) < 60) this.prompt = { x: this.chestX + 32, y: this.groundY - 80, text: STR.promptOpen };
    }
    if (this.phase === "gift" && this.gift.active) {
      const g = this.gift;
      if (!g.landed) {
        g.vy += GRAVITY * 0.55 * dt;
        g.y += g.vy * dt;
        const floorY = this.groundY - 44;
        if (g.y >= floorY) {
          g.y = floorY;
          g.landed = true;
          this.shake = 0.2;
          this._dust(this.giftX + 32, this.groundY);
          this._burst(this.giftX + 32, this.groundY - 30, 12, ["#fff", "#ffb6cf"]);
        }
      } else if (!g.opened && Math.abs(p.x + p.w - this.giftX) < 60) {
        this.prompt = { x: this.giftX + 32, y: this.groundY - 80, text: STR.promptOpen };
      }
    }

    this.camX = Math.max(0, Math.min(p.x + p.w / 2 - this.CW / 2, this.levelWidth - this.CW));
  }

  // ---------- vẽ ----------
  render() {
    const ctx = this.ctx;
    const img = this.images;
    const refX = this.camX + this.CW / 2;
    const { sky, terrain, terrain2, blend } = this._sceneAt(refX);

    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 14;
      ctx.translate(q((Math.random() - 0.5) * s), q((Math.random() - 0.5) * s));
    }

    const g = ctx.createLinearGradient(0, 0, 0, this.CH);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, this.CW + 40, this.CH + 40);

    drawTerrain(ctx, terrain, img, this.camX, this.groundY, this.CW);
    if (terrain2 && blend > 0) {
      // crossfade sang cảnh kế tiếp
      ctx.save();
      ctx.globalAlpha = blend;
      drawTerrain(ctx, terrain2, img, this.camX, this.groundY, this.CW);
      ctx.restore();
    }
    drawGroundStrip(ctx, this.camX, this.groundY, this.CW, this.CH);

    ctx.save();
    ctx.translate(-this.camX, 0);

    drawRoad(ctx, img.road, this.camX, this.CW, this.groundY, this.CH);
    drawBrickGround(ctx, img.brickRow, this.camX, this.CW, this.groundY, this.CH);

    for (const pr of this.props) {
      if (pr.x < this.camX - 200 || pr.x > this.camX + this.CW + 200) continue;
      drawProp(ctx, img.props && img.props[pr.name], pr, this.groundY);
    }
    for (const sd of this.solids) {
      if (sd.kind === "qblock" || sd.dead) continue;
      if (sd.grass && sd.kind === "platform") {
        drawGrassPlatform(ctx, img, sd.x, this.groundY - sd.top, sd.w);
        continue;
      }
      drawBricks(ctx, img.brick, sd.x, this.groundY - sd.top + sd.h, sd.w, sd.h);
      if (sd.kind === "breakable") drawCracks(ctx, sd.x, this.groundY - sd.top, sd.w, sd.h);
    }
    if (this.boss.active && !this.boss.defeated) drawBoss(ctx, img.cloud, this.boss, this.groundY, this.t);
    for (const sp of this.spikes) drawSpikes(ctx, sp.x, this.groundY - sp.base, sp.w);
    for (const qb of this.heartBlocks) {
      const bob = qb.used ? 0 : Math.sin(this.t * 3) * 2;
      const kick = qb.bounce > 0 ? -qb.bounce * 14 : 0;
      const top = this.groundY - QBLOCK_GAP - BLOCK + bob + kick;
      const im = qb.used ? img.blockUsed : img.blockSurprise;
      if (ready(im)) ctx.drawImage(im, qb.x, top, BLOCK, BLOCK);
      else {
        ctx.fillStyle = qb.used ? "#c98a5a" : "#ffcf4d";
        ctx.fillRect(qb.x, top, BLOCK, BLOCK);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.strokeRect(qb.x + 1.5, top + 1.5, BLOCK - 3, BLOCK - 3);
      }
    }
    for (const hd of this.heartDrops) {
      if (hd.collected) continue;
      const hy = hd.y + Math.sin(hd.t * 4) * 4;
      if (ready(img.itemHeart)) ctx.drawImage(img.itemHeart, hd.x - 16, hy - 16, 32, 32);
      else {
        ctx.fillStyle = "#ff6fa0";
        ctx.fillRect(hd.x - 12, hy - 12, 24, 24);
      }
    }
    for (const it of this.items) {
      if (it.collected) continue;
      drawItem(ctx, img.pickup[it.id], it.id, it.x, this.groundY - it.gap, ITEM_SIZE, this.t, this.groundY);
    }
    if (this.phase === "walk") {
      drawCoveredBike(ctx, img.bikeIdle, this.bikeX, this.groundY, this.t, this.gearReady());
      for (const ge of this.gear) {
        if (ge.collected) continue;
        drawItem(ctx, img.gear[ge.id], ge.id, ge.x, this.groundY - ge.gap, ITEM_SIZE, this.t, this.groundY, ge.id === "key" ? 0.6 : 0.9);
      }
    }
    if (this.phase === "solo") drawWoman(ctx, img.woman, this.meetX, this.groundY, this.t, false);
    if (this.phase === "meeting") drawWoman(ctx, img.womanCheer[Math.floor(this.t * 4) % 2], this.meetX, this.groundY, this.t, true);

    // Khung polaroid treo ngay dưới thanh HUD (dây đủ dài để không bị thanh đè lên, xem
    // topInset) và to hết mức chiều cao còn trống phía trên mặt đường cho phép — màn hình
    // càng cao (laptop) khung càng to, màn thấp (điện thoại nằm ngang) thì tự nhỏ lại,
    // không bao giờ đè lên xe/HUD dưới đường.
    const polaroidTop = Math.max(30, this.topInset);
    const polaroidMax = Math.max(150, Math.min(280, this.groundY - polaroidTop - 70));
    for (const ms of this.milestones) {
      const photo = img.polaroids[ms.index];
      if (!photo && !this.content.emptyPolaroids) continue; // mốc không có ảnh thì không treo khung
      if (ms.polaroidX < this.camX - 300 || ms.polaroidX > this.camX + this.CW + 300) continue;
      drawPolaroid(ctx, photo, ms.date, ms.polaroidX, polaroidTop, this.t, ms.index, ms.name, this.content.photoPlaceholder, polaroidMax);
    }

    for (const ex of this.extras) {
      if (ex.collected) continue;
      drawItem(ctx, ex.id === "egg" ? img.egg : null, ex.id, ex.x, this.groundY - ex.gap, ITEM_SIZE, this.t, this.groundY, ex.id === "egg" ? 0.8 : 1);
    }
    drawChest(ctx, this.chestX, this.groundY - 44, this.chest.opened, this.t, false);
    if (this.gift.active) drawChest(ctx, this.giftX, this.gift.y, this.gift.opened, this.t, true);

    if (this.prompt) drawPrompt(ctx, this.prompt.x, this.prompt.y, this.prompt.text, this.t);

    const solo = this.phase === "solo" || this.phase === "meeting";
    const blink = this.invuln > 0 && Math.floor(this.t * 12) % 2 === 0;
    let sprite = img.playerSolo;
    if (this.phase === "walk") {
      const frames = img.walkFrames || [];
      const moving = Math.abs(this.player.vx) > 1 && !this.paused && this.player.onGround;
      sprite = frames[moving ? Math.floor(this.player.animT * 7) % frames.length : 0] || frames[0];
    } else if (!solo) {
      const frames = img.coupleFrames || [];
      const moving = Math.abs(this.player.vx) > 1 && !this.paused;
      sprite = frames[moving ? Math.floor(this.player.animT * 8) % frames.length : 0] || frames[0];
    }
    // Cảnh có xe máy (một mình hoặc đi đôi) vẽ to hơn nhân vật đi bộ, vẫn neo bánh xe xuống đất
    const bikeScene = this.phase !== "walk";
    const riding = this._riding();
    if (riding) drawSpeedLines(ctx, this.player, this.groundY, this.t);
    // rung máy 1px khi đang chạy
    const rumble = riding ? Math.floor(this.player.animT * 28) % 2 : 0;
    drawPlayer(ctx, this.player, sprite, 0, blink, this.groundY, bikeScene ? 100 : undefined, bikeScene ? 2 - rumble : 0);

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / 0.3));
      ctx.fillStyle = pt.color;
      ctx.fillRect(q(pt.x), q(pt.y), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, pop.life / 0.6));
      ctx.font = "bold 15px 'Be Vietnam Pro', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
    ctx.restore();

    if (this.rain > 0.01) drawRainOverlay(ctx, this.rain, this.camX, this.CW, this.CH, this.t);

    // vignette + chớp đỏ khi mất tim
    const vg = ctx.createRadialGradient(this.CW / 2, this.CH * 0.55, this.CW * 0.35, this.CW / 2, this.CH * 0.55, this.CW * 0.85);
    vg.addColorStop(0, "rgba(40,20,35,0)");
    vg.addColorStop(1, "rgba(40,20,35,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(-20, -20, this.CW + 40, this.CH + 40);
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(232,97,95,${(this.hitFlash / 0.3) * 0.35})`;
      ctx.fillRect(-20, -20, this.CW + 40, this.CH + 40);
    }
    ctx.restore();

    if (this.paused && this.phase !== "done") {
      ctx.fillStyle = "rgba(40,20,35,0.22)";
      ctx.fillRect(0, 0, this.CW, this.CH);
    }
  }

  _sceneAt(x) {
    const stops = [];
    const c = this.content;
    stops.push({ x: 0, sky: ["#3b2a5a", "#b57aa8"], terrain: c.walkTerrain || this.soloSegments[0].terrain });
    // đoạn solo đầu lùi mốc cảnh thêm 240 để lúc đi bộ (refX = tâm màn hình) chưa dính fade
    this.soloSegments.forEach((s, i) => stops.push({ x: s.start + (i === 0 ? 240 : 0), sky: s.sky, terrain: s.terrain }));
    const last = this.soloSegments[this.soloSegments.length - 1];
    stops.push({ x: this.arenaStart - 100, sky: last.sky, terrain: c.bossTerrain || last.terrain });
    stops.push({ x: this.arenaEnd + 40, sky: ["#f7b46a", "#f08a3c"], terrain: c.meetTerrain || last.terrain });
    this.milestones.forEach((m) => stops.push({ x: m.start, sky: m.sky, terrain: m.terrain }));
    const lastMs = this.milestones[this.milestones.length - 1];
    stops.push({ x: this.levelWidth, sky: lastMs.sky, terrain: lastMs.terrain });

    // Cảnh đổi ngay tại mốc (x = stop.x), có crossfade rộng FADE quanh mốc để
    // hai bộ parallax hoà vào nhau thay vì cắt cứng
    const FADE = 520;
    if (x <= stops[0].x) return { sky: stops[0].sky, terrain: stops[0].terrain, terrain2: null, blend: 0 };
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)));
        const sky = [lerpColor(a.sky[0], b.sky[0], t), lerpColor(a.sky[1], b.sky[1], t)];
        // nửa sau của fade quanh mốc a (đang hiện b.terrain? không: a vừa bắt đầu)
        const prev = stops[i - 1];
        const fadeIn = prev && prev.terrain !== a.terrain ? Math.max(0, Math.min(1, 0.5 + (x - a.x) / FADE)) : 1;
        if (fadeIn < 1) return { sky, terrain: prev.terrain, terrain2: a.terrain, blend: fadeIn };
        const fadeOut = b.terrain !== a.terrain ? Math.max(0, Math.min(1, 0.5 + (x - b.x) / FADE)) : 0;
        if (fadeOut > 0) return { sky, terrain: a.terrain, terrain2: b.terrain, blend: fadeOut };
        return { sky, terrain: a.terrain, terrain2: null, blend: 0 };
      }
    }
    const end = stops[stops.length - 1];
    return { sky: end.sky, terrain: end.terrain, terrain2: null, blend: 0 };
  }
}

// ============================================================
// vẽ
// ============================================================
const OUTLINE = "#2b2030";
const OUTLINE_W = 4;

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// màu pixel ở mép trên của ảnh (đọc 1 lần, cache) — dùng để tô liền phần trời phía trên.
// Luôn thử đọc màu THẬT từ chính ảnh trước (đúng với mọi bộ nền, kể cả nền riêng của khách);
// fallback là màu đoán sẵn theo cảnh (chỉ dùng khi chạy qua file:// không đọc được pixel).
const topColorCache = new WeakMap();
function topColorOf(image, fallback) {
  if (topColorCache.has(image)) return topColorCache.get(image);
  let color = fallback || "#f6d5a8";
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    c.getContext("2d").drawImage(image, 0, 0, image.width, 2, 0, 0, 1, 1);
    const d = c.getContext("2d").getImageData(0, 0, 1, 1).data;
    color = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch (e) { /* ảnh chéo domain thì dùng màu mặc định */ }
  topColorCache.set(image, color);
  return color;
}



// Tham số CW ở đây là chiều rộng canvas THỰC TẾ của thiết bị.
// Lặp ảnh kiểu gương (tile → tile lật → tile) để mép nào cũng khớp, không lộ mối nối
function tileMirrored(ctx, image, scrollX, y, targetH, CW) {
  const scale = targetH / image.height;
  const tileW = image.width * scale;
  const period = tileW * 2;
  const start = -(((scrollX % period) + period) % period);
  // toạ độ lẻ làm chỗ nối 2 ô hở nửa pixel → lộ vệt dọc màu trời; làm tròn và đè 1px
  for (let dx = start; dx < CW + tileW; dx += tileW) {
    const idx = Math.round((dx - start) / tileW);
    const x0 = Math.floor(dx);
    const w = Math.ceil(dx + tileW) - x0 + 1;
    if (idx % 2 === 1) {
      ctx.save();
      ctx.translate(x0 + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, w, targetH);
      ctx.restore();
    } else {
      ctx.drawImage(image, x0, y, w, targetH);
    }
  }
}

// Vẽ các lớp parallax của cảnh (xa → gần): đáy cảnh chìm dưới mặt đường (SCENE_SINK) để
// phần đất/đường riêng của ảnh nền nằm khuất dưới đường nhựa + gạch của game.
// Cảnh vẽ ở tỉ lệ cố định SCENE_ZOOM (1 px của ảnh 540 cao = SCENE_ZOOM đơn vị thế giới)
// thay vì kéo cho vừa khung — nền không bị phóng to trên màn hình thường; phần trời phía
// trên tô bằng màu mép trên của lớp 1. sink tính theo hệ 540px.
// Màn hình dọc/cao hơn 540+sink thì phóng lớn thêm vừa đủ để ảnh nền (mây, trời) luôn phủ
// kín tới mép trên, không lộ mảng màu đặc phía trên nữa.
const SCENE_ZOOM = 1;
function drawScene(ctx, layers, speeds, camX, groundY, CW, sinkScenePx, topColor) {
  const minH = 540 * SCENE_ZOOM;
  const sink0 = sinkScenePx * SCENE_ZOOM;
  // Không bao giờ để hở khoảng trống phía trên: nếu 540 chưa đủ phủ tới mép trên canvas
  // (màn hình dọc/cao) thì phóng to thêm đúng bằng phần thiếu. sink phải phóng theo cùng tỉ lệ
  // (luôn = sinkScenePx/540 so với chiều cao đang vẽ), không thì phần bờ/đất của cảnh vốn phải
  // nằm khuất dưới đường của game sẽ lộ thêm ra, làm nhân vật trông như đứng cao hơn mặt đường.
  const h = Math.max(minH, (groundY * minH) / (minH - sink0));
  const sink = sink0 * (h / minH);
  const y = groundY + sink - h;
  if (y > 0) {
    ctx.fillStyle = topColorOf(layers[0], topColor);
    ctx.fillRect(0, 0, CW, y + 1);
  }
  layers.forEach((layer, i) => {
    tileMirrored(ctx, layer, camX * (speeds[i] ?? 0.5), y, h, CW);
  });
}

function drawTerrain(ctx, type, img, camX, groundY, CW) {
  const id = type.startsWith("scene:") ? type.slice(6) : "";
  const layers = id && img.scenes && img.scenes[id];
  if (!layers || !layers.every(ready)) return; // ảnh chưa tải xong: để nguyên nền trời
  // sceneSpeeds: mảng dùng chung cho mọi cảnh, hoặc bảng theo từng cảnh { id: [tốc độ từng lớp] }
  const speeds = Array.isArray(img.sceneSpeeds) ? img.sceneSpeeds : (img.sceneSpeeds && img.sceneSpeeds[id]) || [0.25, 1];
  drawScene(
    ctx,
    layers,
    speeds,
    camX,
    groundY,
    CW,
    (img.sceneSink && img.sceneSink[id]) ?? 160,
    img.sceneTop && img.sceneTop[id]
  );
}






// dải đất dưới mặt đường: tối, có vân ngang
function drawGroundStrip(ctx, camX, groundY, CW, CH) {
  const top = groundY + 60 - LANE_LIFT;
  ctx.fillStyle = "#231b2a";
  ctx.fillRect(0, top, CW, CH - top);
  ctx.fillStyle = "#2f2438";
  for (let y = top + 8; y < CH; y += 16) {
    for (let x = -((camX * 0.6) % 40); x < CW; x += 40) ctx.fillRect(q(x), y, 20, 4);
  }
}

// hàng gạch (Block-BrickRow.png) lát kín phần đất dưới mặt đường
function drawBrickGround(ctx, rowImg, camX, CW, groundY, ch) {
  if (!ready(rowImg)) return;
  const rowH = BLOCK; // cùng cỡ với gạch chướng ngại
  const rowW = rowH * (rowImg.width / rowImg.height);
  const top = groundY + 66 - LANE_LIFT;
  const from = Math.floor(camX / rowW) * rowW;
  for (let y = top; y < ch; y += rowH) {
    for (let x = from; x < camX + CW + rowW; x += rowW) ctx.drawImage(rowImg, x, y, rowW + 1, rowH);
  }
  // bóng đổ của mặt đường lên hàng gạch
  ctx.fillStyle = "rgba(43,32,48,0.35)";
  ctx.fillRect(camX, top, CW, 6);
}

function drawRoad(ctx, roadImg, camX, CW, groundY, ch) {
  if (ready(roadImg)) {
    const targetH = 78;
    const scale = targetH / roadImg.height;
    const tileW = roadImg.width * scale;
    const from = Math.floor(camX / tileW) * tileW;
    for (let x = from; x < camX + CW + tileW; x += tileW) {
      ctx.drawImage(roadImg, x, groundY - 8 - LANE_LIFT, tileW + 1, targetH);
    }
    return;
  }
  ctx.fillStyle = "#3a3a3f";
  ctx.fillRect(camX, groundY, CW, ch - groundY);
}

// Chồng gạch (Block-Brick.png), dự phòng vẽ tay nếu thiếu ảnh
function drawBricks(ctx, brick, x, bottomY, w, h) {
  for (let by = bottomY - BLOCK; by >= bottomY - h; by -= BLOCK) {
    for (let bx = x; bx < x + w; bx += BLOCK) {
      if (ready(brick)) {
        ctx.drawImage(brick, bx, by, BLOCK, BLOCK);
      } else {
        ctx.fillStyle = "#c9764f";
        ctx.fillRect(bx, by, BLOCK, BLOCK);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.strokeRect(bx + 1.5, by + 1.5, BLOCK - 3, BLOCK - 3);
        ctx.fillStyle = "rgba(43,32,48,0.35)";
        ctx.fillRect(bx, by + BLOCK / 2 - 1, BLOCK, 2);
        ctx.fillRect(bx + BLOCK / 2 - 1, by, 2, BLOCK / 2);
        ctx.fillRect(bx + BLOCK / 4 - 1, by + BLOCK / 2, 2, BLOCK / 2);
        ctx.fillRect(bx + (3 * BLOCK) / 4 - 1, by + BLOCK / 2, 2, BLOCK / 2);
      }
    }
  }
}

// dãy gai pixel: tam giác bậc thang, thân xám, viền tối, chân đế.
// Đáy rộng nằm sát mặt đất (baseY), đầu nhọn hướng lên trên.
function drawSpikes(ctx, x, baseY, w) {
  ctx.save();
  for (let sx = x; sx < x + w; sx += SPIKE_W) {
    const cx = sx + SPIKE_W / 2;
    for (let dy = 0; dy < SPIKE_H; dy += PX) {
      const half = q(((dy + PX) / SPIKE_H) * (SPIKE_W / 2));
      const y = baseY - SPIKE_H + dy;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(cx - half - 2, y, half * 2 + 4, PX);
      ctx.fillStyle = dy > SPIKE_H - 8 ? "#f4f0f6" : "#b9b3c4";
      if (half > 2) ctx.fillRect(cx - half + 2, y, half * 2 - 4, PX);
    }
  }
  ctx.fillStyle = "#3a2f44";
  ctx.fillRect(x - 2, baseY - 4, w + 4, 4);
  ctx.restore();
}

// vết nứt trên gạch vỡ được
function drawCracks(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(43,32,48,0.55)";
  for (let bx = x; bx < x + w; bx += BLOCK) {
    ctx.fillRect(bx + 10, y + 8, 4, 12);
    ctx.fillRect(bx + 14, y + 20, 4, 8);
    ctx.fillRect(bx + 18, y + 28, 4, 10);
    ctx.fillRect(bx + 28, y + 6, 4, 8);
    ctx.fillRect(bx + 24, y + 14, 4, 6);
  }
  ctx.restore();
}

// Boss: đám mây nghi ngờ — mây Nature-Cloud nhuộm tối + mắt cau có + tia sét
function drawBoss(ctx, cloudImg, b, groundY, t) {
  const x = b.x;
  const y = groundY - BOSS_H - 6 + Math.sin(t * 9) * 3;
  const w = BOSS_W;
  const h = BOSS_H;
  ctx.save();
  // bóng
  ctx.fillStyle = "rgba(43,32,48,0.3)";
  ctx.fillRect(q(x + 10), groundY - 6, q(w - 20), 6);
  if (ready(cloudImg)) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cc = c.getContext("2d");
    cc.drawImage(cloudImg, 0, 0, w, h);
    cc.globalCompositeOperation = "source-atop";
    cc.fillStyle = "#3b2a5a";
    cc.fillRect(0, 0, w, h);
    ctx.drawImage(c, x, y);
  } else {
    ctx.fillStyle = "#3b2a5a";
    ctx.fillRect(x, y + 10, w, h - 10);
  }
  // mắt + lông mày cau
  const ex = x + w * 0.36;
  const ey = y + h * 0.42;
  ctx.fillStyle = "#fff";
  ctx.fillRect(q(ex), q(ey), 14, 12);
  ctx.fillRect(q(ex + 24), q(ey), 14, 12);
  ctx.fillStyle = OUTLINE;
  const look = b.dir > 0 ? 6 : 2;
  ctx.fillRect(q(ex + look), q(ey + 4), 6, 6);
  ctx.fillRect(q(ex + 24 + look), q(ey + 4), 6, 6);
  ctx.fillRect(q(ex - 2), q(ey - 6), 18, 4);
  ctx.fillRect(q(ex + 22), q(ey - 6), 18, 4);
  // tia sét nhấp nháy dưới mây
  if (Math.floor(t * 6) % 3 === 0) {
    ctx.fillStyle = "#f2c94c";
    const lx = q(x + w / 2 + (b.dir > 0 ? 10 : -10));
    ctx.fillRect(lx, y + h - 6, 6, 12);
    ctx.fillRect(lx - 6, y + h + 6, 6, 10);
    ctx.fillRect(lx, y + h + 16, 6, 10);
  }
  // nhãn + số lần né
  ctx.font = `9px ${TITLE_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.fillText(STR.bossDoubt, x + w / 2, y - 14);
  for (let i = 0; i < BOSS_DODGES; i++) {
    ctx.fillStyle = i < b.dodges ? "#f2c94c" : "rgba(255,255,255,0.35)";
    ctx.fillRect(q(x + w / 2 - 18 + i * 14), y - 10, 8, 4);
  }
  ctx.restore();
}

// xe máy trùm bạt hồng chờ ở cuối đoạn đi bộ
function drawCoveredBike(ctx, image, x, groundY, t, ready_) {
  ctx.save();
  const label = () => {
    ctx.font = `8px ${TITLE_FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = ready_ && Math.floor(t * 3) % 2 === 0 ? "#f2c94c" : "#fff";
  };
  if (ready(image)) {
    const h = 74;
    const w = h * (image.width / image.height);
    drawShadow(ctx, x + w / 2, groundY, w * 0.85, 0.22);
    ctx.drawImage(image, x, groundY - h, w, h);
    label();
    ctx.fillText(ready_ ? STR.bikeGo : STR.bikeMine, x + w / 2, groundY - h - 8);
  } else {
    // bạt phủ vẽ tay: dùng khi chưa có ảnh xe riêng của khách
    const w = 120;
    const h = 58;
    const y = groundY - h;
    ctx.fillStyle = "rgba(43,32,48,0.3)";
    ctx.fillRect(x + 6, groundY - 6, w - 12, 6);
    ctx.fillStyle = "#ffb6cf";
    const rows = [[16, 88], [8, 104], [4, 112], [0, 120], [0, 120], [0, 120], [4, 112], [4, 112], [10, 100]];
    rows.forEach(([ox, ww], i) => ctx.fillRect(x + ox, y + i * 6, ww, 6));
    ctx.fillRect(x + 4, y + h - 6, 30, 6);
    ctx.fillRect(x + w - 34, y + h - 6, 30, 6);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 13.5, w - 3, h - 15);
    ctx.fillStyle = "#e0538a";
    ctx.fillRect(x + 30, y + 14, 4, h - 16);
    ctx.fillRect(x + w - 34, y + 14, 4, h - 16);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 44, y + 22, 24, 4);
    label();
    ctx.fillText(ready_ ? STR.bikeGo : STR.bikeMine, x + w / 2, y - 8);
  }
  ctx.restore();
}

// Bục cỏ lơ lửng (Platform-Grass-Float cho bục ≤ 2 viên, Ground-Grass-Short kéo dài cho bục rộng)
function drawGrassPlatform(ctx, img, x, top, w) {
  const useFloat = w <= BLOCK * 2 && ready(img.grassFloat);
  const im = useFloat ? img.grassFloat : img.grassGround;
  if (!ready(im)) {
    ctx.fillStyle = "#5aa64a";
    ctx.fillRect(x, top, w, BLOCK);
    return;
  }
  const h = useFloat ? w * (im.height / im.width) : BLOCK + 4;
  ctx.drawImage(im, x - 2, top - 3, w + 4, h);
}

// Cảnh vật ven đường, neo chân xuống mặt đường, đặt sau mọi thứ khác
function drawProp(ctx, im, pr, groundY) {
  if (!ready(im)) return;
  const h = pr.h;
  const w = h * (im.width / im.height);
  ctx.save();
  // cây cỏ mọc ở mép trên con đường (lề), lùi sau làn xe — nhân vật/xe/chướng ngại mới chạy trên vạch kẻ
  ctx.translate(pr.x, groundY - PROP_KERB);
  if (pr.flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
}

function drawShadow(ctx, cx, groundY, w, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(43,32,48,${alpha})`;
  ctx.fillRect(q(cx - w / 2), groundY - 6, q(w), 6);
  ctx.restore();
}

function drawItem(ctx, image, id, x, bottomY, size, t, groundY, scaleMul = 1) {
  const bob = Math.sin(t * 4 + x) * 3;
  drawShadow(ctx, x + size / 2, groundY, size * 0.8, 0.18 + Math.sin(t * 4 + x) * 0.05);
  // tia lấp lánh xoay quanh
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + (i * Math.PI * 2) / 3;
    const rr = size * 0.75;
    ctx.globalAlpha = 0.4 + Math.sin(t * 6 + i) * 0.4;
    ctx.fillRect(q(x + size / 2 + Math.cos(a) * rr), q(bottomY - size / 2 + bob + Math.sin(a) * rr * 0.6), 4, 4);
  }
  ctx.restore();

  if (ready(image)) {
    const h = size * 1.15 * scaleMul;
    const w = h * (image.width / image.height);
    ctx.drawImage(image, x + size / 2 - w / 2, bottomY - h + bob, w, h);
    return;
  }
  if (id === "lipstick") {
    drawLipstick(ctx, x + size / 2, bottomY + bob, size);
    return;
  }
  if (id === "umbrella") {
    drawUmbrella(ctx, x + size / 2, bottomY + bob, size);
    return;
  }
  ctx.fillStyle = "#ff6fa0";
  ctx.fillRect(q(x + 6), q(bottomY - size + 6 + bob), size - 12, size - 12);
}

// Ô che mưa vẽ bằng code (bộ ảnh không có)
function drawUmbrella(ctx, cx, bottomY, size) {
  const r = size * 0.55;
  const top = bottomY - size * 1.1;
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  // cán
  ctx.fillStyle = "#3a2a3d";
  ctx.fillRect(q(cx - 2), top + r * 0.6, 4, size * 0.8);
  ctx.fillRect(q(cx - 2), bottomY - 6, 10, 4);
  // vòm ô: bậc thang 2px, sọc hồng/trắng
  for (let dy = 0; dy < r; dy += PX) {
    const half = q(Math.sqrt(Math.max(0, r * r - (r - dy) * (r - dy))));
    const y = top + dy;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - half - 2, y, half * 2 + 4, PX);
    for (let x = cx - half; x < cx + half; x += 10) {
      ctx.fillStyle = Math.floor((x - cx + half) / 10) % 2 ? "#fff" : "#ff6fa0";
      ctx.fillRect(x, y, Math.min(10, cx + half - x), PX);
    }
  }
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(q(cx - 2), top - 6, 4, 6);
  ctx.restore();
}

// Mưa Nha Trang: tối trời + hạt mưa xiên, cường độ 0..1
function drawRainOverlay(ctx, k, camX, CW, CH, t) {
  ctx.save();
  ctx.fillStyle = `rgba(40,50,80,${0.35 * k})`;
  ctx.fillRect(-20, -20, CW + 40, CH + 40);
  ctx.fillStyle = `rgba(220,235,255,${0.55 * k})`;
  const n = Math.floor(90 * k);
  for (let i = 0; i < n; i++) {
    const x = ((i * 97 - camX * 1.3 - t * 60) % (CW + 80) + CW + 80) % (CW + 80) - 40;
    const y = ((i * 53 + t * 900) % (CH + 40)) - 20;
    ctx.fillRect(q(x), q(y), 2, 16);
    ctx.fillRect(q(x) - 2, q(y) + 16, 2, 4);
  }
  ctx.restore();
}

function drawLipstick(ctx, cx, bottomY, size) {
  const w = q(size * 0.42);
  const h = q(size * 1.05);
  const x = q(cx - w / 2);
  const top = q(bottomY - h);
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.fillStyle = "#3a2a3d";
  ctx.fillRect(x, top + h / 2, w, h / 2);
  ctx.strokeRect(x + 1.5, top + h / 2 + 1.5, w - 3, h / 2 - 3);
  ctx.fillStyle = "#e6c25a";
  ctx.fillRect(x + 2, top + h / 2, w - 4, 4);
  ctx.fillStyle = "#e0538a";
  ctx.fillRect(x + 4, top + 8, w - 8, h / 2 - 8);
  ctx.fillRect(x + 4, top + 4, w - 12, 4);
  ctx.strokeRect(x + 4 + 1.5, top + 4 + 1.5, w - 8 - 3, h / 2 - 4 - 3);
  ctx.restore();
}

// cheer = khung vẫy tay (nhìn thẳng, không lật); mặc định là đứng nghiêng, lật lại để nhìn về phía chàng trai
function drawWoman(ctx, image, x, groundY, t, cheer) {
  // cỡ theo nhân vật nam trên xe (74): đứng ≈ 68, reo hò giơ tay ≈ 84
  const h = cheer ? 84 : 68;
  const bob = cheer ? Math.abs(Math.sin(t * 6)) * -6 : Math.sin(t * 2.2) * 1.5;
  drawShadow(ctx, x, groundY, 44, 0.22);
  if (!ready(image)) {
    ctx.fillStyle = "#e0538a";
    ctx.fillRect(x - 16, groundY - h + bob, 32, h);
    return;
  }
  const w = h * (image.width / image.height);
  ctx.save();
  ctx.translate(x, groundY + bob);
  if (!cheer) ctx.scale(-1, 1);
  ctx.drawImage(image, -w / 2, -h, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
  ctx.fillStyle = "#ff6fa0";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("♥", x + 28, groundY - h - 6 - ((t * 20) % 18));
  ctx.restore();
}


// Ngắt chữ theo từ, không vượt quá maxWidth (dùng ctx.font đã set sẵn trước khi gọi)
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Khung polaroid: viền pixel, bóng cứng lệch, dây treo.
// maxSize: cạnh dài nhất của ảnh (đơn vị thế giới) — render() tính theo chiều cao màn hình
// còn trống phía trên mặt đường, nên laptop có khung to hơn điện thoại nằm ngang hẳn.
function drawPolaroid(ctx, photo, date, x, y, t, i, name, placeholder, maxSize) {
  // Khung ôm theo tỉ lệ ảnh thật (không crop): ảnh vừa trong hộp MAX×MAX, viền 8
  const MAX = maxSize || 190;
  const PAD = 8;
  let iw = 130;
  let ih = 130;
  if (ready(photo)) {
    const s = Math.min(MAX / photo.width, MAX / photo.height);
    iw = Math.round(photo.width * s);
    ih = Math.round(photo.height * s);
  }
  const w = iw + PAD * 2;

  // ---------- chú thích: ngày + tên mốc, đủ dấu tiếng Việt (Be Vietnam Pro như dòng điểm
  // rơi ở trên). Mốc nào date và name đều trống thì không vẽ gì — giữ nguyên khung trắng
  // như trước, không đổi giao diện các bản khách chủ động để trống (vd bản thaobe). ----------
  ctx.textAlign = "center";
  const maxTextW = w - 16;
  const fitSize = (text, base, min, bold) => {
    let px = base;
    ctx.font = `${bold ? 700 : 600} ${px}px 'Be Vietnam Pro', sans-serif`;
    while (px > min && ctx.measureText(text).width > maxTextW) {
      px -= 1;
      ctx.font = `${bold ? 700 : 600} ${px}px 'Be Vietnam Pro', sans-serif`;
    }
    return px;
  };
  const rows = [];
  if (date) rows.push({ text: date, px: fitSize(date, 14, 10, true), bold: true, color: "#6b3f52" });
  if (name) {
    const namePx = fitSize(name, date ? 12 : 14, 9, false);
    ctx.font = `600 ${namePx}px 'Be Vietnam Pro', sans-serif`;
    const nameColor = date ? "#a97a92" : "#6b3f52";
    if (ctx.measureText(name).width > maxTextW) {
      // vẫn dài quá dù đã thu nhỏ tối đa: xuống 2 dòng thay vì tràn khỏi khung
      for (const line of wrapText(ctx, name, maxTextW)) rows.push({ text: line, px: namePx, bold: false, color: nameColor });
    } else {
      rows.push({ text: name, px: namePx, bold: false, color: nameColor });
    }
  }
  // FOOT=44 (như cũ) đủ chỗ cho tối đa 2 dòng; tên phải xuống dòng thứ 3 mới cần đáy cao hơn.
  const FOOT = 44 + Math.max(0, rows.length - 2) * 14;

  const h = ih + PAD + FOOT;
  const bob = q(Math.sin(t * 1.4 + i) * 4);
  const rot = ((i % 2 === 0 ? -1 : 1) * 3 * Math.PI) / 180;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + bob);
  ctx.rotate(rot);
  // dây treo — chỉ đủ dài chạm mép trên màn hình (y = khoảng cách từ đỉnh khung tới đó),
  // không kéo cố định 400px như trước (thừa trên màn to, có khi hụt trên màn cao)
  ctx.strokeStyle = "rgba(43,32,48,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(0, -h / 2 - (y + 40));
  ctx.stroke();
  // bóng cứng
  ctx.fillStyle = "rgba(43,32,48,0.28)";
  ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
  // kẹp ghim
  ctx.fillStyle = "#ff6fa0";
  ctx.fillRect(-8, -h / 2 - 6, 16, 12);
  ctx.strokeRect(-8 + 1.5, -h / 2 - 6 + 1.5, 13, 9);

  const px = -iw / 2;
  const py = -h / 2 + PAD;
  if (ready(photo)) {
    ctx.drawImage(photo, px, py, iw, ih);
  } else {
    ctx.fillStyle = "#f3e4ea";
    ctx.fillRect(px, py, iw, ih);
    ctx.textAlign = "center";
    if (placeholder) {
      // khung trống của bản demo: viền đứt + chữ hướng dẫn xuống dòng
      ctx.strokeStyle = "rgba(224,83,138,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(px + 5, py + 5, iw - 10, ih - 10);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(224,83,138,0.8)";
      ctx.font = `8px ${TITLE_FONT}`;
      const lines = wrapText(ctx, placeholder, iw - 22);
      let ty = py + ih / 2 - (lines.length - 1) * 7;
      for (const l of lines) {
        ctx.fillText(l, 0, ty);
        ty += 14;
      }
    } else {
      ctx.fillStyle = "rgba(224,83,138,0.35)";
      ctx.font = "26px sans-serif";
      ctx.fillText("♡", 0, py + ih / 2 + 9);
    }
  }

  if (rows.length) {
    ctx.textAlign = "center";
    const lineH = 14;
    let ly = h / 2 - 10 - (rows.length - 1) * lineH;
    for (const row of rows) {
      ctx.font = `${row.bold ? 700 : 600} ${row.px}px 'Be Vietnam Pro', sans-serif`;
      ctx.fillStyle = row.color;
      ctx.fillText(row.text, 0, ly);
      ly += lineH;
    }
  }
  ctx.restore();
}

function drawChest(ctx, x, y, opened, t, gift) {
  const w = 64;
  const h = 44;
  const lidH = 18;
  // hào quang nhịp nhàng
  if (!opened) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, 70 + Math.sin(t * 3) * 10);
    glow.addColorStop(0, "rgba(255,182,207,0.45)");
    glow.addColorStop(1, "rgba(255,182,207,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 80, y - 80, w + 160, h + 160);
  }
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = OUTLINE_W;
  ctx.fillStyle = gift ? "#ffb6cf" : "#ff8fb8";
  ctx.fillRect(x, y + lidH - 4, w, h - lidH + 4);
  ctx.strokeRect(x + 2, y + lidH - 2, w - 4, h - lidH);
  ctx.fillStyle = gift ? "#ff9fc4" : "#ff6fa0";
  ctx.save();
  if (opened) {
    ctx.translate(x, y + lidH);
    ctx.rotate(-0.9);
    ctx.translate(-x, -(y + lidH));
  }
  ctx.fillRect(x - 2, y, w + 4, lidH);
  ctx.strokeRect(x, y + 2, w, lidH - 4);
  ctx.restore();
  if (gift) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w / 2 - 5, y, 10, h);
    ctx.strokeRect(x + w / 2 - 5, y + 2, 10, h - 4);
    ctx.fillStyle = "#e0538a";
    ctx.fillRect(x + w / 2 - 16, y - 10, 12, 12);
    ctx.fillRect(x + w / 2 + 4, y - 10, 12, 12);
    ctx.strokeRect(x + w / 2 - 14, y - 8, 8, 8);
    ctx.strokeRect(x + w / 2 + 6, y - 8, 8, 8);
  } else {
    ctx.fillStyle = "#f2c94c";
    ctx.fillRect(x + w / 2 - 7, y + lidH - 6, 14, 14);
    ctx.strokeRect(x + w / 2 - 5, y + lidH - 4, 10, 10);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + w / 2 - 2, y + lidH, 4, 6);
  }
  ctx.restore();
}

// vệt gió phía sau xe đang chạy
function drawSpeedLines(ctx, p, groundY, t) {
  const back = -p.facing;
  const tail = p.x + p.w / 2 + back * 50;
  ctx.save();
  [[26, 0], [52, 0.33], [76, 0.66]].forEach(([h, phase]) => {
    const k = (t * 3 + phase) % 1; // 0..1: vệt dài ra rồi mờ đi
    const len = q(10 + k * 26);
    const gap = q(4 + k * 18);
    ctx.fillStyle = `rgba(255,255,255,${(0.75 * (1 - k)).toFixed(2)})`;
    const x0 = back > 0 ? tail + gap : tail - gap - len;
    ctx.fillRect(q(x0), q(groundY - h), len, 3);
  });
  ctx.restore();
}

function drawPrompt(ctx, x, y, text, t) {
  const bob = q(Math.sin(t * 5) * 3);
  ctx.save();
  ctx.font = `10px ${TITLE_FONT}`;
  ctx.textAlign = "center";
  const w = q(ctx.measureText(text).width + 44);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(q(x - w / 2), y - 26 + bob, w, 26);
  ctx.fillStyle = "#fff";
  ctx.fillRect(q(x - w / 2) + 3, y - 23 + bob, w - 6, 20);
  ctx.fillStyle = OUTLINE;
  ctx.fillText("▲ " + text, x, y - 8 + bob);
  ctx.restore();
}

// drawW = 0 → giữ đúng tỉ lệ ảnh gốc theo chiều cao (dùng cho các khung animation xe đôi).
// drawH  → chiều cao hiển thị (khác hitbox vật lý p.h) khi ảnh cần to hơn, ví dụ cảnh đi xe;
// luôn neo đáy ảnh xuống đúng mặt đất (p.y + p.h) bất kể drawH lớn hơn hay bằng p.h.
// yOffset → đẩy ảnh xuống thêm so với mặt đất (p.y + p.h), dùng cho xe máy để bánh xe
// lún vào mặt đường một chút, trông thật hơn là lơ lửng đúng mép.
function drawPlayer(ctx, p, playerImg, drawW, hit, groundY, drawH, yOffset) {
  const h = drawH || p.h;
  const w = drawW || (ready(playerImg) ? h * (playerImg.width / playerImg.height) : p.w);
  drawShadow(ctx, p.x + p.w / 2, groundY, w * 0.9, p.onGround ? 0.25 : 0.12);
  ctx.save();
  const bob = p.onGround ? Math.sin(p.animT * 5) * 2.2 : 0;
  const lean = p.onGround ? Math.sin(p.animT * 5) * 0.02 : -p.vy * 0.00025;
  ctx.translate(p.x + p.w / 2, p.y + p.h + bob + (yOffset || 0));
  if (p.facing < 0) ctx.scale(-1, 1);
  ctx.rotate(lean);
  if (hit) ctx.globalAlpha = 0.5;
  if (ready(playerImg)) ctx.drawImage(playerImg, -w / 2, -h, w, h);
  ctx.restore();
}

// ============================================================
// BỐ CỤC MÀN CHƠI — thiết kế gameplay, thường không cần sửa khi cá nhân hoá.
//
// Đơn vị: px thế giới, tính từ đầu mỗi đoạn. Một viên gạch = 44px.
// Vật lý: nhảy đơn cao ~116px, nhảy đôi (bấm lần 2 lúc lên tới đỉnh) cao ~206px.
//
//   blocks     [{ x, w?, h? }]                 chồng gạch đặc trên mặt đường (w, h tính bằng viên)
//   platforms  [{ x, w, y, move?, breakable? }] bục lơ lửng, y = độ cao mặt bục so với mặt đường
//                move { dx, dy, speed }         bục chạy qua lại (dx) hoặc lên xuống (dy)
//                breakable true                 gạch vỡ khi đội đầu từ dưới lên
//   spikes     [{ x, n, y? }]                  dãy n gai (mỗi gai 22px), y = đặt trên bục
//   itemAt     { x, y }                        vị trí món quà của đoạn
//   heartBlock { x }                           ô "?" đội từ dưới lên để nhận thêm 1 tim
// ============================================================

export const MAX_HEARTS = 3;
export const SOLO_SEG_W = 1300; // chiều dài mỗi đoạn solo

// Nền dùng cho từng chặng (khớp id trong assets.js → SCENES)
export const WALK_TERRAIN = "scene:ho-guom"; // đoạn đi bộ lấy chìa khoá + mũ
export const BOSS_TERRAIN = "scene:ho-guom"; // đấu mây "DOUBT"
export const MEET_TERRAIN = "scene:ho-guom"; // lúc gặp nhau
export const COUPLE_TERRAIN = "scene:ho-tay"; // toàn bộ chặng đi đôi

const SOLO_TERRAIN = "scene:ho-guom";
const SKY_DAY = ["#bfe0f2", "#e8f3ee"];
const SKY_NOON = ["#cfe2f3", "#e9f0f5"];
const SKY_DUSK = ["#f7b46a", "#f08a3c"];

// 5 đoạn solo, mỗi đoạn kết thúc bằng một món quà (thứ tự khớp GIFTS trong config.js)
export const SOLO_SEGMENTS = [
  {
    item: "matcha", terrain: SOLO_TERRAIN, sky: SKY_DAY,
    platforms: [{ x: 160, w: 1, y: 140, breakable: true }, { x: 720, w: 2, y: 96 }],
    blocks: [{ x: 300 }, { x: 960, w: 2 }],
    spikes: [{ x: 480, n: 3 }, { x: 860, n: 2 }],
    itemAt: { x: 1120, y: 100 },
  },
  {
    item: "chocolate", terrain: SOLO_TERRAIN, sky: SKY_NOON,
    blocks: [{ x: 180, h: 2 }, { x: 1120 }],
    spikes: [{ x: 460, n: 3 }, { x: 980, n: 3 }],
    platforms: [{ x: 580, w: 3, y: 140 }],
    itemAt: { x: 1230, y: 150 },
    heartBlock: { x: 820 },
  },
  {
    item: "flower", terrain: SOLO_TERRAIN, sky: SKY_NOON,
    blocks: [{ x: 120, w: 2 }, { x: 208, w: 2, h: 2 }, { x: 296, w: 2, h: 3 }],
    platforms: [{ x: 420, w: 2, y: 190, move: { dx: 70, dy: 0, speed: 1.4 } }, { x: 1100, w: 2, y: 100 }],
    spikes: [{ x: 400, n: 4 }, { x: 780, n: 3 }, { x: 960, n: 4 }],
    itemAt: { x: 1122, y: 156 },
  },
  {
    item: "lipstick", terrain: SOLO_TERRAIN, sky: SKY_DUSK,
    spikes: [{ x: 160, n: 3 }, { x: 420, n: 4 }, { x: 700, n: 2 }, { x: 1040, n: 2 }],
    platforms: [
      { x: 300, w: 2, y: 100 },
      { x: 520, w: 3, y: 100, move: { dx: 0, dy: 50, speed: 1.3 } },
      { x: 760, w: 2, y: 150 },
      { x: 940, w: 2, y: 100 },
    ],
    itemAt: { x: 1150, y: 100 },
  },
  {
    item: "letter", terrain: SOLO_TERRAIN, sky: SKY_DUSK,
    blocks: [{ x: 150, h: 2 }],
    spikes: [{ x: 380, n: 3 }, { x: 560, n: 3 }, { x: 950, n: 2 }, { x: 1100, n: 2 }],
    platforms: [
      { x: 640, w: 3, y: 110 },
      { x: 640, w: 2, y: 250, breakable: true },
      { x: 860, w: 2, y: 175 },
      { x: 1000, w: 2, y: 120 },
    ],
    itemAt: { x: 1200, y: 100 },
  },
];

// ============================================================
// DANH SÁCH ẢNH — đường dẫn tới sprite, nền và cảnh vật.
// Chỉ sửa khi thay bộ đồ hoạ; nội dung của khách nằm ở config.js.
// ============================================================

const CHAR = "assets/characters/";
const EL = "assets/elements/";
const PROP = "assets/props/";
const UI = "assets/ui/";
const SCENE = "assets/scenes/";

// ---------- sprite & giao diện ----------
export const IMG = {
  playerSolo: CHAR + "Man-Bike-Side-01.png",
  bikeIdle: CHAR + "Bike-Idle-01.png",
  walkFrames: [1, 2, 3, 4].map((n) => `${CHAR}Man-Walk-Side-0${n}.png`),
  key: CHAR + "Item-Key-01.png",
  helmet: CHAR + "Item-Helmet-01.png",
  keyHelmet: CHAR + "Item-Key-Helmet-01.png",
  coupleFrames: [
    CHAR + "Couple-Bike-Side-01.png",
    CHAR + "Couple-Bike-Side-02.png",
    CHAR + "Couple-Bike-Side-Motion-01.png",
    CHAR + "Couple-Bike-Side-03.png",
  ],
  woman: CHAR + "Woman-Stand-Side-01.png",
  womanCheer: [CHAR + "Woman-Cheer-01.png", CHAR + "Woman-Cheer-02.png"],
  couplePose: CHAR + "Couple-Pose-Happy-01.png",
  portraitWoman: CHAR + "Portrait-Woman-01.png",
  sceneTerraceBike: CHAR + "Scene-Terrace-Bike-Iso-01.png",
  sceneTerraceSitting: CHAR + "Scene-Terrace-Sitting-Iso-01.png",
  heartFull: UI + "Heart-Full.png",
  heartEmpty: UI + "Heart-Empty.png",
  bars: [0, 25, 50, 75, 100].map((n) => `${UI}Bar-${n}.png`),
  cloud: EL + "Nature-Cloud.png", // cũng dùng vẽ boss "DOUBT"
  road: EL + "Road-Straight.png",
  brick: EL + "Block-Brick.png",
  brickRow: EL + "Block-BrickRow.png",
  blockSurprise: EL + "Block-Surprise.png",
  blockUsed: EL + "Block-Used.png",
  itemHeart: EL + "Item-Heart.png",
  grassFloat: PROP + "Platform-Grass-Float.png",
  grassGround: PROP + "Ground-Grass-Short.png",
  egg: PROP + "Egg-Gold.png",
};

// ---------- cảnh vật ven đường (rải tự động) ----------
export const PROPS = {
  treeRound: PROP + "Tree-Round.png",
  treePine: PROP + "Tree-Pine.png",
  bushSmall: PROP + "Bush-Small.png",
  bushWide: PROP + "Bush-Wide.png",
  bushRound: PROP + "Bush-Round.png",
  mushroom: PROP + "Mushroom-Blue.png",
  grass: PROP + "Grass-Tuft.png",
  log: PROP + "Log.png",
  flowerBlue: PROP + "Flower-Blue.png",
  flowerWhite: PROP + "Flower-White.png",
  flowers: PROP + "Flowers-White.png",
  sprout: PROP + "Sprout.png",
  rabbit: PROP + "Rabbit.png",
};

// bộ cảnh vật theo loại cảnh: [tên prop, chiều cao tính bằng px thế giới]
export const PROP_SETS = {
  nature: [
    ["treeRound", 120], ["treePine", 104], ["bushWide", 46], ["bushSmall", 40], ["bushRound", 36],
    ["mushroom", 34], ["grass", 30], ["log", 26], ["flowerBlue", 30], ["flowerWhite", 30],
    ["flowers", 32], ["sprout", 30], ["rabbit", 30],
  ],
  city: [["grass", 26], ["flowerBlue", 28], ["bushSmall", 34], ["sprout", 26], ["flowers", 28]],
};

// ---------- nền parallax 3 lớp (mặc định cho demo và mọi khách) ----------
// L1 = trời + cảnh xa (ảnh đục), L2 = cảnh giữa, L3 = cảnh gần (nền trong suốt).
// Mặt đất của cảnh nằm ở y = 380 trong hệ quy chiếu cao 540 → chìm 160px dưới mặt đường.
// Khách muốn nền riêng: khai báo SCENE_LAYERS trong config.js (xem ghi chú ở đó).
const scene = (id) => [1, 2, 3].map((n) => `${SCENE}${id}/L${n}.png`);
export const SCENES = {
  "ho-guom": scene("ho-guom"), // Hồ Gươm ban ngày — đi bộ, solo, gặp nhau
  "ho-tay": scene("ho-tay"), // hoàng hôn — chặng đi đôi
};
const SCENE_IDS = Object.keys(SCENES);
// hệ số trôi của từng lớp so với camera (0 = đứng yên, 1 = trôi cùng đường)
export const SCENE_SPEEDS = {
  "ho-guom": [0.05, 0.16, 0.4],
  "ho-tay": [0.02, 0.3, 0.02], // lớp gần là vệt nắng — khoá theo mặt trời ở lớp xa
};
export const SCENE_SINK = Object.fromEntries(SCENE_IDS.map((id) => [id, 160]));
// Màu mép trên của lớp trời: dùng tô phần trời phía trên ảnh. Ghi sẵn ở đây vì khi
// chạy trực tiếp từ file:// trình duyệt không cho đọc pixel của ảnh.
export const SCENE_TOP = { "ho-guom": "#32bbfa", "ho-tay": "#9264ac" };
// Cảnh thiên nhiên: bục lơ lửng vẽ bằng bục cỏ, ven đường rải cây cối
export const GRASS_SCENES = ["ho-guom"];

// ============================================================
// CẤU HÌNH RIÊNG CHO KHÁCH: thaobe
// Điền nội dung vào đây rồi chạy:  python3 tools/build_customer.py thaobe
// Ảnh để trong customers/thaobe/assets/photos/ và trỏ tới bằng
// đường dẫn "assets/photos/<tên file>" (script tự thu nhỏ khi build).
// ============================================================

// ---------- thương hiệu ----------
export const GAME_TITLE = "MADE FOR US";
export const GAME_SUBTITLE = "Our love journey";
export const WINDOW_NAME = "MADE_FOR_US.EXE"; // chữ trên thanh tiêu đề cửa sổ

// ---------- lời thoại & văn bản ----------
export const TEXT = {
  // câu nhân vật nam nói khi tìm thấy cô ấy
  manLine: "Found you.",
  // dòng chữ trên màn hình bầu trời sao sau khi gặp nhau
  meetText: "I'm on my solo mission but the stars guide me to you",
  // hộp thoại "System Message" ở chiếc hòm hồng
  systemMessage: "The next level is not unlocked yet.\nWould you like to continue the journey?",
  envelopeLabel: "Highly confidential document",
  // lá thư: thay bằng lời của bạn (xuống dòng bằng \n hoặc dùng chuỗi nhiều dòng)
  letterTitle: "Your love letter",
  letter: `Bae iu
520 days cũng hong ngờ là nó tới nhanh zậy á (thật ra là phải 2 hôm nữa =))))) nhưng mà nhân dịp anni nên thui gộp chung lun zị he
Chúng mình chưa từng có 1 ngày kỉ niệm nào theo tháng hết nhưng anh đã từng nói với em là anh muốn dc cùng em kỉ niệm ngày của chúng mình. Dù là tới hơi muộn xíu nheng tui mong bạn sẽ enjoy ngày hum nay với món quà này nhaa
Tui biết là thời gian này bạn phải làm quen với nhiều điều mới, công việc mới với nhiều áp lực hơn mà hăm có tui bên cạnh chắc chắn cũng ko dễ vượt qua tí nàooo. Nhưng mà bạn iu của tui cố lên nhaaa, tui tin bạn sé làm đựt thuiii mình cùm cố gắn nhaa
Iu bạng nhìu ơi là nhìuu
tui nhớ bạn nhắmm`,
  // hiện khi chưa có file video
  videoMissing: "Wait for your video 🎬",
  // chữ trong khung ảnh còn trống
  photoPlaceholder: "(insert pictures here)",
  // nhắc xoay ngang trên điện thoại / máy tính bảng
  rotateTitle: "Please rotate to landscape",
  rotateText: "This journey is made for a sideways screen.",
  rotateTip: "⟳ Hold your device sideways to play",
  // Hướng dẫn thêm vào màn hình chính (chỉ hiện trên điện thoại / máy tính bảng).
  // Để trống thì dùng chuỗi mặc định tiếng Anh trong js/install.js.
  install: {},
};

// ---------- ảnh & video của khách ----------
// Ảnh polaroid: đặt file vào assets/photos/ rồi điền đường dẫn vào từng mốc bên dưới.
// Video: đặt file .mp4 vào assets/video/ rồi điền tên vào đây (nên dưới 15MB).
export const VIDEO_SRC = "assets/video/video.mp4"; // khách gửi .MOV → đổi sang .mp4 bằng avconvert
// Nhạc nền: dùng nhạc chung của game. Tự tắt khi phát video, nhỏ lại một nhịp mỗi lần nhảy.
export const MUSIC_SRC = "assets/audio/bgm.mp3";
// Ảnh ở màn hình mở đầu (ảnh dọc kiểu photobooth rất hợp). Để "" thì hiện khung trống.
export const TITLE_PHOTO = "assets/characters/Couple-Pose-Happy-01.png"; // dùng sprite 2 người ôm nhau thay ảnh chụp
// true  = luôn vẽ khung ảnh trống kèm chữ hướng dẫn (dùng cho bản demo)
// false = mốc nào chưa có ảnh thì không treo khung
export const SHOW_EMPTY_PHOTO_FRAMES = false; // bản khách: mốc chưa có ảnh thì không treo khung

// Xe chở đôi chỉ có 1 ảnh — game tự thêm hiệu ứng chạy xe (khói, bụi, vệt gió, rung máy)
export const COUPLE_FRAMES = ["assets/characters/Couple-Bike-Side-01.png"];

// ---------- 5 món quà của chặng solo ----------
// icon: để trống ("") thì game tự vẽ hình thay thế.
// id giữ nguyên (khớp js/levels.js dùng chung) — chỉ đổi label/icon.
// Khách có 4 món riêng (cà phê, máy ảnh, 2 mèo) → icon trong assets/characters/;
// món thứ 5 "Letter" giữ icon mặc định của game.
export const GIFTS = [
  { id: "matcha", label: "Coffee", icon: "assets/characters/Item-Coffee-01.png" },
  { id: "chocolate", label: "Camera", icon: "assets/characters/Item-Camera-01.png" },
  { id: "flower", label: "Tabby Cat", icon: "assets/characters/Item-CatBrown-01.png" },
  { id: "lipstick", label: "Snow Cat", icon: "assets/characters/Item-CatWhite-01.png" },
  { id: "letter", label: "Letter", icon: "assets/elements/Item-Envelope.png" },
];

// ---------- các mốc của chặng đi đôi ----------
// Mỗi mốc là một khung polaroid treo trên nền, theo thứ tự thời gian.
//   date, name : chú thích in dưới khung ảnh
//   photo      : đường dẫn ảnh (để "" nếu chưa có)
//   sky        : hai màu gradient bầu trời [trên, dưới]
//   event      : "rain"  → trời mưa, nhảy chướng ngại để nhặt ô rồi mới đi tiếp
//                "chest" → hòm hồng: System Message → Level Unlocked → lá thư
//                "gift"  → hòm quà rơi từ trời → video
// Ba mốc có event là phần kịch bản, nên giữ nguyên thứ tự ở cuối danh sách.
// Khách không muốn chữ dưới khung ảnh → date/name để "" ở mọi mốc (ô HUD khi đó hiện "Together ♥").
export const MILESTONES = [
  { date: "", name: "", sky: ["#dfe9ff", "#f6c7d8"], photo: "assets/photos/Moc Chou 25_.jpg" },
  { date: "", name: "", sky: ["#3b2a5a", "#b57aa8"], photo: "assets/photos/Anni 1st 25.04.jpg" },
  { date: "", name: "", sky: ["#bcd7ff", "#ffd9e8"], photo: "assets/photos/Tet 26_.jpg" },
  { date: "", name: "", sky: ["#3b2a5a", "#b57aa8"], photo: "assets/photos/Cung An Dinh Hue 26_.jpg" },
  { date: "", name: "", sky: ["#e3d3dc", "#b391a6"], photo: "assets/photos/Hue 26_.jpg" },
  { date: "", name: "", sky: ["#ffe6c9", "#ffd9e8"], photo: "assets/photos/film in Hue 26_.jpg" },
  { date: "", name: "", sky: ["#cfe6ff", "#ffe6c9"], photo: "assets/photos/Bien 26_.jpg" },
  { date: "", name: "", sky: ["#ffd9c4", "#ffe7ef"], photo: "assets/photos/Together.jpg" },
  { date: "", name: "", sky: ["#e7d6ea", "#f6d3de"], photo: "assets/photos/You and me.jpg" },
  { date: "", name: "", sky: ["#ffd9e0", "#ffe9d6"], photo: "assets/photos/Love.jpg" },
  {
    date: "", name: "", sky: ["#7fb7d9", "#cfe7f2"], photo: "",
    event: "rain",
    blocks: [{ x: 300 }, { x: 520, h: 2 }],
    platforms: [{ x: 640, w: 2, y: 110 }],
    itemAt: { x: 664, y: 166 },
  },
  { date: "", name: "", sky: ["#ffd9c4", "#ffe7ef"], photo: "", event: "chest" },
  { date: "", name: "", sky: ["#bfe0f2", "#e8f3ee"], photo: "", event: "gift" },
];

// ---------- nền parallax riêng ----------
// Để trống = nền 3 lớp mặc định của game (xem js/config.js gốc để biết cách khai báo nền riêng).
export const SCENE_LAYERS = {};

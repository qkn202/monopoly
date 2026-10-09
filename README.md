# 🏰 Hogwarts Monopoly 3D — Cờ Tỷ Phú Thế Giới Phù Thủy

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Demo-success?style=for-the-badge&logo=vercel)](https://hogwarts-monopoly.vercel.app)
[![GitHub Branch](https://img.shields.io/badge/GitHub-hogwarts--monopoly--online-blue?style=for-the-badge&logo=github)](https://github.com/qkn202/monopoly/tree/hogwarts-monopoly-online)
[![Built with React](https://img.shields.io/badge/React-18.x-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-black?style=for-the-badge&logo=three.js)](https://threejs.org)
[![Supabase Realtime](https://img.shields.io/badge/Supabase-Realtime%20Multiplayer-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)

**Hogwarts Monopoly 3D** là phiên bản Cờ Tỷ Phú ma thuật lấy cảm hứng từ thế giới Harry Potter, được xây dựng hoàn toàn bằng **React, TypeScript, Three.js (WebGL 3D)** và tích hợp hệ thống **Multiplayer Realtime Online** qua Supabase.

Trải nghiệm ngay bản phát hành chính thức tại: 👉 **[https://hogwarts-monopoly.vercel.app](https://hogwarts-monopoly.vercel.app)**

---

## 🌟 Điểm nổi bật & Tính năng chính

### 1. Bàn cờ 3D Three.js & Đồ họa Ma thuật
- **Bàn cờ 3D WebGL tương tác cao:** Raycasting nhận diện vị trí, hiệu ứng ánh sáng ma thuật theo thời gian thực và đổ bóng chân thực.
- **3 Chế độ Camera mượt mà:**
  - 🎥 **Toàn Cảnh (Overview):** Góc nhìn nghiêng 3D bao quát cả 40 ô đất và lâu đài Hogwarts.
  - 🏃‍♂️ **Tự Động Bám Theo (Auto-Follow):** Camera tự động xoay và lướt theo từng bước nhảy của quân cờ.
  - 🛰️ **Góc Nhìn Từ Trên Xuống (Top-Down):** Phẳng 2D truyền thống, quan sát dễ dàng trên màn hình nhỏ.
- **Tượng Quân Cờ Phù Thủy 3D:** Mỗi người chơi sở hữu mô hình thu nhỏ mang huy hiệu và màu sắc đặc trưng của từng Nhà, tự động nhảy theo điểm xúc xắc.

### 2. 4 Nhà Phù Thủy Hogwarts
- 🦁 **Gryffindor:** Đỏ thắm & Vàng kim — Dũng cảm và kiên cường.
- 🐍 **Slytherin:** Xanh ngọc & Bạc — Tham vọng và sắc bén.
- 🦅 **Ravenclaw:** Xanh biển & Đồng — Trí tuệ và thông thái.
- 🦡 **Hufflepuff:** Vàng & Đen — Trung thành và chăm chỉ.

### 3. Hệ thống Kinh tế & Địa danh Ma thuật
- **Vốn khởi điểm:** Mỗi phù thủy bắt đầu với **5,000 Galleons**.
- **40 Ô đất kinh điển:** Hẻm Xéo, Tiệm Đũa Phép Ollivander, Ngân Hàng Gringotts, Quán Ba Cây Chổi, Sân Quidditch, Tháp Thiên Văn, Rừng Cấm, v.v.
- **Nâng cấp Bất động sản linh hoạt:**
  - Xây từ **1 đến 4 Túp Lều** (`Cottage`) trên bất kỳ mảnh đất nào mình sở hữu (không bị khóa cứng bởi điều kiện gom đủ 100% bộ màu).
  - Nâng cấp tối thượng lên **🏰 Lâu Đài Hogwarts** khi ô đất đạt đủ 4 Túp Lều, nâng tiền thuê lên mức kỷ lục!
- **Hệ thống Thế chấp & Chuộc tài sản:** Hỗ trợ thế chấp nhận ngay 50% giá trị và chuộc lại với lãi suất 10% khi cần dòng tiền.

### 4. Cơ chế Đột biến & Tranh đấu Kịch tính
- ☠️ **Bão Lời Nguyền Hắc Ám (Dark Curse Escalation):**
  - Sau một số vòng đấu ngẫu nhiên (từ vòng 4 trở đi), Chúa tể Voldemort và Tử Thần Thực Tử trỗi dậy.
  - **Toàn bộ tiền thuê đất và thuế trên bàn cờ lập tức nhân đôi (x2)** kèm hiệu ứng sương mù đỏ máu và sấm sét rền vang!
- ⚡ **Thâu Tóm Cưỡng Chế (Hostile Takeover):**
  - Khi bước vào ô đất của đối thủ, nếu bạn có đủ tiềm lực tài chính (trả **gấp đôi x2 giá trị đất**), bạn có quyền **MUA ĐỨT** ô đất đó cùng toàn bộ nhà trên đất! Chủ đất cũ bắt buộc phải nhượng lại và nhận toàn bộ số tiền này.
- 🔨 **Đấu Giá Công Khai (Public Auction):**
  - Khi một người chơi bỏ qua việc mua đất trống, ô đất sẽ được đưa ra sàn đấu giá công khai với đồng hồ đếm ngược 6 giây. Người trả giá cao nhất sẽ giành được ô đất với mức giá hời.

### 5. Thẻ Bài Ma Thuật Huyền Bí
- 📜 **Thẻ Bùa Chú (Charms Deck):** Thưởng tiền thưởng, dịch chuyển tức thời, vé miễn giam Azkaban, bùa hộ mệnh.
- 🧪 **Thẻ Độc Dược (Potions Deck):** Sự cố nổ vạc, nộp phạt thuế Bộ Pháp Thuật, nộp tiền sửa chữa nhà cửa, bẫy trộm Gringotts.
- **Giao diện 3D Flip Card:** Rút thẻ bài chân thực với mặt lưng hoa văn ma thuật, lật thẻ 3D và hiển thị tranh minh họa chi tiết.

### 6. 🌐 Multiplayer Realtime Online (Backend Supabase)
- **Tạo phòng & Tham gia phòng bằng mã 4 ký tự (Room Code):** Tương tự như phong cách kết nối của các web game nổi tiếng (*7 Potter*, *Undercover*).
- **Đồng bộ hóa tức thời qua Supabase Realtime Broadcast:** Các lượt gieo xúc xắc, mua đất, nâng cấp nhà, rút thẻ bài và tin nhắn sự kiện được truyền tải song song giữa Host và Khách với độ trễ cực thấp.
- **Hỗ trợ Bot AI:** Nếu không đủ người chơi thực tế, bạn có thể thêm các đối thủ AI thông minh để luyện tập.
- **Chống treo ván đấu (Turn Timeout 60s):** Mỗi lượt đi có giới hạn 60 giây suy nghĩ. Hết giờ, Trợ lý Ma thuật sẽ tự động gieo xúc xắc hoặc kết thúc lượt để ván đấu luôn trôi chảy.

### 7. 📱 Hỗ trợ Đa nền tảng & Responsive
- Hoạt động mượt mà trên **Desktop màn hình rộng**, **Máy tính bảng (Tablet)** và **Điện thoại di động (Mobile Portrait)**.
- Giao diện màn hình dọc tối ưu với **Bottom Action Dock**, xem nhanh Bảng Xếp Hạng, Danh Mục Tài Sản và Nhật Ký Lịch Sử mà không che khuất bàn cờ 3D.

---

## ⌨️ Phím tắt tiện ích (Keyboard Shortcuts)

| Phím tắt | Thao tác |
| :---: | :--- |
| **`Space`** | Gieo xúc xắc / Thu cất thẻ bài / Kết thúc lượt đi |
| **`B`** | Mua đất nhanh / Thâu tóm cưỡng chế / Nâng cấp Túp Lều hoặc Lâu Đài |
| **`P`** | Bỏ qua cơ hội mua đất để chuyển sang Đấu Giá công khai |
| **`C`** | Chuyển đổi nhanh 3 chế độ Camera (`Overview` ➔ `Follow` ➔ `Top-Down`) |
| **`M`** | Bật / Tắt âm thanh ma thuật |

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ |
| :--- | :--- |
| **Giao diện (Frontend)** | React 18, TypeScript, Vanilla CSS (Design Tokens, Glassmorphism) |
| **Đồ họa 3D (3D Engine)** | Three.js, WebGL, Raycasting, OrbitControls |
| **Realtime Networking** | Supabase Realtime Channels (Broadcast Engine) |
| **Âm thanh (Audio)** | Web Audio API / Howler sound triggers |
| **Build & Tooling** | Vite, TypeScript Compiler (`tsc`) |
| **Triển khai (Deployment)** | Vercel Serverless Edge, GitHub Actions |

---

## 📁 Cấu trúc thư mục dự án

```
monopoly/
├── public/
│   ├── assets/
│   │   ├── cards/              # Hình ảnh thẻ bài 40 ô đất ma thuật
│   │   ├── audio/              # Hiệu ứng âm thanh gieo xúc xắc, mua đất, bão lời nguyền
│   │   └── textures/           # Vân bề mặt bàn cờ, crest 4 nhà Hogwarts
├── src/
│   ├── audio/
│   │   └── soundManager.ts     # Bộ quản lý âm thanh Web Audio
│   ├── core/
│   │   ├── boardData.ts        # Dữ liệu 40 ô đất, 4 Nhà, thẻ Bùa Chú & Độc Dược
│   │   ├── botAI.ts            # Thuật toán trí tuệ nhân tạo ra quyết định
│   │   ├── gameReducer.ts      # Reducer xử lý trạng thái cốt lõi của ván đấu
│   │   ├── reducerHelpers.ts   # Xử lý nợ nần, thanh lý tài sản, hiệu ứng thẻ bài
│   │   ├── rulesEngine.ts      # Luật tính tiền thuê, điều kiện xây nhà, xếp hạng
│   │   └── types.ts            # Hệ thống TypeScript Types & Interfaces
│   ├── network/
│   │   ├── supabaseClient.ts   # Khởi tạo Supabase client
│   │   └── multiplayerSession.ts # Kiến trúc kết nối Host - Guest qua Realtime Broadcast
│   ├── ui/
│   │   ├── BoardThreeJS.tsx    # Thành phần đồ họa 3D Three.js WebGL
│   │   ├── CardInspectModal.tsx# Modal soi thẻ bài 3D flip card
│   │   ├── DarkCurseModal.tsx  # Modal cảnh báo Bão Lời Nguyền Hắc Ám Voldemort
│   │   ├── Lobby.tsx           # Phòng chờ: tạo phòng, nhập mã phòng, chọn Nhà
│   │   ├── RightSidebar.tsx    # Bảng điều khiển, sàn đấu giá, tài sản & bảng xếp hạng
│   │   └── WinModal.tsx        # Modal vinh danh nhà vô địch khi hết 30 phút
│   ├── App.tsx                 # Điểm kết nối logic game, phím tắt & layout chính
│   └── main.tsx                # Entry point
├── scripts/
│   ├── test_upgrade_and_build.ts   # Unit test nâng cấp bất động sản & hạ cánh
│   ├── test_audit_fixes.ts         # Test suite 11 bài test kiểm tra logic toàn diện
│   └── test_multiplayer_supabase.ts# Test suite kiểm tra đồng bộ Realtime
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🚀 Hướng dẫn cài đặt & Chạy cục bộ (Local Development)

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 18.0 trở lên.
- **npm** (hoặc `pnpm` / `yarn`).

### Các bước cài đặt

1. **Clone repository về máy:**
   ```bash
   git clone https://github.com/qkn202/monopoly.git
   cd monopoly
   git checkout hogwarts-monopoly-online
   ```

2. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

3. **Tạo file cấu hình môi trường `.env` (Tùy chọn cho Multiplayer Online):**
   ```env
   VITE_SUPABASE_URL=https://fxucyrofcsuqtlkukcrx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_zEiG2Py5kDmGhkTgw0uWIA_We0rOCGu
   ```

4. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại: `http://localhost:5173`

5. **Chạy các bộ kiểm thử tự động:**
   ```bash
   # Kiểm tra logic xây nhà và nâng cấp
   npx tsx scripts/test_upgrade_and_build.ts

   # Kiểm tra toàn bộ 11 kịch bản kiểm toán game
   npx tsx scripts/test_audit_fixes.ts

   # Kiểm tra kết nối mạng Multiplayer Supabase
   npx tsx scripts/test_multiplayer_supabase.ts
   ```

6. **Đóng gói sản phẩm:**
   ```bash
   npm run build
   ```

---

## 📜 Giấy phép & Tuyên bố miễn trừ trách nhiệm (Credits & Disclaimer)

- Dự án được phát triển cho mục đích học tập, nghiên cứu và giải trí phi thương mại.
- Lấy cảm hứng từ luật chơi **Monopoly** kinh điển của Hasbro kết hợp với bối cảnh thế giới phù thủy **Harry Potter** thuộc bản quyền của J.K. Rowling và Warner Bros. Entertainment Inc.
- Phát hành dưới giấy phép mã nguồn mở **MIT License**.

---

🧙‍♂️ *Chúc các phù thủy có những giờ phút đấu trí đỉnh cao tại Hogwarts!* 🎲⚡🏰

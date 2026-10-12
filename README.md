# 🏰 Hogwarts Monopoly 3D — Cờ Tỷ Phú Thế Giới Phù Thủy

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Demo-success?style=for-the-badge&logo=vercel)](https://hogwarts-monopoly.vercel.app)
[![GitHub Branch](https://img.shields.io/badge/GitHub-hogwarts--monopoly--online-blue?style=for-the-badge&logo=github)](https://github.com/qkn202/monopoly/tree/hogwarts-monopoly-online)
[![Built with React](https://img.shields.io/badge/React-18.x-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-black?style=for-the-badge&logo=three.js)](https://threejs.org)
[![HPVN Integration](https://img.shields.io/badge/HPVN-Game%20Zone%20Bridge-purple?style=for-the-badge)](https://hpvn-archive.net)

**Hogwarts Monopoly 3D** là phiên bản Cờ Tỷ Phú ma thuật lấy cảm hứng từ thế giới Harry Potter, được xây dựng hoàn toàn bằng **React, TypeScript, Three.js (WebGL 3D)**, tối ưu đồ họa **WebP thế hệ mới** và tích hợp hệ thống phòng chơi trực tuyến qua **HPVN Room Bridge**.

Trải nghiệm ngay bản phát hành chính thức tại: 👉 **[https://hogwarts-monopoly.vercel.app](https://hogwarts-monopoly.vercel.app)**

---

## 🌟 Điểm nổi bật & Tính năng chính

### 1. Bàn cờ 3D Three.js & Đồ họa Ma thuật
- **Bàn cờ 3D WebGL tương tác cao:** Raycasting nhận diện vị trí, hiệu ứng ánh sáng ma thuật theo thời gian thực và đổ bóng chân thực.
- **Tối ưu tài nguyên WebP:** Toàn bộ 40 thẻ bài, mặt lưng bùa chú/độc dược và huy hiệu Hogwarts trung tâm đều sử dụng định dạng WebP siêu nhẹ, giảm dung lượng tải trang ~80%, build bundle chỉ dưới 1 giây.
- **3 Chế độ Camera cố định chuẩn mực:**
  - 👁️ **Toàn Cảnh (Overview):** Góc nghiêng 2.5D bao quát toàn bộ 40 ô đất và lâu đài Hogwarts (tối ưu tự động tỉ lệ màn hình ngang/dọc).
  - 🎥 **Bám Theo (Follow):** Camera tự động zoom và bám theo từng bước nhảy của quân cờ.
  - 📐 **Góc Nhìn Từ Trên Xuống (Top-Down):** Góc nhìn phẳng 90° truyền thống, thuận tiện quan sát chiến thuật.
- **Hệ thống màu theo Quyền sở hữu (Ownership System):** Ô đất đổi màu viền và đèn hiệu theo Nhà của chủ đất (🦁 Gryffindor: Đỏ | 🐍 Slytherin: Xanh lục | 🦅 Ravenclaw: Xanh dương | 🦡 Hufflepuff: Vàng). Đất chưa ai mua hiển thị màu trung tính.
- **Tượng Quân Cờ Phù Thủy 3D:** Mô hình quân cờ mang huy hiệu Nhà đặc trưng, tự động di chuyển theo điểm gieo xúc xắc.

### 2. 4 Nhà Phù Thủy Hogwarts
- 🦁 **Gryffindor:** Đỏ thắm & Vàng kim — Dũng cảm và kiên cường.
- 🐍 **Slytherin:** Xanh ngọc & Bạc — Tham vọng và sắc bén.
- 🦅 **Ravenclaw:** Xanh biển & Đồng — Trí tuệ và thông thái.
- 🦡 **Hufflepuff:** Vàng & Đen — Trung thành và chăm chỉ.

### 3. Hệ thống Kinh tế & Địa danh Ma thuật
- **Vốn khởi điểm:** Mỗi phù thủy bắt đầu với **5,000 Galleons**.
- **40 Ô đất kinh điển:** Hẻm Xéo, Tiệm Đũa Phép Ollivander, Ngân Hàng Gringotts, Quán Ba Cây Chổi, Sân Quidditch, Tháp Thiên Văn, Rừng Cấm, v.v.
- **Định dạng tiền tệ Galleons (`g` / `galleons`):** Hiển thị trực quan, ngắn gọn, có phân cách phần ngàn chuẩn mực.

---

## 📋 Luật Chơi Chi Tiết & Chuẩn Mực (Game Rules)

### Quy Tắc Sở Hữu & Xây Dựng (Building Rules)

| Quy Tắc | Mô Tả |
| :--- | :--- |
| **Chỉ đứng ở property đó mới được xây** | Người chơi chỉ có thể mua nhà / nâng cấp Lâu đài trên đúng ô đất mà nhân vật đang dừng chân (`player.position === tile.index`). Các mảnh đất khác tuyệt đối không được phép nâng cấp. |
| **Phải đặt chân từ lần 2 trở đi** | Lần 1 (mua đất): chỉ mua quyền sở hữu ô đất thô, chưa được xây nhà. Lần 2+: khi quay lại dừng chân đúng ô đất đã sở hữu, mới được nâng cấp. |
| **Mỗi lần ghé thăm chỉ 1 lần** | Sau khi xây 1 nhà (hoặc chọn Bỏ qua), quyền nâng cấp kết thúc. Phải đi một vòng và dừng chân lại ô đó lần sau mới được nâng cấp tiếp. |
| **Monopoly Bonus** | Khi sở hữu trọn vẹn bộ màu nhưng chưa xây nhà, tiền thuê cơ bản tự động tăng **GẤP ĐÔI (x2)**. |
| **🏰 Lâu Đài Hogwarts** | Khi ô đất đạt mốc 4 Túp Lều, người chơi có thể nâng cấp tối thượng lên Lâu Đài Hogwarts để tăng tiền thuê lên mức cao nhất! |

### Quy Tắc Thế Chấp & Thanh Lý (Mortgage Rules)

| Quy Tắc | Mô Tả |
| :--- | :--- |
| **Không xây nhà khi thế chấp** | Không thể xây thêm nhà trên ô đất đang bị thế chấp. |
| **Không thế chấp khi còn nhà** | Phải **bán hết toàn bộ nhà** trên nhóm màu đó trước khi có thể thế chấp bất kỳ ô đất nào. |
| **Tiền thế chấp & Chuộc lại** | Thế chấp nhận ngay **50% giá mua đất**. Phí chuộc lại = **110% giá trị thế chấp** (10% lãi suất). |
| **Miễn thu tiền thuê** | Ô đất đang thế chấp sẽ không thu được tiền thuê khi người khác bước vào. |

### Quy Tắc Tù Azkaban & Xúc Xắc

| Quy Tắc | Mô Tả |
| :--- | :--- |
| **3 Lần Đôi liên tiếp** | Gieo được 3 lần xúc xắc đôi liên tiếp trong cùng 1 lượt → Vào ngay Tù ngục Azkaban. |
| **3 Lượt ở Tù** | Người chơi có tối đa 3 lượt trong tù. Có thể thoát bằng cách: gieo xúc xắc đôi, trả tiền bảo lãnh 150G, hoặc dùng Thẻ Miễn Giam. |
| **Phạt tù lượt 3** | Sau 3 lượt không gieo được đôi, bắt buộc nộp phạt 150G để ra tù. Nếu không đủ tiền, chuyển sang pha Phá Sản. |
| **Vượt Ga 9¾ (GO)** | Nhận ngay **500 Galleons** trợ cấp mỗi khi hoàn thành 1 vòng bàn cờ. |

### Quy Tắc Phá Sản & Trả Nợ Tự Động (Bankruptcy Phase)

| Quy Tắc | Mô Tả |
| :--- | :--- |
| **Kích hoạt Phá Sản** | Khi thiếu tiền nộp thuế, phạt tù hoặc trả tiền thuê đất, game sẽ chuyển sang pha `BANKRUPTCY`. |
| **Bảng điều khiển tài chính** | Giao diện tự động liệt kê: danh sách **Nhà có thể BÁN** (thu lại 50% tiền xây) và **Tài sản có thể THẾ CHẤP** (+Galleons). |
| **Auto-Pay (`checkAndPayDebt`)** | Ngay khi người chơi thế chấp hoặc bán nhà đủ số tiền nợ, hệ thống **tự động thanh toán nợ và tiếp tục ván đấu**. |
| **Timeout 60 giây an toàn** | Hết 60 giây mà người nợ không xoay đủ tiền để trả → Hệ thống tự động tuyên bố phá sản và thanh lý tài sản cho chủ nợ / ngân hàng. |

---

## ⚡ Cơ chế Đột biến & Tranh đấu Kịch tính

- 💰 **Quản lý Thu Chi Cá Nhân & Tài Sản Thu Thuế Nhiều Nhất (Personal Cashflow Tab):**
  - Tab **"Thu chi"** nằm ngay cạnh tab "Nhật ký" trên thanh điều hướng bên phải (desktop, collapsed rail và mobile drawer).
  - **Khóa thông tin cá nhân 100%:** Chỉ hiển thị duy nhất dữ liệu tài chính của chính bạn, hoàn toàn không hiển thị thông tin hay nút chuyển đổi của người chơi khác.
  - **👑 TÀI SẢN THU THUẾ / THUÊ NHIỀU NHẤT CỦA BẠN:** Tự động vinh danh mảnh đất **thuộc sở hữu của bạn** mà đối thủ đã nộp tiền thuê nhiều nhất (tổng tiền đã thu, số lượt khách ghé, tiền thu bình quân, lần nộp gần nhất).
  - **Hero KPI Cards:** Thống kê Tổng Tiền Thu Vào, Tổng Tiền Chi Ra và Dòng Tiền Ròng (+/- Galleons) theo thời gian thực của bạn.
  - **Sổ cái Lượt đấu Cá nhân (Personal Turn Ledger):** Ghi chép chi tiết từng lượt đi của bạn hoặc các lượt mà đối thủ tương tác tiền tệ với bạn (ví dụ nộp tiền thuê cho bạn), loại bỏ các lượt không liên quan. Hỗ trợ 2 chế độ lọc: *Tất cả lượt* hoặc *Chỉ lượt có thu/chi*.
- 📜 **Nhật Ký Cá Nhân Hóa (Personalized Event Logs):**
  - Mỗi người chơi sở hữu một dòng thời gian nhật ký riêng biệt, chỉ lưu giữ và hiển thị những sự kiện liên quan trực tiếp đến bản thân (tiền thuê đã nhận/đã trả, bất động sản bị mua đứt/mua lại, nâng cấp công trình của mình), loại bỏ hoàn toàn các thông báo rác không liên quan.
- ⚖️ **Phân Bổ Tài Sản Khi Phá Sản (Bankruptcy Redistribution):**
  - Khi một người chơi phá sản với chủ nợ là Ngân hàng, toàn bộ bất động sản được chia đều cho các phù thủy còn lại.
  - Người chơi có tổng tài sản (Net Worth) **thấp nhất được ưu tiên chọn đất trước** (Poorest-first snake draft).
  - Những mảnh đất lẻ không thể chia đều sẽ được thanh lý thành tiền mặt theo giá niêm yết và chia đều 100% cho mọi người còn sống sót.
- ☠️ **Biến Động Thuế Hắc Ám (Dark Curse Dynamic Escalation):**
  - Bắt đầu từ **phút thứ 15** của ván đấu, cứ sau **mỗi 5 phút** (phút 15, 20, 25...), thế lực Hắc Ám trỗi dậy khiến mức thuế và tiền thuê trên bàn cờ **ngẫu nhiên thay đổi từ x2 đến x5** (`x2`, `x3`, `x4`, `x5`) cho đến hết ván đấu!
  - Đi kèm giao diện chiếu chỉ ma thuật và hiệu ứng âm thanh sấm chớp rùng rợn.
- ⚡ **Thâu Tóm Cưỡng Chế (Hostile Takeover):**
  - Khi bước vào ô đất của đối thủ, nếu bạn có đủ tiềm lực tài chính (trả **gấp đôi x2 giá trị đất + nhà**), bạn có quyền **MUA ĐỨT** ô đất đó cùng toàn bộ công trình trên đất! Chủ đất cũ bắt buộc phải nhượng lại và nhận toàn bộ số tiền này.
- 🔨 **Đấu Giá Công Khai (Public Auction):**
  - Khi một người chơi bỏ qua việc mua đất trống, ô đất sẽ được đưa ra sàn đấu giá công khai với đồng hồ đếm ngược.
  - Người trả giá cao nhất sẽ giành được ô đất với mức giá hời.
  - Người rút lui khỏi đấu giá sẽ bị loại khỏi vòng đấu giá hiện tại; những người còn lại tiếp tục đấu giá.

---

## 🌐 Hệ thống Kết nối Phòng & Lưu Trữ HPVN

- **HPVN Room Bridge (`src/hpvn/bridge.ts`):** Kết nối phòng chơi mượt mà trong hệ sinh thái game HPVN, hỗ trợ cả chơi một mình với Bot AI hoặc chơi nhiều người trực tuyến.
- **Lưu trữ Ván đấu Tự Động (`saveGame.ts`):** Ván đấu được lưu cục bộ với thuật toán nén snapshot (dưới 16,000 ký tự trên tổng ngân sách 31,200), tự khôi phục ván đấu khi vô tình reload trang.
- **Tự động hóa & Chống treo:** Turn Timeout 60s cho mỗi lượt đi, hỗ trợ chế độ Siêu Tốc (Turbo 2x speed) cho bot.

---

## ⌨️ Phím tắt tiện ích (Keyboard Shortcuts)

| Phím tắt | Thao tác |
| :---: | :--- |
| **`Space`** | Gieo xúc xắc / Thu cất thẻ bài / Kết thúc lượt đi |
| **`B`** | Mua đất nhanh / Thâu tóm cưỡng chế / Nâng cấp Túp Lều hoặc Lâu Đài |
| **`P`** | Bỏ qua cơ hội mua đất để chuyển sang Đấu Giá công khai |
| **`C`** | Chuyển đổi nhanh 3 chế độ Camera (`👁️ Overview` ➔ `🎥 Follow` ➔ `📐 Top-Down`) |
| **`M`** | Bật / Tắt âm thanh ma thuật |

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ |
| :--- | :--- |
| **Giao diện (Frontend)** | React 18, TypeScript, Vanilla CSS (Design Tokens, Glassmorphism, HPVN Design System) |
| **Đồ họa 3D (3D Engine)** | Three.js, WebGL, WebP Texture Streaming, Raycasting |
| **Networking & Bridge** | HPVN Room Bridge, PostMessage Window Protocol, Local Snapshot Engine |
| **Âm thanh (Audio)** | Web Audio API / Sound Effects ma thuật |
| **Kiểm thử (Testing)** | `tsx`, Node.js test suites (HPVN core, 11 Audit Tests, Build & Upgrade Rules) |
| **Build & Tooling** | Vite 5, TypeScript Compiler (`tsc`) |
| **Triển khai (Deployment)** | Vercel Serverless Production, GitHub Actions |

---

## 📁 Cấu trúc thư mục dự án

```
monopoly/
├── public/
│   ├── assets/
│   │   ├── cards/              # Toàn bộ 40 thẻ bài đất ma thuật chuẩn WebP tối ưu
│   │   ├── audio/              # Hiệu ứng âm thanh gieo xúc xắc, mua đất, bão lời nguyền
│   │   └── textures/           # Vân bề mặt bàn cờ, crest 4 nhà Hogwarts
├── src/
│   ├── audio/
│   │   └── soundManager.ts     # Bộ quản lý âm thanh Web Audio
│   ├── core/
│   │   ├── boardData.ts        # Dữ liệu 40 ô đất, 4 Nhà, thẻ Bùa Chú & Độc Dược
│   │   ├── botAI.ts            # Thuật toán trí tuệ nhân tạo ra quyết định
│   │   ├── gameReducer.ts      # Reducer xử lý trạng thái cốt lõi, phá sản & trả nợ tự động
│   │   ├── reducerHelpers.ts   # Xử lý nợ nần, thanh lý tài sản, hiệu ứng thẻ bài
│   │   ├── rulesEngine.ts      # Ràng buộc đủ bộ màu, tính tiền thuê, xếp hạng
│   │   ├── actionAuth.ts       # Xác thực quyền hành động theo lượt
│   │   └── types.ts            # Hệ thống TypeScript Types & Interfaces
│   ├── hpvn/
│   │   ├── bridge.ts           # Cầu nối phòng chơi HPVN Archive
│   │   ├── onlineGame.ts       # Điều phối ván đấu online
│   │   ├── saveGame.ts         # Cơ chế lưu trữ và phục hồi snapshot ván đấu
│   │   ├── money.ts            # Định dạng tiền tệ Galleons chuẩn
│   │   ├── OnlineLobby.tsx     # Giao diện sảnh chờ kết nối phòng
│   │   └── hpvn.css            # Stylesheet chuẩn HPVN
│   ├── render/
│   │   ├── BoardCards.ts       # Vẽ 40 lá bài đất 3D với texture WebP
│   │   ├── BoardTokens.ts      # Quản lý quân cờ 3D & animation di chuyển
│   │   ├── Board3DDice.ts      # Mô phỏng xúc xắc 3D vật lý
│   │   └── BoardFrame.ts       # Khung bàn cờ Hogwarts
│   ├── ui/
│   │   ├── BoardThreeJS.tsx    # Thành phần đồ họa 3D Three.js WebGL
│   │   ├── RightSidebar.tsx    # Bảng điều khiển, sàn đấu giá, quản lý phá sản/thế chấp
│   │   ├── ActiveCardModal.tsx # Modal thẻ bùa chú / độc dược
│   │   └── DarkCurseModal.tsx  # Cảnh báo Lời Nguyền Hắc Ám Voldemort
│   ├── App.tsx                 # Điểm kết nối logic game, phím tắt & layout chính
│   └── main.tsx                # Entry point
├── scripts/
│   ├── test-hpvn-core.ts               # Test suite kiểm tra mạng, quyền ghế và snapshot HPVN
│   ├── test_audit_fixes.ts             # Test suite 11 bài test kiểm tra logic toàn diện
│   ├── test_upgrade_and_build.ts       # Unit test quy tắc đặt chân lần 2, nâng cấp và hạ cánh
│   ├── test_personal_event_logs.ts     # Unit test nhật ký cá nhân hóa cho từng người chơi
│   ├── test_bankruptcy_distribution.ts # Unit test chia đều tài sản & draft khi phá sản
│   ├── test_finances_cashflow.ts       # Unit test sổ thu chi cá nhân & tài sản thu thuế nhiều nhất
│   └── test_dynamic_tax_escalation.ts  # Unit test biến động thuế ngẫu nhiên từ phút 15 cứ sau 5'
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

3. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại: `http://localhost:3000`

4. **Chạy toàn bộ 7 bộ kiểm thử tự động:**
   ```bash
   npm run test:hpvn
   ```
   *(Bao gồm: Test HPVN core + 11 bài test audit logic + Quy tắc nâng cấp lần 2 + Nhật ký cá nhân + Phân bổ phá sản + Thu chi cá nhân + Biến động thuế ngẫu nhiên phút 15).*

5. **Đóng gói sản phẩm (Build Production):**
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

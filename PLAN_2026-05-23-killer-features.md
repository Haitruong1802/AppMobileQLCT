# PLAN — Killer Features Bux2 (ăn đứt đối thủ)

**Ngày:** 2026-05-23
**Trạng thái:** Đang chờ đại ca duyệt — em CHƯA code gì
**Mục tiêu:** Tìm 5-10 chức năng KILLER mà Komorebi Sổ thu chi + Money Pro không có hoặc làm dở, đủ sức kéo user bỏ app cũ.

---

## 1. Bức tranh cạnh tranh — Bux2 vs đối thủ

### 1.1 Komorebi "Sổ thu chi: Quản lý chi tiêu" (#50 Tài Chính VN, 293k ratings)

**Mạnh:**
- Brand cũ, lượng tải lớn, review nhiều → niềm tin sẵn
- UI đơn giản, ai cũng xài được
- Có lịch grid, báo cáo cơ bản, ngân sách, vài ví
- Free, ít quảng cáo

**Yếu (cơ hội cho mình):**
- Không có **smart categorize** (toàn nhập tay từng cái)
- Không có **scan hoá đơn** (xoá đi vẫn còn đa số app khác có)
- Báo cáo "phẳng" — chỉ pie + tổng, không drill-down, không so sánh
- **Không có nhận xét/coach** kiểu personalize
- **Không cảnh báo vượt ngân sách** push notification kịp lúc
- **Khoá app yếu** — chỉ PIN, không biometric, không auto-lock
- Không export CSV/JSON, lock user vào app
- Không có **mục tiêu tiết kiệm trực quan** (chỉ có ngân sách)
- Không có nudge thông minh / GenZ
- Không có **heatmap năm**, không **week-over-week comparison**
- Không **multi-wallet transfer** đúng nghĩa
- Không **recurring rule** auto-tạo giao dịch hàng tháng
- Không **calendar grid** với chấm theo ngày
- Không **theme đa palette**
- UI cũ kỹ, font xấu, không Lucide-style modern

### 1.2 Money Pro (iBear, #1 Tài Chính VN)

**Mạnh:**
- iCloud sync, cross-device
- Multi-currency
- Báo cáo nâng cao
- Có Apple Watch
- Bán hàng tốt → có ngân sách marketing

**Yếu:**
- **Paywall sớm**, chức năng cơ bản cũng phải Pro
- Phức tạp, học ít nhất 30p mới xài được
- **Không có AI/coach** — toàn data thuần
- **Không scan hoá đơn local** (chỉ manual)
- Tone "kế toán nghiêm túc", không gần gũi
- Không gamification
- Không **smart nudge** GenZ
- Không tối ưu cho user VN (currency mặc định USD, danh mục Tây)

### 1.3 Bux2 đang có (tính tới v3.5)

✅ DB local SQLite, schema 11 bảng
✅ 5 tabs: Nhập / Lịch (grid + heatmap) / Báo cáo / Ngân sách / Khác
✅ Multi-wallet + transfer giữa ví
✅ Recurring rule (auto tạo giao dịch định kỳ)
✅ Bills (hoá đơn định kỳ)
✅ Savings goals
✅ Local smart categorize (60+ từ khoá VN + learn từ user)
✅ Local insight engine (template-based, no API)
✅ Smart nudge GenZ (notification từ data thật)
✅ PIN + biometric + auto-lock 5p
✅ Reset DB với confirm gõ "XOÁ"
✅ Year heatmap, calendar grid, drill-down report, week comparison, biggest tx
✅ 5 theme palette
✅ Onboarding flow
✅ Export JSON
✅ 100% offline, không tốn API

❌ Vẫn KHÔNG đủ killer → đại ca nói chuẩn

---

## 2. Phân loại killer features (10 lựa chọn)

Em chia thành 5 nhóm, mỗi nhóm 2 ý. Đại ca chọn 2-3 để build tiếp.

---

### NHÓM A — Money insight cấp độ kế toán cá nhân (vừa-AI vừa-không-AI)

#### A1. **"Số dư an toàn"** (Safe-to-spend) — bản VN của Cleo / Copilot
- **Cái gì:** Mỗi sáng hiển thị 1 con số duy nhất ở dashboard: *"Hôm nay xài tối đa 230k thì đủ tới cuối tháng"*.
- **Tính bằng:** `(thu_dự_kiến_tháng - chi_đã_phát_sinh - bill_còn_lại - savings_target) / số_ngày_còn_lại`
- **Vì sao killer:** Cả 2 đối thủ KHÔNG có. User không cần học báo cáo, chỉ nhìn 1 con số là biết nay xài bao nhiêu.
- **Effort:** 1 component dashboard + 1 hàm tính. ~3h.
- **Yếu tố khác biệt:** Cá nhân hoá theo lương + bill recurring, đối thủ không có recurring tốt nên không tính được.

#### A2. **"Dự báo cuối tháng"** — forecast với confidence
- **Cái gì:** Bảng so sánh: "Theo tốc độ này, tháng này em sẽ chi ~5.4tr (tin cậy 80%) — vượt ngân sách 400k".
- **Tính bằng:** Regression đơn giản trên transactions tháng này + so với 3 tháng trước.
- **Vì sao killer:** Đối thủ chỉ hiển thị "đã chi", không "sẽ chi". Đây là góc nhìn proactive.
- **Effort:** ~4h, cần lưu snapshot tháng cũ.

---

### NHÓM B — Cảm xúc & gắn bó (gamification + cá nhân hoá)

#### B1. **"Streak ghi sổ"** — chuỗi ngày + huy hiệu
- **Cái gì:** Mỗi ngày user ghi ≥1 giao dịch → streak +1. Hiển thị 🔥 7, 🔥 30, 🔥 100 ở header. Có lịch chấm streak.
- **Phần thưởng:** Khi đạt mốc (7/30/90/365) → animation + huy hiệu lưu vào "Bộ sưu tập" trong Khác.
- **Vì sao killer:** Đối thủ 0% gamification. User ghi sổ là việc *khó duy trì* — streak giải quyết.
- **Effort:** ~3h (1 bảng DB streak, badge UI).
- **Lưu ý:** Phải có "1 ngày bảo hiểm" / tuần để không streak gãy vì 1 hôm quên.

#### B2. **"Persona / Avatar tài chính"** — like Spotify Wrapped mini
- **Cái gì:** Mỗi tháng app phân tích user thành 1 trong 8 persona dựa style chi tiêu:
  - "Foodie Quận 1" — chi >40% cho ăn ngoài
  - "Shopaholic" — top category là quần áo/làm đẹp
  - "Couch Investor" — saving rate >30%
  - "Night Owl" — chi >50% sau 21h
  - "FOMO Buyer" — nhiều TX nhỏ < 50k
  - "Latte Sensei" — cà phê > 800k/tháng
  - "Đi-chợ-mẹ" — chi nhiều cho category Gia đình
  - "Balance Master" — chi đều khắp các category
- **Hiển thị:** Card lớn cuối tháng + chia sẻ ảnh ra TikTok/Insta.
- **Vì sao killer:** Viral organic. User chụp share = quảng cáo miễn phí. Wrapped là format đỉnh.
- **Effort:** ~5h (logic phân loại + 8 card design + share image bằng `expo-sharing` + canvas).
- **Mô hình thị trường:** Spotify Wrapped + Bee Care = mẫu hình cực mạnh ở VN.

---

### NHÓM C — Quét hoá đơn / OCR local (offline)

#### C1. **"Quét bill bằng camera + OCR local"** — không dùng cloud
- **Cái gì:** Mở camera → chụp hoá đơn (siêu thị, GrabFood, ShopeeFood) → app parse số tiền + tên cửa hàng + ngày → preview cho user xác nhận.
- **Cách làm:** Dùng `expo-image-picker` + thư viện OCR local như **react-native-text-recognition** (Apple Vision iOS / ML Kit Android) — MIỄN PHÍ, on-device.
- **Vì sao killer:** Komorebi không có. Money Pro yêu cầu nhập tay. Đây là *moat lớn nhất* — vì OCR phải tích hợp native module, gây khó copy nhanh.
- **Effort:** ~6h (OCR setup + parse VN format hoá đơn + UI preview).
- **Lưu ý:** Cần "dev client" build (không chạy Expo Go nguyên thuỷ). Đại ca cân nhắc.

#### C2. **"Auto parse SMS ngân hàng"** (Android only)
- **Cái gì:** Đọc SMS từ VCB/MB/TCB/ACB v.v., parse "TK +500.000 lúc..." → tự đề xuất tạo giao dịch.
- **Cách làm:** `expo-sms` chỉ gửi không đọc. Cần custom native (read SMS permission Android).
- **Vì sao killer:** VN app duy nhất nào làm được đều thắng.
- **Effort:** ~8h (Android only, iOS bỏ).
- **Rủi ro:** Permission READ_SMS bị Google Play hạn chế cực gắt từ 2019. **Có khả năng bị từ chối submit.**
- **Em đánh giá:** RISKY. Skip nếu đại ca không có ngân sách kháng nghị.

---

### NHÓM D — Cộng đồng & social (tăng retention)

#### D1. **"So bì với mọi người"** (Benchmark VN — anonymous)
- **Cái gì:** User thấy: "Chi cho cà phê 800k/tháng → cao hơn 67% người VN cùng tuổi". Số liệu fake-real (hardcode từ research thị trường VN) hoặc thật nếu đại ca chấp nhận có server.
- **Pha 1 (offline):** Hardcode dataset benchmark theo độ tuổi/giới tính/thu nhập.
- **Pha 2 (online — sau):** Tự built Supabase free → user opt-in gửi tổng (không gửi từng TX) → app tính benchmark real-time.
- **Vì sao killer:** Cảm giác "mình đang ở đâu trong xã hội" cực mạnh ở VN. Đối thủ không có.
- **Effort Pha 1:** ~4h. Pha 2: 12h.

#### D2. **"Chia ví chung với người yêu / gia đình"** — couple book / family book
- **Cái gì:** 2 device cùng share 1 book bằng QR code → 2 user cùng add transaction, đồng bộ qua server tối thiểu (Supabase free 500MB).
- **Vì sao killer:** Vợ chồng VN cần đồng quản lý chi tiêu — đây là pain HUGE. Bee Care + Couple v.v. làm được nhưng không chuyên về tiền.
- **Effort:** ~10h (cần Supabase + auth + sync logic + invite code).
- **Rủi ro:** Đại ca đã ẩn multi-book rồi — cần re-open. Cần backend hạ tầng.

---

### NHÓM E — Tâm lý chi tiêu (psychology layer)

#### E1. **"Cool-down 5 giây"** — anti-impulse buying
- **Cái gì:** Khi user nhập 1 chi tiêu > X (vd 200k) cho category "Giải trí/Quần áo/Trà sữa" → màn hình hiện popup 5 giây countdown: *"Khoản này = 4 ly cà phê đó. Vẫn muốn ghi?"* — phải chờ 5s mới bấm xác nhận được.
- **Mục đích:** Giúp user *cân nhắc* trước khi tiêu (vì ghi sổ = đã tiêu, nhưng warning vẫn có giá trị tâm lý).
- **Biến thể:** Áp dụng cho cảnh báo budget vượt — buộc "tôi-vẫn-chi" có ý thức.
- **Vì sao killer:** App đầu tiên ở VN có *behavioral nudge* dạng này. Truyền thông được. *"App ngăn bạn xài hoang"* là angle viral.
- **Effort:** ~2h (1 modal + setting toggle).
- **Em cực thích cái này** vì rẻ + viral cao.

#### E2. **"Chế độ Tiết kiệm 30 ngày"** — challenge mode
- **Cái gì:** User chọn challenge: "30 ngày không trà sữa" / "Tuần không Grab" / "Tháng nay tiết kiệm 2tr". App track + hiển thị progress thanh đẹp + nhắc nhở.
- **Khi hoàn thành:** Huy hiệu + animation + share image.
- **Vì sao killer:** Đối thủ chỉ có *budget* (cứng). Đây là *challenge* (tự deal với bản thân). Cảm giác game hơn.
- **Effort:** ~4h.

---

## 3. Đề xuất combo cho đại ca

Em đề xuất 3 combo, đại ca chọn 1:

### COMBO ⚡ "Viral nhanh — ~10h work"
- **A1** Số dư an toàn (3h)
- **B1** Streak ghi sổ (3h)
- **E1** Cool-down 5 giây (2h)
- **B2** Persona tháng + share (5h)

> Tổng ~13h. Build trong 2-3 ngày. Đủ killer để user khoe trên TikTok → tăng tải organic. Không cần backend.

### COMBO 🏰 "Moat sâu — ~15h work"
- **C1** OCR scan hoá đơn local (6h) — cần dev client
- **A1** Số dư an toàn (3h)
- **A2** Dự báo cuối tháng (4h)
- **E1** Cool-down 5 giây (2h)

> Tổng ~15h. OCR là chỗ đối thủ KHÓ copy nhanh. Combo này thiên về "công nghệ".

### COMBO 💑 "Social play — ~20h work"
- **D2** Ví chung 2 người (10h) — cần Supabase
- **B1** Streak (3h)
- **B2** Persona (5h)
- **A1** Safe-to-spend (3h)

> Tổng ~21h. Khó nhất nhưng moat lâu nhất. Cần đại ca approve setup Supabase free.

---

## 4. Khuyến nghị của em

Em chọn **COMBO ⚡ "Viral nhanh"** vì:

1. **Offline 100%** — đúng định hướng đại ca (không API, không backend).
2. **Build nhanh** trong 2-3 ngày, ship được luôn.
3. **B2 Persona + share** là vũ khí marketing siêu rẻ — mỗi user share 1 ảnh = 1 ad. Komorebi 0% có.
4. **E1 Cool-down** + **A1 Safe-to-spend** là angle truyền thông: *"App tài chính đầu tiên có Behavioral Coach"*.
5. **B1 Streak** giải quyết retention (đối thủ rớt user vì user lười ghi sổ).

Sau khi 4 cái này ổn → tới Combo Moat (OCR) hoặc Social.

---

## 5. Mock minh hoạ (text)

### Dashboard sau khi có A1 + B1:

```
┌──────────────────────────────┐
│ 🔥 Streak 12 ngày            │
├──────────────────────────────┤
│  Hôm nay xài tối đa          │
│      230.000đ                 │
│  để đủ tới cuối tháng (T5)   │
├──────────────────────────────┤
│ Đã chi tháng:  3.4tr / 5tr   │
│ ████████░░░░░ 68%             │
└──────────────────────────────┘
```

### E1 Cool-down popup:

```
┌────────────────────────────┐
│   ⏳ 4s                     │
│                            │
│   Bạn vừa định ghi          │
│   "Áo thun ZARA"            │
│       250.000đ              │
│                            │
│   = 5 bữa ăn trưa đó nha   │
│                            │
│   [ Huỷ ]   [ Vẫn ghi (4) ]│
└────────────────────────────┘
```

### B2 Persona share card:

```
┌─────────────────────────────┐
│  Tháng 5 của bạn 2026       │
│                              │
│  🍜 FOODIE QUẬN 1            │
│                              │
│  Top: Ăn uống 2.1tr (43%)   │
│  Cao hơn 67% người cùng tuổi│
│                              │
│  Bạn đã ghi 87 giao dịch    │
│  Streak: 28 ngày 🔥          │
│                              │
│         — Bux2 —             │
└─────────────────────────────┘
```

---

## 6. Câu hỏi cho đại ca

1. Đại ca chọn combo nào? (⚡ / 🏰 / 💑 / mix)
2. Có muốn em làm thêm 1-2 cái không trong combo không?
3. Nếu chọn ⚡ Combo Viral — em bắt đầu từ **A1 Safe-to-spend** (gốc nhất) hay **B2 Persona** (visual nhất)?
4. Muốn em viết file `.md` chi tiết cho 1 feature cụ thể trước khi code không, hay plan tổng thế này là đủ?

---

**EM CHƯA CODE GÌ. Chờ đại ca duyệt mới làm.**

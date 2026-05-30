# PLAN — Bux2 Premium (Free vs Pro)

**Ngày:** 2026-05-24
**Status:** Chờ duyệt — KHÔNG code

---

## 💰 Pricing chốt

- **Pro tháng**: **99.000đ**
- **Pro năm**: **299.000đ** (~25k/tháng, giảm 75%)
- KHÔNG lifetime — chỉ subscription

So competitor VN: rẻ hơn Money Lover (1.9tr/năm), gần ngang Money Pro (199k one-time tương đương ~2 năm Pro), rẻ hơn Spendee (1.2tr/năm).

---

## 📊 Phân chia chức năng

### ✅ FREE — Core tracking đầy đủ
*Để user free vẫn rất hài lòng → review tốt → tải nhiều*

| Tính năng | Giới hạn |
|---|---|
| 5 tab Nhập/Lịch/Báo cáo/Ngân sách/Khác | Đầy đủ |
| CRUD giao dịch | Không giới hạn |
| Quản lý ví | Không giới hạn |
| Ngân sách theo category | Không giới hạn |
| Ghi nhanh (parse text "60k") | Đầy đủ |
| Smart category suggest | Đầy đủ |
| Streak ghi sổ + Freeze Pass + Badges | Đầy đủ |
| Số dư an toàn + Chu kỳ lương | Đầy đủ |
| Tự động tiết kiệm (chích vào goal) | Đầy đủ |
| Cool-down 5 giây chống chi tiêu lớn | Đầy đủ |
| Notification (5 loại: sáng/tối/tuần/ghẹo/budget) | Đầy đủ |
| Persona tháng hiện tại | Đầy đủ |
| PIN + Face ID lock | Đầy đủ |
| Multi-language (vi/en/zh) | Đầy đủ |
| Theme picker | 5 màu cơ bản |
| Photo đính kèm | 1 ảnh/giao dịch |
| Tạo Custom category | **5 cái** |
| Tạo Savings Goals | **2 mục tiêu** |
| Tạo Bills (hoá đơn) | **5 bill** |
| Tạo Recurring rules | **3 rule** |
| Export | CSV thô |
| Phân tích báo cáo | Tháng hiện tại |

---

### ⭐ PRO — 8 feature signature

#### 1. ☁️ Cloud Sync (Firebase) — MUST HAVE
- Sync data giữa nhiều thiết bị (iPhone + iPad + Android)
- Auto backup, khôi phục khi đổi máy
- **Lý do user mua nhất**

#### 2. 📄 PDF Export đẹp
- Báo cáo tháng PDF có logo, biểu đồ pie/bar, theme đẹp
- Dùng cho dân kế toán, làm thuế, gửi đối tác
- Free chỉ CSV thô

#### 3. 🪙 Multi-currency
- Thêm USD + EUR + JPY + CNY + GBP
- Tự convert tỷ giá daily (cache offline)
- Cho user du lịch, freelance ngoại tệ, expat VN

#### 4. 🎨 Theme premium + Custom icon app
- 8 theme mới: **Dark mode**, Pastel, Neon, Gradient, Forest, Ocean Deep, Wine, Coffee
- Đổi icon app launcher 5 phiên bản
- Free giữ 5 theme cơ bản

#### 5. 🏆 Custom Challenges
- Tự tạo: "30 ngày không trà sữa" / "Tuần này tiết kiệm 500k" / "Tháng không Grab"
- Track progress + animation reward khi đạt mốc
- Tăng retention mạnh

#### 6. 📊 Custom Date Range + Year Compare
- Tự chọn khoảng (tuần này / quý / kỳ lương / custom)
- So sánh 12 tháng vẽ chart năm
- Free chỉ tháng / 6 tháng / năm

#### 7. 🏷 Tags + Multi-filter + Bulk ops
- Tags tự do ("Du lịch Đà Lạt 5/2026", "Sinh nhật A")
- Filter combo: tag + category + wallet + date range
- Bulk: chọn nhiều TX → đổi category / xoá hàng loạt
- Free chỉ filter theo category

#### 8. 🎯 Unlimited + Persona history
- **Unlimited custom categories** (Free 5)
- **Unlimited savings goals** (Free 2)
- **Unlimited bills** (Free 5)
- **Unlimited recurring rules** (Free 3)
- **Unlimited photo/TX** (Free 1)
- **Persona history**: xem persona qua các tháng + trend "T1 Foodie → T5 Couch Investor"

---

## 🎁 Bonus đề xuất (nếu muốn thêm sau)

- **Family book**: share book 2-3 người qua QR (cần backend phức tạp)
- **OCR scan bill local** (cần EAS dev build + native ML Kit)
- **Voice input** (cần EAS dev build + speech recognition)
- **Widget Home Screen iOS/Android** (cần EAS dev build)

→ Em đề xuất GIỮ làm Pro "Premium+" sau khi base Pro chạy ổn 3-6 tháng.

---

## 🗓 Roadmap 3 Phase

### Phase 1 — Foundation (~15h ship đầu tiên)
- Cloud Sync Firebase (10h)
- PDF Export (4h)
- RevenueCat SDK wire (1h) — quản lý subscription

### Phase 2 — Lifestyle (~13h)
- Multi-currency (6h)
- Theme premium + icon (3h)
- Custom Challenges (4h)

### Phase 3 — Power (~11h)
- Custom Date Range (3h)
- Tags + Multi-filter (6h)
- Unlimited limits + Persona history (2h)

**Tổng: ~39h** chia 3 đợt release.

---

## 🛠 Hạ tầng cần đại ca setup

| Hạ tầng | Chi phí | Mục đích |
|---|---|---|
| Apple Developer | $99/năm | Submit App Store |
| Google Play Console | $25 one-time | Submit Google Play |
| Firebase | Miễn phí (đủ tới 50k MAU) | Cloud Sync auth + storage |
| RevenueCat | Miễn phí tới $10k/tháng revenue | Quản lý IAP cross-platform |
| In-App Purchase tier | Trong Apple/Google Console | Setup 99k tháng + 299k năm SKU |

---

## ❓ Câu hỏi đại ca

1. **8 feature Pro + giới hạn Free** ở bảng trên — OK chứ? Hay anh muốn move feature nào giữa Free ↔ Pro?
2. **Phase 1 ship trước** (Cloud Sync + PDF + RevenueCat) — bắt đầu khi nào?
3. **Hạ tầng** anh đã có Apple Developer / Firebase / Google Play chưa? Nếu chưa, em hướng dẫn setup từng bước.
4. **Strategy "soft Paywall"** hay "hard Paywall"?
   - **Soft**: user free có thể CLICK vào tính năng Pro → hiện modal "Đây là tính năng Pro, nâng cấp?" → user biết feature → có động lực mua
   - **Hard**: feature Pro ẩn hoàn toàn → user free không thấy → mất chance convert

Em recommend **Soft** (UX của Duolingo, Notion, Linear).

---

**Em CHƯA code Premium gì. Chờ đại ca confirm 4 câu là bắt đầu Phase 1.**

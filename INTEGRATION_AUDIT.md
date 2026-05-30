# Bux2 — Audit liên kết feature 2026-05-23 10:00

> File này list gaps integration giữa các feature + plan fix. Đại ca cảm thấy app "thiếu thiếu" vì feature rời rạc → file này resolve.

---

## 1. Vấn đề: feature làm việc độc lập, không kết nối

Hiện tại app có **9 feature lớn**:
1. Nhập vào (transactions CRUD)
2. Lịch (calendar + list)
3. Báo cáo (pie/trend/heatmap/insights)
4. Ngân sách (budget per category)
5. Khác (menu hub)
6. Ví (wallets + transfer)
7. Mục tiêu (savings goals)
8. Hoá đơn (bills + auto pay)
9. Giao dịch lặp (recurring)

**Nhưng** mỗi feature live trong silo riêng → user không cảm thấy nhất quán:

### Gap A: Transactions không có nguồn gốc rõ ràng
- Bill thanh toán → tạo tx "Hoá đơn Tiền nhà 5tr" — nhưng trong Lịch chỉ thấy là transaction thường
- Recurring fire → tạo tx note "[Lặp]" — không phân biệt với manual
- Transfer giữa 2 ví → 2 transaction paired — user không biết đó là 1 transfer
- **Hệ quả**: user nhìn list giao dịch không biết tx nào auto, tx nào tay → confusion

### Gap B: Không có dashboard overview
- Tab Khác hiện danh sách menu rời rạc
- User vào app phải tap vào từng tab để xem tổng quan
- **Hệ quả**: phải nhớ vào /goals xem progress, /bills xem due, /wallets xem balance — không có "1 nơi xem hết"

### Gap C: Báo cáo không drill-down
- Tap category trong pie → không làm gì
- Tap bar trong trend → không filter tháng
- Tap cell heatmap → không hiện giao dịch ngày đó
- **Hệ quả**: user thấy số nhưng không biết cụ thể giao dịch nào

### Gap D: Không có cross-feature prompts
- Ghi income (lương) → app không hỏi "Cộng vào goal nào?"
- Ghi expense lặp lần thứ 3 → không gợi ý "Tạo recurring để khỏi gõ lại"
- Bill có sẵn "Tiền nhà 5tr" → ghi tay 1 tx mới về Tiền nhà → trùng lặp

### Gap E: Goals không kết nối income/wallets
- Tạo goal "iPhone 30tr" → bấm "Cộng tiền" thủ công
- Không có flow "Tự động trừ 2tr lương mỗi tháng vào goal"
- Goals + Recurring không liên kết

### Gap F: Quick add từ Tab Khác
- Phải vào Tab Nhập vào để ghi
- Không có shortcut "Ghi nhanh" từ Khác (vd long-press tab → quick add)

---

## 2. Plan fix (chia 3 tier)

### TIER 1 — Must fix ngay (session này)

1. **Source tracking transactions** — DB v10 thêm columns:
   - `source TEXT NULL` ('manual', 'bill', 'recurring', 'transfer', 'scan')
   - `source_id INTEGER NULL` — ref id của bill/recurring/wallet pair

2. **Badge nguồn trong Tab Lịch**:
   - 🔁 Lặp → recurring source
   - 📋 Hoá đơn → bill source
   - 🔄 Chuyển ví → transfer source
   - 📷 Quét → scan source (đã có photo_uri badge)

3. **Dashboard widget Tab Khác** ở đầu trang:
   - Card lớn: Tổng số dư (sum wallets) + so với hôm qua
   - Stats nhỏ: Bills due ≤7 ngày · Goals active · Recurring active
   - Quick "Phân tích AI" CTA (nếu chưa xem tháng này)

4. **Cập nhật services**:
   - `payBill()` → set source='bill', source_id=bill.id
   - `transferBetweenWallets()` → set source='transfer', source_id pair
   - `fireDueRules()` → set source='recurring', source_id=rule.id
   - `parseReceiptFromImage()` flow → set source='scan'

### TIER 2 — Nên làm tuần này

5. **Drill-down Báo cáo**:
   - Tap category trong pie → modal hiện list giao dịch category đó
   - Tap bar trong trend → set selectedMonth + scroll lên top
   - Tap cell heatmap → mở Lịch tab với selectedDate

6. **Income → Goal prompt** (cross-feature):
   - Sau khi ghi income > 1tr → toast "Cộng vào mục tiêu? [Tên goal] [Bỏ qua]"
   - Tap → mở modal chọn goal + amount

7. **Quick FAB** (Floating Action Button):
   - Nút "+" tròn ở góc dưới bên phải (mọi tab)
   - Tap → modal quick add: amount + danh mục + Submit
   - Tránh phải switch về Tab Nhập vào

### TIER 3 — Long-term

8. **Smart recurring suggest**:
   - Sau khi user ghi 3 tx cùng note + amount + interval đều → suggest "Tạo recurring?"

9. **Bill auto-import vào Ngân sách**:
   - Bill repeat=monthly tự tính vào budget tháng tương ứng

10. **Goal auto-fund từ recurring**:
    - Tạo goal kèm "Tự động trừ X mỗi tháng" → tạo recurring auto fund

---

## 3. Implementation order session này

1. ✅ DB v10 — thêm source/source_id (5 phút)
2. ✅ Update 3 services (payBill, transferBetweenWallets, fireDueRules) (10 phút)
3. ✅ Badge UI trong Tab Lịch (20 phút)
4. ✅ Dashboard widget Tab Khác (30 phút)
5. ✅ Drill-down từ pie chart (20 phút)
6. → spec update + tsc check

Tổng ~1.5h work.

---

## 4. Sau khi fix → app sẽ feel "connected"

- User vào tab Lịch → thấy ngay "Tiền nhà 5tr (📋 Hoá đơn)" — biết là từ bill
- User vào tab Khác → dashboard card "Tổng 6.5M · 2 bills sắp due · 3 goals active" — overview ngay
- User vào tab Báo cáo → tap "Ăn uống" trong pie → list 15 giao dịch ăn uống tháng này — drill-down rõ
- Transfer 1 lần → list Lịch hiện 2 tx có badge 🔄, hiểu là 1 transfer

**Kỳ vọng**: từ "thiếu thiếu" → "đầy đủ + liên kết"

---

**END INTEGRATION_AUDIT.md — 2026-05-23 10:00**

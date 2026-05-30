# Bux2 — Audit "Không đồng bộ" 2026-05-23 11:40

> Anh Bux2 cảm thấy app "chức năng kiểu không đồng bộ nhau". File này em đi từng tab/screen check inconsistency + đề xuất chuẩn hoá.

---

## 1. Inconsistencies phát hiện

### A. Wording không nhất quán

| Concept | Tab Nhập vào | Tab Lịch | Tab Báo cáo | Tab Ngân sách | Tab Khác |
|---------|--------------|----------|-------------|---------------|----------|
| "Chi tiền" | "Tiền chi" + "Nhập khoản chi" | "Chi" | "Chi tiêu" | (không có) | "chi tiêu" |
| "Thu tiền" | "Tiền thu" + "Nhập khoản thu" | "Thu" | "Thu nhập" | (không có) | (không có) |
| "Số dư" | (không có) | "Số dư" | (không có) | "Còn lại" | "Tổng số dư" |
| "Danh mục" | "DANH MỤC" | (icon) | "danh mục" | tên trực tiếp | "Quản lý danh mục" |

→ **Cần chuẩn hoá**: 
- "Chi" / "Thu" (1 từ ngắn — best)
- "Số dư" (cùng từ everywhere)
- "Danh mục" (lowercase trong body, uppercase trong section labels)

### B. Date format không nhất quán

| Tab | Format |
|-----|--------|
| Nhập vào DatePicker | "Thứ Bảy, 23/05/2026" |
| Lịch group | "thứ bảy, 23/05" |
| Lịch transaction item | (không hiện) |
| Báo cáo summary card | "Tháng 5/2026" (slice không pad 0) |
| Phân tích AI header | "Tháng 05/2026" (pad 0) |
| MonthSwitcher | "Tháng 5/2026" |
| Bills item | "Thứ Bảy, 23/05/2026" |
| Goal deadline | "23/05/2026" |
| YearHeatmap | "T5" |

→ **Cần chuẩn hoá**: Tất cả "Tháng MM/YYYY" với MM padded. Thứ tự ngày "EEEE, dd/MM/yyyy".

### C. Empty states không nhất quán

| Tab | Empty UI |
|-----|----------|
| Lịch | Text "Chưa có giao dịch nào. Vào tab 'Nhập vào' để ghi." |
| Báo cáo | Text "Chưa có dữ liệu để báo cáo." |
| Ngân sách | (không có empty state) |
| Goals | Icon Crown + title + desc + CTA button đẹp |
| Bills | Icon Bell + title + desc + CTA button đẹp |
| Recurring | Icon CalendarDays + title + desc + CTA button đẹp |

→ **Cần chuẩn hoá**: dùng template empty state đẹp (icon + title + desc + CTA) cho TẤT CẢ tab. Trừ Báo cáo có pie chart phải vẽ trống.

### D. Số tiền format không nhất quán

| Vị trí | Format |
|--------|--------|
| Mọi nơi | "60.000đ" (đúng) |
| BarChart Y axis | "60k", "2tr" (shortened) |
| YearHeatmap | (không hiện text amount) |
| Goal target | "60.000đ" |

→ OK, chỉ có chart shortened là intentional.

### E. Color usage không nhất quán

Sau khi em đã apply theme, vẫn còn vài chỗ hardcode:
- Some `#10b981` ở vài file (verify lại)
- Coach card / insight header dùng palette.primary nhưng border color không sync

### F. Tab Khác — quá nhiều thứ ở 1 chỗ

Trước cleanup hôm nay: 11 items. Sau cleanup: 8 items.

Nhưng 8 vẫn nhiều. So sánh đối thủ Komorebi cũng 10+ items. OK tạm.

### G. Modal styles không nhất quán

| Modal | Animation | Backdrop close |
|-------|-----------|----------------|
| MonthSwitcher | fade | ✓ |
| Wallets edit | slide | ✓ (vừa fix) |
| Goals edit | slide | ✓ |
| Bills edit | slide | ✓ |
| Recurring edit | slide | ✓ |
| Categories edit | slide | ✓ |
| Books edit | slide | ✓ |
| Budget edit | fade | ✓ |
| DatePicker iOS | slide | ✓ |
| Drill-down Báo cáo | slide | ✓ |

→ Tương đối nhất quán. Budget edit là fade khác biệt vì small modal center. OK.

### H. Header styles

| Screen | Back button | Title | Right action |
|--------|-------------|-------|--------------|
| Settings index | ChevronLeft | "Cài đặt" | (none) |
| Wallets | ChevronLeft | "Quản lý ví" | "+" Sparkles |
| Books | ChevronLeft | "Sổ kế toán" | "+" Sparkles |
| Goals | ChevronLeft | "Mục tiêu tiết kiệm" | "+" Sparkles |
| Bills | ChevronLeft | "Hoá đơn sắp đến hạn" | "+" Sparkles |
| Categories | ChevronLeft | "Quản lý danh mục" | "+" Sparkles |
| Recurring | ChevronLeft | "Giao dịch lặp" | "+" Sparkles |
| Notifications | ChevronLeft | "Thông báo" | (none) |
| Security | ChevronLeft | "Bảo mật" | (none) |
| Insights | ChevronLeft | "Phân tích AI" | RotateCcw refresh |

→ Nhất quán pattern. OK.

---

## 2. Đề xuất chuẩn hoá

### Việc 1: Chuẩn hoá wording
**File**: tất cả tab + screens
- "Tiền chi" → "Chi" (1 chỗ index.tsx)
- "Tiền thu" → "Thu" 
- "Nhập khoản chi/thu" → "Ghi chi" / "Ghi thu" (ngắn hơn)
- "Chi tiêu" → "Chi" (Báo cáo)
- "Thu nhập" → "Thu"
**Time**: 5 phút

### Việc 2: Chuẩn hoá date format
- Helper `formatMonth(YYYY-MM)` → "Tháng MM/YYYY" (luôn pad 0)
- Update MonthSwitcher + Báo cáo + Phân tích AI dùng cùng helper
**Time**: 5 phút

### Việc 3: Empty states đẹp cho Lịch + Báo cáo + Ngân sách
- Template: Icon (60px) + Title bold + Desc gray + CTA button
- Lịch empty: "Chưa có giao dịch tháng này" + CTA "Ghi giao dịch đầu tiên"
- Báo cáo empty: pie chart trống + text
- Ngân sách empty: "Chưa đặt ngân sách" + CTA
**Time**: 15 phút

### Việc 4 (optional): Polish UI vài chỗ nhỏ
- Coach card border + bg match palette tốt hơn
- Drill-down modal nhỏ hơn / sticker mode
- Tab Khác card spacing đều

### Việc 5 (anh Bux2 yêu cầu): Xoá "tiết kiệm"
Đợi anh xác nhận xoá cái nào (Mục tiêu hay Sổ kế toán).

---

## 3. Tiếp theo (phụ thuộc anh duyệt)

Em CHƯA code gì cả (theo process mới). Sau khi anh xác nhận:
1. Xoá cái nào: Mục tiêu tiết kiệm HOẶC Sổ kế toán
2. Chuẩn hoá wording (việc 1, 2, 3) — OK?
3. Polish UI (việc 4) — OK?

→ Em mới code theo đúng kế hoạch.

---

**END CONSISTENCY_AUDIT.md — 2026-05-23 11:40**

# Spec v3.55 — Wizard Saving Goal auto + Month-end review

**Date**: 2026-05-24 10:40
**Trigger**: Đại ca chọn Option 3.

---

## Mục tiêu

Khi user dùng Budget Wizard với savings 20% (= 4tr), số 4tr phải có **đường đi rõ ràng**, không phải "ảo" hiển thị.

Có 2 phần:

### Phần A — Wizard apply auto-create Saving Goal

**Hiện trạng**: `applyBudgets` chỉ save savingsTarget vào settings (để hiển thị tab Ngân sách). Không có goal nào được tạo. Tiền 4tr không đi vào đâu cả.

**Fix**:
- `applyBudgets` sau khi setBudget items xong → check savings_goals có goal tên "Quỹ tiết kiệm chung" chưa
- Nếu chưa → tạo mới với target = current monthly savings, icon "Wallet", color theme primary
- Nếu đã có → UPDATE target += savingsTarget tháng này (累cumulative)

**Active Savings (v3.23) hiện đã chạy**: daily allocator sẽ tự rót tiền vào goal active → user thấy goal tăng dần qua ngày.

### Phần B — Modal review cuối tháng

**Hiện trạng**: Cuối tháng không có summary. Khoản dư (= income thực - chi thực - savings đã rót) không được prompt user xử lý.

**Fix**:
- Detect: ngày trong tháng >= 28 (vì tháng 2 có 28 ngày)
- Boot hook trong `_layout.tsx` check setting `month_review_done_${month}`
- Nếu chưa done + đã >= 28 → set flag `show_month_review` trong state
- Tab Nhập detect flag → show Modal `MonthReviewModal`:
  - Title: "Tổng kết tháng MM/YYYY"
  - Stats: Thu A đ, Chi B đ, Tiết kiệm đã rót C đ, Còn dư D đ (= A - B - C)
  - Picker: chọn goal để nạp D đ (hoặc skip)
  - Nút Apply → `addSavingsContribution(goalId, D)` → setSetting done
- Có nút Bỏ qua (dư về wallet, không phân bổ)

---

## Files cần đụng

1. `app/budget-wizard/index.tsx` — applyBudgets thêm logic tạo goal
2. `src/services/monthReview.ts` (NEW) — helper compute month stats + check flag
3. `src/components/MonthReviewModal.tsx` (NEW) — modal UI
4. `app/(tabs)/index.tsx` — detect flag + render modal
5. `src/i18n/*.ts` — keys cho modal

---

## Trace ví dụ

User: income 20tr, savings 20% (= 4tr), apply ngày 24/5.
- Wizard create goal "Quỹ tiết kiệm chung" target = 4tr
- Daily allocator từ 25/5 → 31/5: 4tr ÷ 8 ngày = 500k/ngày auto vào goal (nếu user chi đủ ít)
- Ngày 28/5: show MonthReviewModal "Tháng 5: thu 20tr, chi 12tr, tiết kiệm rót 3.5tr, dư 4.5tr. Nạp dư vào goal nào?"
- User chọn goal A → addContribution(A, 4.5tr) → goal A +4.5tr

---

## Edge cases

- Tháng chưa có TX nào → modal không show (dư = 0)
- User không có goal nào → modal show "Tạo goal đầu tiên" CTA
- Multiple goals → dropdown chọn

---

## DoD

- [ ] Apply Wizard → goal "Quỹ tiết kiệm chung" tự tạo, target match savings
- [ ] Daily allocator (đã có v3.23) rót tiền vào goal này
- [ ] Ngày >= 28 → boot detect → modal show 1 lần
- [ ] Modal phân bổ dư cuối tháng → goal contribution OK
- [ ] tsc strict pass

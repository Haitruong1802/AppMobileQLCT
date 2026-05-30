# Plan dọn dẹp + fix bug 2026-05-23 11:25

> Process mới (anh Bux2 yêu cầu): trước khi build phải viết .md plan kỹ → screenshot/mock → đợi anh duyệt → mới code. File này là plan.

---

## 1. Vấn đề anh Bux2 raise

### A. Section "Quyền riêng tư" trong Cài đặt → xoá
- Vị trí: `app/settings/index.tsx` cuối trang, trước About
- Lý do anh: thông tin technical không cần thiết cho user thường
- **Fix**: xoá toàn bộ View section "Quyền riêng tư"

### B. Chức năng trùng lặp 2-3 nơi
Audit features hiện tại:

| Feature | Vị trí 1 | Vị trí 2 | Vị trí 3 | Action |
|---------|----------|----------|----------|--------|
| Phân tích AI | Tab Khác card menu | Tab Báo cáo CTA lớn (xanh) | Tab Khác dashboard widget "Xem phân tích AI" | **Giữ Tab Báo cáo CTA + dashboard widget**, **bỏ menu item ở Khác** |
| Hoá đơn | Tab Khác menu | Dashboard widget stat "X bills sắp đến hạn" | - | Giữ cả 2 (menu link rõ, stat info nhanh) |
| Mục tiêu tiết kiệm | Tab Khác menu | Dashboard widget stat | - | Giữ cả 2 (như trên) |
| Quản lý ví | Tab Khác menu | Cài đặt → Quản lý ví | - | **Bỏ ở Cài đặt** (giữ ở Khác — top-level) |
| Quản lý danh mục | Cài đặt | - | - | Giữ |
| Bảo mật | Cài đặt | - | - | Giữ |
| Giao dịch lặp | Cài đặt | - | - | Giữ |
| Theme | Cài đặt | - | - | Giữ |
| Sao lưu CSV | Cài đặt | - | - | Giữ |
| Nhắc nhở | Cài đặt | - | - | Giữ |
| Reset DB | Cài đặt danger zone | - | - | Giữ (admin emergency) |
| Sổ kế toán | Tab Khác card | - | - | Giữ |

**Tab Khác sau dọn dẹp**:
1. Sổ kế toán (card top)
2. Dashboard tổng quan (card primary)
3. Hoá đơn sắp đến hạn
4. Mục tiêu tiết kiệm
5. Quản lý ví
6. Cài đặt
7. Đánh giá ứng dụng
8. Liên hệ phản hồi

**Cài đặt sau dọn dẹp**:
1. Lượt tự động (giờ KHÔNG dùng API nữa → có thể ẩn luôn, hoặc giữ làm Pro upsell sau)
2. Quản lý danh mục
3. Bảo mật
4. Giao dịch lặp
5. Nhắc nhở
6. Theme
7. Sao lưu CSV
8. Sổ kế toán (← move từ Khác → Cài đặt? Hoặc keep ở Khác)
9. Danger Zone — Reset DB
10. About

Quyết định: bỏ "Phân tích AI" duplicate, bỏ "Quản lý ví" trong Cài đặt (vẫn ở Khác). Giữ Lượt tự động vì có thông tin về quota free.

### C. Bug: tháng default
- Anh Bux2 thấy app khởi động hoặc bị chuyển sang **Tháng 6/2026** trong khi hôm nay là **Tháng 5/2026** (2026-05-23)
- Code `currentMonthStr(new Date())` đáng lẽ trả `"2026-05"`
- Có thể: state in-memory đã bị set sang tháng 6 do anh tap ▶ trước đó. Vì store không persist nên reload sẽ về tháng hiện tại — nhưng anh có thể không reload.
- **Fix proactive**: thêm logic auto-reset currentMonth về tháng thật khi app foreground sau 1 thời gian, hoặc khi mount tab nếu currentMonth không hợp lệ.
- Đơn giản hơn: sửa default ở `_layout.tsx` boot — set `currentMonth = thisMonth` mỗi lần boot.

### D. Process mới
Anh Bux2 yêu cầu workflow:
1. Em viết file .md plan kỹ trước khi build
2. Có screenshot/mock trước khi code
3. Đợi anh duyệt
4. Mới code

→ Em adopt. File này là ví dụ đầu tiên của process mới.

---

## 2. Plan thực hiện

| # | Việc | File | Thời gian |
|---|------|------|-----------|
| 1 | Xoá section "Quyền riêng tư" | `app/settings/index.tsx` | 2 phút |
| 2 | Bỏ menu item "Phân tích AI" trong Tab Khác (đã có ở Báo cáo + dashboard CTA) | `app/(tabs)/more.tsx` | 2 phút |
| 3 | Bỏ section "Quản lý ví" trong Cài đặt (giữ ở Khác) | `app/settings/index.tsx` | 2 phút |
| 4 | Fix bug tháng default — reset về tháng thật khi boot | `app/_layout.tsx` | 3 phút |
| 5 | Cleanup unused imports / styles | All files | 3 phút |
| 6 | Update spec + version bump v3.2 | `BUILD_SPEC.md` | 2 phút |

Tổng: ~15 phút.

---

## 3. Sau khi fix, kết quả mong đợi

**Tab Khác** (cleaner):
- Sổ kế toán: Sổ Cá nhân ▶
- [Card tổng số dư primary]
- Hoá đơn sắp đến hạn
- Mục tiêu tiết kiệm
- Quản lý ví
- Cài đặt
- Đánh giá ứng dụng
- Liên hệ phản hồi

**Cài đặt** (cleaner, không lặp Khác):
- Lượt tự động tháng này
- Quản lý danh mục
- Bảo mật
- Giao dịch lặp
- Nhắc nhở
- Theme màu
- Sao lưu / Export
- Khu vực nguy hiểm
- About (không có Quyền riêng tư)

**Báo cáo tab khi mở lần đầu**: hiển thị **Tháng 5/2026** đúng (không phải Tháng 6).

**Lịch tab khi mở lần đầu**: hiển thị **Tháng 5/2026** đúng.

---

## 4. Em thực hiện ngay session này (do đại ca đã nói rõ 4 việc cụ thể)

Em làm hết 6 mục trên, sau đó update spec.

Lần sau, nếu yêu cầu phức tạp hơn → em **chỉ viết .md plan + chờ anh duyệt**, không tự code.

---

**END PLAN — 2026-05-23 11:25**

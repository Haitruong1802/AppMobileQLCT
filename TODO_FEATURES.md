# Bux2 — Roadmap chức năng cần thêm

> File này list chức năng đại ca/team muốn thêm theo thứ tự ưu tiên. Mỗi mục có spec đủ chi tiết để 1 Claude session khác đọc xong là build được. Updated 2026-05-22.

---

## Quy ước

- **P0** = blocker, làm ngay
- **P1** = nên có trước Production
- **P2** = nice to have, post-launch
- **P3** = ý tưởng tương lai

Status: `pending` | `blocked` | `in_progress` | `done`

---

## TIER P0 — Must have trước test public

### F22. Date filter cho Lịch + Báo cáo + Ngân sách — ✅ DONE 2026-05-22 16:00
Implemented qua `src/components/MonthSwitcher.tsx`. Tab Lịch / Báo cáo / Ngân sách đều có header tháng nav (← →) + tap label → modal chọn tháng (24 tháng gần nhất). Hiệu chỉnh chỉ tháng đó.

### F23. Custom categories — ✅ DONE 2026-05-22 16:15
Route `app/settings/categories.tsx`. CRUD đầy đủ: thêm (chọn icon từ 35 Lucide + 20 màu), sửa, xoá (default soft-delete via is_visible, custom hard-delete với reassign transactions sang "Khác"). DB migration v3 thêm `is_visible` column.

### F21. PIN / Face ID lock — ✅ DONE 2026-05-22 16:30
- `src/services/lock.ts` (SecureStore + LocalAuthentication)
- `src/store/useAuth.ts` (locked state + 5-attempt lockout)
- `src/components/LockScreen.tsx` (overlay zIndex 9999)
- `app/settings/security.tsx` (set PIN 4-6 chữ số + bật biometric)
- AppState listener ở `_layout.tsx` → auto lock sau 5 phút background
- Boot: lock ngay nếu PIN đã set

### F24. Recurring transactions — ✅ DONE 2026-05-22 16:45
- DB table `recurring_rules` (migration v4)
- `src/services/recurring.ts` với `fireDueRules()` chạy on boot
- Route `app/settings/recurring.tsx` CRUD + active toggle
- Hỗ trợ frequency: weekly, biweekly, monthly, quarterly, yearly
- Auto fire missed runs (catch-up) tối đa 36 lần safety

### F20. Sửa Lỗi Lịch (Calendar tab) — `pending`
Đại ca báo tab Lịch lỗi 2026-05-22 nhưng chưa rõ error message.
- **Acceptance**: tab Lịch render bình thường, không crash, hiện list giao dịch + tóm tắt
- **Cần**: screenshot từ đại ca để xác định lỗi cụ thể
- **Files có thể fix**: `app/(tabs)/calendar.tsx`, `src/utils/date.ts`
- **Estimate**: 15-30 phút sau khi có screenshot

### F21. PIN / Face ID lock — `pending`
Bảo mật app, đặc biệt nếu user chia điện thoại với người khác.
- **Acceptance**:
  - Settings → "Bảo mật" → bật PIN 4-6 chữ số HOẶC biometric
  - Mở app từ background sau 5 phút → màn lock
  - PIN sai 5 lần → khoá 5 phút
  - Biometric ưu tiên, fallback PIN
- **Files mới**: `app/lock.tsx` (lock screen), `src/utils/crypto.ts` (PBKDF2 hash)
- **Deps cần cài**: `expo-local-authentication` (đã trong Expo Go)
- **Estimate**: 2-3h

### F22. Date filter cho Lịch + Báo cáo + Ngân sách — `pending`
Hiện chỉ xem được tháng hiện tại. Cần chọn tháng khác / khoảng tuần / năm.
- **Acceptance**:
  - Header tab Lịch + Báo cáo + Ngân sách: thêm date selector
  - Options: Hôm nay / Tuần này / Tháng này / Tháng trước / Tuỳ chọn (date range)
  - Tuỳ chọn → modal date range picker
  - State lưu trong Zustand `selectedRange`
- **Files**: `app/(tabs)/calendar.tsx`, `app/(tabs)/report.tsx`, `app/(tabs)/budget.tsx`, `src/store/useStore.ts` (add selectedRange + actions)
- **Estimate**: 2h

### F23. Custom categories (thêm/sửa/xoá) — `pending`
15 danh mục mặc định không đủ. User cần thêm "Thú cưng", "Du lịch", v.v.
- **Acceptance**:
  - Cài đặt → "Quản lý danh mục" route mới `app/settings/categories.tsx`
  - List 15 default + custom
  - "Thêm danh mục" modal: nhập tên, chọn icon (Lucide), chọn màu, chọn loại (chi/thu)
  - Sửa: tap → modal edit
  - Xoá: long-press → confirm. Nếu category có transactions → cảnh báo "Sẽ chuyển X giao dịch sang Khác"
  - Default categories không xoá được, chỉ ẩn (`is_visible=0`)
- **DB migration**: thêm cột `is_visible INTEGER DEFAULT 1` vào categories table
- **Files**: route mới, `src/db/index.ts` thêm CRUD category
- **Estimate**: 4h

---

## TIER P1 — Nên có trước Production

### F24. Recurring transactions (giao dịch lặp) — `pending`
Lương hàng tháng, tiền nhà, gói data — không phải nhập lại mỗi tháng.
- **Acceptance**:
  - Tab Nhập vào → checkbox "Lặp lại" → option: hàng tuần / 2 tuần / hàng tháng / 3 tháng / năm
  - DB: bảng `recurring_rules(id, transaction_template_json, frequency, next_run, active)`
  - Worker (chạy mỗi lần mở app): check next_run, tạo transaction mới nếu đến hạn
  - Cài đặt → "Giao dịch lặp" list rules + bật/tắt/xoá
- **Files mới**: `app/settings/recurring.tsx`, `src/services/recurring.ts`
- **Estimate**: 5h

### F25. Daily reminder notification — `pending`
Nhắc user log chi tiêu mỗi tối 20h.
- **Acceptance**:
  - Cài đặt → "Nhắc nhở hàng ngày" toggle + time picker (mặc định 20:00)
  - expo-notifications schedule local notification daily
  - Tap notification → mở app vào tab Nhập vào
  - iOS yêu cầu permission lần đầu
- **Deps**: `expo-notifications`
- **Files**: `src/services/notifications.ts` mới, setup ở `app/_layout.tsx`
- **Estimate**: 3h

### F26. Savings goals (mục tiêu tiết kiệm) — `pending`
"Để dành 5tr mua iPhone trong 6 tháng".
- **Acceptance**:
  - Tab mới hoặc trong Khác → "Mục tiêu tiết kiệm"
  - Tạo goal: tên (vd "iPhone 16"), số tiền đích (5_000_000), deadline, icon
  - Mỗi tháng tự deduct savings từ "thu - chi" → cộng vào goal
  - Hiện progress bar % hoàn thành
  - Khi đạt 100% → animation + push notification
- **DB**: bảng `savings_goals(id, name, target, current, deadline, icon, created_at)`
- **Files**: route mới `app/goals/index.tsx`, `src/db/index.ts` add goals CRUD
- **Estimate**: 4h

### F27. Bar chart trend theo tháng (Báo cáo) — `pending`
Hiện chỉ pie chart 1 tháng. Cần biểu đồ cột so sánh 6-12 tháng.
- **Acceptance**:
  - Tab Báo cáo → toggle "Trend"
  - Bar chart SVG (custom, react-native-svg): 6 cột = 6 tháng gần nhất
  - Mỗi cột chia 2 màu: thu (xanh) chồng chi (đỏ)
  - Tap cột → drill down vào tháng đó
- **Files**: `src/components/BarChart.tsx` mới, `app/(tabs)/report.tsx` update
- **Estimate**: 3h

### F28. Search transactions — `pending`
Tìm "Cafe Highlands" hoặc số tiền > 500k trong tháng.
- **Acceptance**:
  - Tab Lịch → search bar header
  - Filter realtime theo note hoặc category name
  - Filter advanced: range amount, date range, category multi-select
- **Files**: `app/(tabs)/calendar.tsx` add search UI + filter logic
- **Estimate**: 2h

### F29. Dark mode — `pending`
Auto theo system hoặc manual toggle.
- **Acceptance**:
  - Cài đặt → "Chế độ tối": Auto / Sáng / Tối
  - Áp dụng full app: background, text, borders, charts
  - Lưu setting
- **Files**: `src/theme/colors.ts` add dark variants, all StyleSheet refactor
- **Estimate**: 6-8h (touch nhiều file)

---

## TIER P2 — Post-launch

### F30. PDF Export — `pending`
Báo cáo PDF có logo, đẹp, gửi email cho kế toán.
- **Acceptance**:
  - Cài đặt → "Xuất PDF" → chọn tháng
  - Tạo HTML template → expo-print → PDF
  - Logo header, tổng thu/chi/dư, biểu đồ pie embedded (base64 SVG), list giao dịch table
- **Deps**: `expo-print`
- **Files**: `src/services/pdf.ts` mới
- **Estimate**: 4h

### F31. Apple Wallet / Google Wallet boarding pass (?) — `pending`
Hoặc widget iOS Home Screen hiển thị tổng chi tháng.
- **Acceptance**:
  - Widget Home Screen iOS: hiện tổng chi tháng + progress vs ngân sách
- **Blocked by**: cần native module, không chạy Expo Go
- **Files**: cần dev client + `expo-widget` (chưa stable)
- **Estimate**: 8h sau khi có dev client

### F32. Multi-wallet / Multi-account — `pending`
"Ví tiền mặt" vs "Ví thẻ tín dụng" vs "Tài khoản BIDV" — track riêng.
- **Acceptance**:
  - Mỗi transaction gắn wallet_id
  - Tab mới "Ví" hoặc dropdown header chọn wallet
  - Transfer giữa wallets
- **DB**: bảng `wallets(id, name, icon, color, initial_balance)`, transactions thêm cột `wallet_id`
- **Files**: nhiều, refactor lớn
- **Estimate**: 8h

### F33. Bank statement import (sao kê) — `pending`
Upload PDF/CSV sao kê → tự parse transactions.
- **Acceptance**:
  - Cài đặt → "Import sao kê" → pick file
  - Detect bank format (Vietcombank/BIDV/Techcombank/MoMo/ZaloPay)
  - Parse từng dòng → preview → user confirm import
- **Files**: `src/services/import.ts` mới với parsers per bank
- **Estimate**: 10-15h (mỗi bank format riêng)

### F34. Multi-currency — `pending`
Đi du lịch nước ngoài, ghi chi tiêu USD/JPY/EUR.
- **Acceptance**:
  - Mỗi transaction có `currency` + `rate_to_vnd` (snapshot lúc ghi)
  - Báo cáo quy đổi tất cả về VND
  - Cài đặt → currency mặc định + auto-fetch rate (exchangerate-api.com free)
- **Estimate**: 4h

### F35. Receipt photo gallery — `pending`
Lưu ảnh hoá đơn để tra lại sau.
- **Acceptance**:
  - Camera scan: ngoài parse, lưu luôn ảnh vào FileSystem
  - Tab Lịch → tap item có ảnh → xem ảnh
  - Settings → "Bộ nhớ ảnh hoá đơn" với cảnh báo dung lượng
- **DB**: transactions thêm cột `photo_uri TEXT`
- **Estimate**: 3h

---

## TIER P3 — Tương lai xa

### F36. AI Insights deep dive
- Phân tích pattern theo tháng/quý/năm
- Cảnh báo bất thường: "Tháng này tiền điện gấp đôi"
- Suggest tiết kiệm: "Đặt mục tiêu giảm 20% Bia/Cafe"
- Báo cáo cuối năm tự động

### F37. Sentiment vs spending
- Hỏi mood mỗi lần ghi (5 emoji)
- Phân tích "buồn → chi tiêu Bia/Cafe tăng 40%"

### F38. Family sharing
- Mời thành viên gia đình share data
- Chi tiêu chung (groceries, tiền nhà) split tự động
- Permissions: chồng thấy mọi thứ vợ, vợ chỉ thấy expenses chung

### F39. Investment tracker
- Theo dõi danh mục đầu tư: chứng khoán, crypto, vàng, BĐS
- Tích hợp API SSI / Binance / VietGold

### F40. Wear OS / Apple Watch
- Quick log từ đồng hồ
- Voice "Hey Siri, log cafe 30k"

### F41. Telegram bot integration
- Forward tin nhắn ngân hàng → bot parse → auto ghi
- Daily summary gửi qua bot

### F42. Localization
- English UI
- Multi-language: vi/en/zh/ja

### F43. Web companion app
- Mở web companion (domain riêng của Bux2) đăng nhập sync → xem dashboard lớn trên màn hình PC
- Required: Firebase Sync (F14)

---

## Blocked Items (chờ đại ca setup)

| ID | Feature | Blocker | Cần đại ca làm |
|----|---------|---------|----------------|
| F10 | Voice input thật | Cần native ML Kit Speech | `npx eas build --profile development` → cài dev client |
| F14 | Firebase sync | Cần Firebase project | Tạo project firebase.google.com, gửi config.json |
| F16 | App icon + Splash | Cần design vector | Đại ca thiết kế Figma → xuất 1024×1024 PNG |
| F19 | Submit Play Store | Cần Play Console account | Đăng ký $25 + EAS Build account |
| BE  | Backend proxy API | Cần server | Mua VPS hoặc Cloudflare Workers free tier |
| IAP | Pro subscription IAP | Cần Play Billing | Sau khi submit Play Store thành công |

---

## Ưu tiên build kế tiếp (em đề xuất)

Nếu đại ca confirm muốn em build tiếp **không cần test trước**, em đề xuất:

1. **F20 Lỗi Lịch** (em cần screenshot) — fix trước hết
2. **F22 Date filter** — đại ca chắc chắn muốn xem tháng khác, hiện không xem được
3. **F23 Custom categories** — 15 default chắc không đủ
4. **F21 PIN/Face ID** — security cơ bản trước public
5. **F24 Recurring transactions** — UX bigger win

Tổng ~16h work — em build được trong 2-3 session nữa.

---

**End TODO_FEATURES.md**

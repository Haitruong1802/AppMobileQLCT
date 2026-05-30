# Bux2 — Sổ thu chi thông minh

App quản lý thu chi cá nhân React Native + Expo, **100% offline, không dùng AI/Gemini**. Toàn bộ logic phân loại + insight chạy local qua rule engine + pattern matching. Đảm bảo riêng tư + không phụ thuộc network.

> ⚠️ Docs cũ (APP_AUDIT.md, BUILD_SPEC.md, UPDATE_2026-05-22.md) còn nhắc Gemini, OCR scan, các feature này **đã xoá hoàn toàn** từ v3.100 (2026-05-24).

## Chạy app trên điện thoại

**Cách 1, Expo Go (nhanh nhất, không cần Android Studio):**

1. Cài app **Expo Go** trên điện thoại (App Store / Play Store, miễn phí)
2. Điện thoại + máy tính cùng wifi
3. Trên máy:
   ```powershell
   cd D:\CLAUDE\BopAI
   npx expo start
   ```
4. Mở **Expo Go** → quét QR code

**Khác mạng wifi?** Dùng tunnel ngrok:
```powershell
npx expo start --tunnel
```

**Cache lỗi?** Thêm `--clear`:
```powershell
npx expo start --clear
```

## Tính năng (100% offline)

### Cốt lõi
- ✅ **Form ghi chi/thu**: amount auto-format, note, danh mục grid 12+3, date picker chọn ngày bất kỳ với nút "Hôm nay".
- ✅ **15 danh mục VN mặc định**: Ăn uống, Tạp hoá, Quần áo, Mỹ phẩm, Giao lưu, Y tế, Giáo dục, Tiền điện, Đi lại, Đầu tư, Tiền nhà, Khác, Lương, Thưởng, Thu khác.
- ✅ **Auto-suggest category** từ keyword note (rule engine local, không AI).
- ✅ **Tab Lịch**: list TX groupBy ngày, swipe xoá, undo snackbar, search.
- ✅ **Tab Báo cáo**: pie chart SVG + breakdown bar chart từng danh mục.
- ✅ **Tab Ngân sách**: set ngân sách theo tháng, progress bar, cảnh báo vượt mức.
- ✅ **Edit transaction**: bottom sheet pageSheet, sửa đầy đủ + xoá.

### Smart features (rule-based local, không AI)
- ✅ **Quick input parse**: gõ "Ăn trưa 60k" hoặc "Lương tháng 12tr" → auto fill form (parse local).
- ✅ **Budget Wizard 4 bước**: 3 quy tắc 50/30/20, 40/30/30, 60/30/10 phân bổ ngân sách theo income + history.
- ✅ **Safe-to-spend** (Số dư an toàn): chia đều ngân sách còn lại cho ngày còn lại, ưu tiên chu kỳ lương.
- ✅ **Active Savings**: tự chích 1 khoản nhỏ vào mục tiêu tiết kiệm mỗi ngày từ phần dư.
- ✅ **Month-end review**: cuối tháng prompt review thu/chi/dư + nạp dư vào quỹ tiết kiệm.

### Retention & gamification
- ✅ **Streak ghi sổ**: 5 pet stages (lửa, vàng, cam, tím, đỏ) theo 0/7/30/100/365 ngày.
- ✅ **Freeze Pass**: 1 pass/tuần, lỡ 1 ngày app tự bảo vệ chuỗi.
- ✅ **Daily tasks**: 5 task max 21 điểm trưởng thành.
- ✅ **Pet rename**: đặt tên thú cưng yêu thương (16 ký tự).

### Bảo mật + đa ngôn ngữ
- ✅ **PIN + Face ID/Vân tay** khoá app, auto-lock 5 phút background.
- ✅ **i18n** đầy đủ: tiếng Việt / English / 中文.
- ✅ **Theme 5 màu** (mint, grape, sunset, ocean, mono).
- ✅ **Export CSV** toàn bộ TX.

## Tech stack

| Lớp | Công nghệ |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 + TypeScript strict |
| Navigation | expo-router (file-based) + native iOS modal sheet |
| State | Zustand 5 |
| Local DB | expo-sqlite (offline-first, 0 network) |
| Icons | lucide-react-native |
| Charts | Custom SVG (react-native-svg) |
| Pet animation | Lottie (react-native-lottie) với 4 file JSON local |
| Date | date-fns + @react-native-community/datetimepicker |
| Haptics | expo-haptics |

## Cấu trúc folder

```
BopAI/
├── app/                              # expo-router file-based routes
│   ├── _layout.tsx                   # Root stack + load DB + migrations
│   ├── (tabs)/                       # 5 tabs (Nhập, Lịch, Báo cáo, Ngân sách, Khác)
│   ├── budget-wizard/index.tsx       # Wizard 4 bước 3 quy tắc
│   ├── streak/index.tsx              # Pet + streak modal (native iOS sheet)
│   ├── goals/, bills/, edit/, settings/, onboarding/
├── src/
│   ├── components/                   # SafeToSpendCard, StreakBadge, FlamePet, ...
│   ├── db/                           # SQL schema + CRUD helpers + migrations
│   ├── store/useStore.ts             # Zustand global state
│   ├── services/                     # streak, safeToSpend, budgetRecommender, monthReview, ...
│   ├── i18n/                         # vi/en/zh + helpers
│   └── utils/                        # format, date, log, parsers
├── app.json, package.json, README.md
```

## Code quality

- TypeScript strict mode, `npx tsc --noEmit` exit 0
- Tất cả icon dùng SVG Lucide chuyên nghiệp
- Pet hiển thị bằng Lottie animation (4 file local, không network)
- Cross-platform: DatePicker, Modal, Alert xử lý riêng iOS / Android / Web
- DB migrations idempotent qua flag setting
- 4 vòng QA test với 4 sub-agents parallel + 40+ scenarios → 100% HIGH/MEDIUM/LOW issues đã fix

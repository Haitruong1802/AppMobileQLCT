# Bux2 — Audit toàn diện app 2026-05-22 16:25

> File này tổng hợp đầy đủ: hiện trạng, bug, feature thiếu, polish, debt, checklist ship. Cho đại ca + AI agent session sau pick up không phải đọc lại lịch sử.

---

## 0. Tóm tắt 1 phút

**Đang có**: 17 route, 7 service, 5 tab + 9 sub-screen. Core flow ghi-xem-báo cáo-ngân sách OK. Đã thêm: camera scan, push notification, savings goals, recurring, PIN lock, theme picker, CSV export.

**Đại loại**: app đã có khoảng **65%** so với Sổ thu chi/Money Lover.

**Còn thiếu để ship**: app icon, splash screen, fix theme apply, tests, optimize FlatList, một số polish UX.

---

## 1. Đã hoàn thành ✅

### Core CRUD (MVP)
- ✅ Ghi giao dịch thủ công (Tab Nhập vào)
- ✅ Edit transaction (modal `/edit/[id]`)
- ✅ Delete (long-press)
- ✅ 15 categories mặc định
- ✅ Type Chi/Thu
- ✅ Date picker cross-platform (đã fix iOS spinner)

### Smart input
- ✅ Tự động điền text ("Ăn trưa 60k" → form)
- ✅ Quét bill camera (Gemini Vision multimodal)

### Views & analytics
- ✅ Tab Lịch (group by ngày + search F28)
- ✅ Tab Báo cáo: Pie chart, Bar chart 6 tháng, summary cards, biggest tx
- ✅ Tab Ngân sách (set budget, progress, cảnh báo vượt)
- ✅ Tóm tắt tháng (AI insight)
- ✅ Month switcher 3 tabs (Lịch/Báo cáo/Ngân sách)

### Settings hub
- ✅ Lượt tự động (quota counter)
- ✅ Quản lý danh mục (CRUD custom + ẩn default)
- ✅ Bảo mật (PIN 4-6 số + Face ID/vân tay, 5 phút auto-lock)
- ✅ Giao dịch lặp (recurring rules: weekly/biweekly/monthly/quarterly/yearly)
- ✅ Theme màu (5 palette)
- ✅ Nhắc nhở (daily push notification + test button)
- ✅ Sao lưu CSV
- ✅ Cài đặt nâng cao (override Gemini API key)
- ✅ Reset DB emergency

### Goals (mới)
- ✅ Mục tiêu tiết kiệm: tạo, cộng tiền, completion 🎉

### Infrastructure
- ✅ DB SQLite + 5 migration (v1→v5), resilient seed, fallback in-memory
- ✅ Zustand store + theme hook
- ✅ ErrorBoundary
- ✅ Onboarding 3 màn

### Brand
- ✅ App name "Bux2", không "AI"
- ✅ Tone chuyên nghiệp toàn UI
- ✅ Embedded Gemini key (user không nhập)
- ✅ UI thuần Bux2, không gắn branding bên thứ ba

---

## 2. Critical Bugs / Issues 🚨

| # | Issue | Severity | Files | Fix |
|---|-------|----------|-------|-----|
| **B1** | **Theme chỉ áp dụng ở Settings** — 35 chỗ hardcode `#10b981` trong other tabs/components | **HIGH** | `app/(tabs)/index.tsx`, calendar.tsx, budget.tsx, report.tsx, camera/scan.tsx | Refactor StyleSheet → đọc từ `useTheme()` hook. Cần ~3h |
| **B2** | Coach insight không show progressively (no streaming) — user chờ 5-8s nhìn spinner | MEDIUM | `app/(tabs)/calendar.tsx`, gemini.ts | Add Gemini streaming API (SSE) |
| **B3** | Settings → Bảo mật → đặt PIN xong KHÔNG auto-trigger lock — chỉ hoạt động sau khi app restart hoặc 5 phút background | MEDIUM | `app/settings/security.tsx` | Set `useAuth.locked = true` ngay sau khi setPin success → user phải mở khoá để xác nhận PIN |
| **B4** | Recurring fire `addTransaction` không tăng counter `categories` (chỉ DB level) | LOW | `src/services/recurring.ts` | Đã được handle qua loadTransactions on boot — verify |
| **B5** | Web platform: SQLite có thể không persist giữa reload — đã có fallback in-memory nhưng addTransaction sẽ fail silently | MEDIUM | `src/store/useStore.ts` | Wrap dbAdd với try/catch + notify user |
| **B6** | Reset DB không clear SecureStore (PIN vẫn còn sau Reset DB) | LOW | `src/db/index.ts:resetDatabase` | Call `clearPin()` trong resetDatabase |
| **B7** | Edit transaction route chưa kiểm tra trường hợp transaction bị xoá (race condition) | LOW | `app/edit/[id].tsx` | Check existence trước render |
| **B8** | Savings goal completion notification (🎉) chỉ là Alert, không push real | LOW | `app/goals/index.tsx` | Schedule local notification immediate |

---

## 3. Feature còn thiếu vs competitors

### Compare với "Sổ thu chi Komorebi" (đối thủ chính 4.9⭐ 293k rating)

| Feature | Bux2 | Sổ thu chi | Note |
|---------|-----|------------|------|
| Ghi giao dịch thủ công | ✅ | ✅ | OK |
| 15 categories | ✅ | ✅ | OK |
| Multi-wallet (tiền mặt/thẻ/MoMo) | ❌ | ✅ | **THIẾU** (P1) |
| Transfer giữa wallets | ❌ | ✅ | THIẾU (P1) |
| Budget per category | ✅ | ✅ | OK |
| Pie chart | ✅ | ✅ | OK |
| Bar chart trend | ✅ | ✅ | OK (mới thêm) |
| Calendar view (lịch tháng) | ❌ | ✅ | **THIẾU** — Bux2 chỉ list ngày |
| Recurring transactions | ✅ | ✅ | OK |
| Savings goals | ✅ | ❌ | **Bux2 WIN** |
| AI text parse | ✅ | ❌ | **Bux2 WIN** |
| AI camera bill scan | ✅ | ❌ | **Bux2 WIN** |
| PIN + Face ID lock | ✅ | ✅ | OK |
| Theme | 5 màu | 10+ | THIẾU 5 màu |
| Export CSV | ✅ | ✅ | OK |
| Export PDF | ❌ | ✅ | THIẾU (P2) |
| Cloud sync | ❌ | ✅ | THIẾU (P1 — cần Firebase setup) |
| Widget Home screen | ❌ | ✅ | THIẾU (cần dev client) |
| Daily reminder | ✅ | ✅ | OK |
| Notification "vượt ngân sách" | ❌ | ✅ | THIẾU (P1) |
| Search transactions | ✅ | ✅ | OK |
| Photo attachment | ❌ | ✅ | THIẾU (P2) |
| Tag/label | ❌ | ✅ | THIẾU (P2) |
| Multi-currency | ❌ | ✅ | THIẾU (P3) |
| Bill reminders (hoá đơn sắp đến hạn) | ❌ | ✅ | THIẾU (P2) |

### Em Bux2 WIN ở
- AI text parse (unique)
- AI bill scan (unique)  
- Savings goals (unique vs Sổ thu chi)
- Tone chuyên nghiệp / GenZ optional

### Em Bux2 LOSE ở
- Multi-wallet (must-have)
- Calendar grid view (visual)
- Cloud sync (data safety)
- Notification thông minh (over-budget)
- Photo attachment

---

## 4. Tính năng đề xuất build tiếp (sorted by impact/effort)

### TIER S — Bắt buộc trước Production

| ID | Feature | Impact | Effort | Lý do |
|----|---------|--------|--------|-------|
| **F32** | **Multi-wallet** (ví tiền mặt / thẻ / MoMo) | ⭐⭐⭐⭐⭐ | 8h | Sổ thu chi có, user expect |
| **F44** | **Theme apply toàn app** (fix B1) | ⭐⭐⭐⭐⭐ | 3h | Hiện 35 chỗ hardcode, đổi theme không thấy đẹp |
| **F16** | **App icon + Splash screen** | ⭐⭐⭐⭐ | 1h (sau khi có design) | Required ship Play Store |
| **F45** | **Notification "vượt ngân sách"** | ⭐⭐⭐⭐ | 2h | Đại ca chi quá → app báo ngay |

### TIER A — Strong differentiator

| ID | Feature | Impact | Effort |
|----|---------|--------|--------|
| **F46** | **Calendar grid view** (lịch tháng giống Sổ thu chi) — mỗi ô ngày hiện total chi/thu | ⭐⭐⭐⭐ | 4h |
| **F47** | **Smart category suggestion** — Gemini learn pattern, tự đoán category dựa lịch sử | ⭐⭐⭐⭐ | 3h |
| **F48** | **Pull-to-refresh** tab Lịch | ⭐⭐ | 30 phút |
| **F49** | **Swipe-to-delete** transaction (thay long-press) | ⭐⭐ | 1h |
| **F50** | **Undo delete** (snackbar có nút "Hoàn tác") | ⭐⭐⭐ | 1h |
| **F51** | **Comparison view**: chi tuần này vs tuần trước, tháng vs tháng | ⭐⭐⭐ | 2h |

### TIER B — Power user

| ID | Feature | Effort |
|----|---------|--------|
| **F35** | Photo attachment cho transaction (camera/library) | 3h |
| **F52** | Tag/label cho transaction | 2h |
| **F53** | Bulk operation: chọn nhiều tx → xoá/đổi category | 3h |
| **F54** | Bill reminder (hoá đơn sắp đến hạn) | 4h |
| **F55** | Stats nâng cao: median, mode, percentile | 2h |
| **F28b** | Filter nâng cao trong search: range amount + range date + multi-category | 2h |

### TIER C — Long-term

| ID | Feature | Effort |
|----|---------|--------|
| **F14** | Firebase cloud sync | 8h (đại ca cần setup project) |
| **F33** | Bank statement import (VCB, BIDV, TCB, MoMo) | 15h+ |
| **F39** | Investment tracker (CK, crypto, vàng, BĐS) | 10h |
| **F30** | PDF Export | 4h |
| **F34** | Multi-currency | 4h |
| **F38** | Family sharing | 15h+ |
| **F40** | Apple Watch / Wear OS | 8h (cần dev client) |
| **F43** | Web companion app | 30h |

---

## 5. UX / Polish thiếu

### Cần fix UI nhỏ

- [ ] **U1**: Tab Lịch — empty state "Tháng này chưa ghi gì" cần thân thiện hơn (illustration + CTA)
- [ ] **U2**: Tab Báo cáo "trend 6 tháng" — bar chart nhỏ, dài quá khó đọc trên screen mobile dài
- [ ] **U3**: DatePicker iOS hiện modal full screen → cảm giác nặng. Đổi sang inline picker compact
- [ ] **U4**: Onboarding KHÔNG có swipe gesture giữa các màn
- [ ] **U5**: Tab Khác không có icon profile/avatar user
- [ ] **U6**: Skeleton loading khi data đang fetch (tab Lịch, Báo cáo)
- [ ] **U7**: Loading spinner màu xanh hardcoded nhiều chỗ (không follow theme)
- [ ] **U8**: Number format inconsistent: "60k" vs "60.000đ" vs "60 nghìn" — chuẩn hoá
- [ ] **U9**: Currency symbol "đ" chứ không phải "₫" — Money Lover dùng ₫

### Cần fix Cross-platform

- [ ] **X1**: Android — confirm Alert dialog không có dark mode auto (text trắng trên trắng nếu dark mode hệ thống)
- [ ] **X2**: iOS Safe area cho landscape mode chưa test
- [ ] **X3**: Keyboard occlude text input khi scroll (test trên iPhone SE màn nhỏ)
- [ ] **X4**: iOS haptic feedback khi swipe — chưa dùng
- [ ] **X5**: Android: notification icon — hiện dùng default Expo, cần custom

### Cần fix Empty States

- [ ] **E1**: Tab Báo cáo empty → "Chưa có dữ liệu để báo cáo" không có CTA
- [ ] **E2**: Tab Ngân sách empty → không có "Tạo ngân sách đầu tiên" guide
- [ ] **E3**: Goals empty → đã OK
- [ ] **E4**: Recurring empty → đã OK
- [ ] **E5**: Categories management → custom empty state

---

## 6. Technical debt

### Performance

- [ ] **T1**: Tab Lịch dùng `transactions.map()` thay vì `<FlatList>` — chậm với 1000+ items
- [ ] **T2**: PieChart re-render every parent re-render (no React.memo)
- [ ] **T3**: BarChart Svg <Rect> không memoize
- [ ] **T4**: Store useEffect chạy nhiều lần — cần useShallow / selector pattern
- [ ] **T5**: catMap recompute mỗi render → memoize OK nhưng `Object.fromEntries` cũng tốn

### Code quality

- [ ] **T6**: KHÔNG có Jest tests (coverage 0%)
- [ ] **T7**: KHÔNG có Detox E2E
- [ ] **T8**: KHÔNG có lint config / eslint
- [ ] **T9**: KHÔNG có CI/CD (GitHub Actions auto-build/test)
- [ ] **T10**: KHÔNG có error monitoring (Sentry/Crashlytics)
- [ ] **T11**: console.log scattered — nên dùng wrapped logger
- [ ] **T12**: TypeScript strict mode đã bật nhưng nhiều `any` ở `bucket.txs: any[]`
- [ ] **T13**: KHÔNG có changelog tự động (CHANGELOG.md)

### Data integrity

- [ ] **T14**: KHÔNG có DB backup trước destructive ops (Reset DB chỉ confirm)
- [ ] **T15**: Migration v1→v5 chưa test thực sự với data cũ
- [ ] **T16**: KHÔNG có data validator schema (Zod hoặc tương đương)
- [ ] **T17**: addTransaction không validate category_id exists

---

## 7. Bảo mật / Privacy

### Đã làm
- ✅ PIN + Face ID
- ✅ Auto-lock 5 phút
- ✅ Input validation cơ bản
- ✅ HTTPS only (default)
- ✅ KHÔNG gửi PII cho Gemini

### Cần làm

- [ ] **S1**: SQLite encryption (SQLCipher) — hiện DB plain text trong app sandbox
- [ ] **S2**: Privacy policy URL trong app + Play Store
- [ ] **S3**: Terms of Service link trong app
- [ ] **S4**: Permission rationale chi tiết hơn (camera, notification)
- [ ] **S5**: Audit `npm audit --production` regular
- [ ] **S6**: Pin certificate Google API (advanced, optional)
- [ ] **S7**: Detect rooted/jailbroken device cảnh báo
- [ ] **S8**: KHÔNG log API key vào console (đã có wrapper chưa?)

---

## 8. Pre-Launch checklist Play Store

### Assets cần đại ca chuẩn bị

- [ ] **L1**: **App icon** 1024x1024 PNG vector — robot ôm ví hoặc tương tự brand
- [ ] **L2**: **Splash screen** 1284x2778 (iPhone 14 Pro Max) + Android variants
- [ ] **L3**: **Feature graphic** Play Store 1024x500
- [ ] **L4**: **Screenshots** 8 màn: Nhập vào, Lịch, Báo cáo, Ngân sách, Goals, Quét bill, AI text, Theme picker
- [ ] **L5**: **Promo video** 30s YouTube (tuỳ chọn)
- [ ] **L6**: **App name** + tagline (vd "Bux2 — Quản lý thu chi thông minh")
- [ ] **L7**: **Short description** 80 ký tự
- [ ] **L8**: **Long description** 4000 ký tự
- [ ] **L9**: **Privacy policy** URL (hosted GitHub Pages / Netlify free)
- [ ] **L10**: **Contact email** (đã có `hello@bopapp.vn` — đại ca cần register domain)

### Account / billing

- [ ] **L11**: Google Play Console account $25 one-time
- [ ] **L12**: Apple Developer account $99/year (nếu submit iOS)
- [ ] **L13**: EAS account free (đã có Expo account chưa?)
- [ ] **L14**: Domain `bopapp.vn` mua + DNS setup

### Build & submit

- [ ] **L15**: `npx eas build --platform android --profile production` → AAB
- [ ] **L16**: Test trên Internal track 20 user 2 tuần
- [ ] **L17**: Closed Testing 100 user 1 tuần
- [ ] **L18**: Production submit Play Store review (3-7 ngày)

### Monetization

- [ ] **L19**: Google Play Billing setup cho Pro IAP
- [ ] **L20**: Define Pro pricing (đề xuất 39k/tháng hoặc 299k/năm)
- [ ] **L21**: A/B test paywall position

---

## 9. Roadmap đề xuất (timeline)

### Tuần này (còn 2-3 ngày)
- [ ] Fix B1 (theme apply toàn app) — 3h
- [ ] Fix B3 (PIN auto-lock sau setup) — 30 phút
- [ ] U6 Skeleton loading — 1h
- [ ] F48 Pull-to-refresh — 30 phút
- [ ] F49 Swipe-to-delete + F50 Undo — 2h

### Tuần 2 (28/05 - 03/06)
- [ ] F32 Multi-wallet (S tier) — 8h
- [ ] F45 Notification vượt ngân sách — 2h
- [ ] F46 Calendar grid view — 4h
- [ ] F47 Smart category suggestion AI — 3h
- [ ] T1 FlatList virtualization — 2h

### Tuần 3 (04/06 - 10/06)
- [ ] App icon + Splash (đại ca design)
- [ ] L9 Privacy policy
- [ ] L7-L10 Play Store listing copy
- [ ] T6 Viết Jest tests core (utils, db) — 4h
- [ ] T10 Sentry setup — 1h

### Tuần 4 (11/06 - 17/06)
- [ ] EAS Build production
- [ ] Internal testing 20 user
- [ ] Polish bugs từ tester

### Tuần 5 (18/06 - 24/06)
- [ ] Closed Testing 100 user
- [ ] Marketing prep (TikTok / Facebook page)

### Tuần 6 (25/06 - 30/06)
- [ ] Submit Production
- [ ] Wait Play Store review

### Tháng 7
- [ ] **LAUNCH** ngày 01/07/2026 🚀

---

## 10. Files quan trọng & state

| File | Last updated | Size | Purpose |
|------|-------------|------|---------|
| `BUILD_SPEC.md` | v1.5 2026-05-22 | 36KB | Spec master |
| `UPDATE_2026-05-22.md` | 2026-05-22 14:25 | 10KB | Changelog ngày 22/05 |
| `TODO_FEATURES.md` | 2026-05-22 16:00 | 12KB | Roadmap features đã làm + chưa |
| `APP_AUDIT.md` (file này) | 2026-05-22 16:25 | ~ | Audit toàn diện |
| `README.md` | đã cũ | 5KB | User-facing, cần update |
| `CLAUDE.md` | trống | - | Cần viết hint cho AI agent |
| `AGENTS.md` | trống | - | Cần viết hint |

### DB Schema state (v5)
- `categories(id, name, icon, color, type, is_default, is_visible)`
- `transactions(id, amount, category_id, note, type, date, created_at)`
- `budgets(id, category_id, amount, month)`
- `settings(key, value)`
- `ai_usage(id, month, feature, count)` — F11
- `recurring_rules(id, amount, category_id, type, note, frequency, next_run, active, last_run, created_at)` — F24
- `savings_goals(id, name, target, current, deadline, icon, color, completed_at, created_at)` — F26

---

## 11. Open questions cho đại ca

1. **Domain `bopapp.vn`** — đại ca mua chưa? Em đặt tạm trong contact email. Nếu chưa thì đổi sang email cá nhân đại ca.
2. **App icon thiết kế ra sao**? — Tone: tối giản (Sổ thu chi style), playful (Money Lover style), hay corporate (MISA style)?
3. **Multi-wallet** — đại ca thật sự cần không? Hay 1 ví đủ? Nếu cần thì list các ví: Tiền mặt / Thẻ Vietcombank / MoMo / Ngân hàng số / Ví crypto…
4. **Pro pricing** — 39k/tháng quá rẻ hay đủ? Sổ thu chi có gói 99k năm, Money Lover 49k tháng.
5. **Theme apply toàn app** — đại ca chấp nhận em refactor 35 chỗ hardcode? (3h work, có risk break UI nhẹ)
6. **Build EAS Production khi nào** — đại ca muốn lên Play Store thực sự ngày nào?

---

## 12. Quick wins ✅ ĐÃ SHIP 2026-05-22 16:35

5 quick wins đã build xong session này:

1. ✅ **F44 Theme apply toàn app** — refactor 35 chỗ hardcode → đổi theme thấy toàn UI đổi
2. ✅ **F45 Notification vượt ngân sách** — push notification ngay khi cross budget
3. ✅ **F48 Pull-to-refresh tab Lịch** — kéo xuống đầu trang để reload
4. ✅ **F49 Swipe-to-delete** — vuốt trái transaction → nút xoá đỏ
5. ✅ **F50 Undo** — snackbar đen "Đã xoá HOÀN TÁC" 5 giây
6. ✅ **U6 Skeleton** — animated shimmer khi Coach loading

**Next session ưu tiên**:
- **F32 Multi-wallet** (8h) — must-have trước Production
- **F46 Calendar grid view** (4h) — visual differentiation
- **F16 App icon + Splash** — đại ca cần design vector

Tham khảo `TODO_FEATURES.md` cho list đầy đủ.

---

**END APP_AUDIT.md — 2026-05-22 16:25**

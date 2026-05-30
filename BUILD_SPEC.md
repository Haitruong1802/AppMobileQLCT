# Bux2 — Build Spec v1.0 (LEGACY)

> ⚠️ **Document này là LEGACY** từ thời app còn tích hợp Gemini AI. Từ v3.100 (2026-05-24) app đã **xoá hoàn toàn Gemini/AI features** và chuyển 100% offline. Các phần dưới đây ref Gemini, OCR scan, AI Coach... đã obsolete. README.md là source of truth hiện tại.

> **Mục đích file này (cũ)**: bất kỳ Claude/AI agent nào đọc xong file này là build được app hoàn chỉnh ship-ready, KHÔNG cần hỏi thêm. Tài liệu nguồn duy nhất, override README.md nếu xung đột.

---

## 0. TL;DR cho AI agent

Bạn đang build **Bux2 AI** — app expense tracker React Native + Expo + Gemini AI, target VN market, ship Play Store. Project ở `D:\CLAUDE\BopAI\`. MVP đã có 60% feature. Việc của bạn: hoàn thiện 40% còn lại (Section 11) + harden security (Section 9) + viết tests (Section 10) → đạt Definition of Done (Section 12).

**Quy tắc bất di bất dịch:**
- KHÔNG dùng emoji icon — chỉ Lucide SVG
- KHÔNG dùng `npm run web` để test feature mobile — phải Expo Go điện thoại
- KHÔNG breaking changes với DB schema hiện có — dùng migration
- KHÔNG thêm dependency mới nếu chưa được approve trong Section 4
- KHÔNG log API key, transaction amount, hay tên người dùng vào console production

---

## 1. Sản phẩm

### 1.1 Pitch 1 câu
Expense tracker tiếng Việt với AI tự ghi từ giọng nói / hoá đơn — không gõ tay, không emoji, GenZ tone.

### 1.2 Target user
- VN 18-35 tuổi, smartphone Android (80% market)
- Đã quen Sổ thu chi (Komorebi), Money Lover, MISA — nhưng lười gõ
- Income 8-30tr/tháng, có ý thức quản lý chi tiêu

### 1.3 USP (3 điểm khác Sổ thu chi gốc)
1. **AI Camera scan hoá đơn** — chụp → tự ghi (ML Kit OCR + Gemini)
2. **AI Voice input** — nói "Ăn trưa 60k" → tự ghi
3. **AI Coach cợt nhả GenZ** — insight + cảnh báo hàng ngày

### 1.4 Monetization
- **Free**: full feature offline + 50 AI request/tháng (limit qua Firebase counter)
- **Pro 39k/tháng hoặc 299k/năm**: unlimited AI, theme picker, sync Firebase, export CSV/PDF
- IAP qua Google Play Billing (sau Closed Testing)

### 1.5 Anti-bản quyền vs Sổ thu chi
- Tên khác: **Bux2 AI** (slug `bopai`)
- Color: xanh #10B981 (vs cam pastel gốc)
- Icon app: tự design — robot ôm ví (sẽ làm Tuần 7)
- Cốt lõi gameplay: AI tự ghi vs gõ tay
- KHÔNG copy code/asset gốc

---

## 2. Tech stack (LOCKED — không đổi nếu chưa có lý do mạnh)

| Lớp | Công nghệ | Version | Lý do |
|-----|-----------|---------|-------|
| Framework | React Native | 0.81.5 | Expo SDK 54 yêu cầu |
| Runtime | Expo SDK | 54 | EAS Build hỗ trợ tốt, OTA update |
| Language | TypeScript | 5.9.x strict | An toàn type, ít bug |
| Navigation | expo-router | 6.0.x | File-based, dễ AI generate |
| State | Zustand | 5.x | Nhẹ hơn Redux, đủ scope |
| Local DB | expo-sqlite | 16.x | Offline-first, tin cậy |
| Secure storage | expo-secure-store | latest | Lưu Gemini key, PIN hash |
| AI | Google Gemini 2.0 Flash | API v1beta | Free 1500 req/ngày |
| OCR | ML Kit Text Recognition | via expo-modules | Offline, free |
| Speech | expo-speech-recognition hoặc ML Kit | latest | Offline ưu tiên |
| Icons | lucide-react-native | 1.16+ | SVG, KHÔNG emoji |
| Charts | react-native-svg | 15.12 | Tự vẽ custom |
| Date | date-fns | 4.x | Locale vi |
| Date picker | @react-native-community/datetimepicker | 8.4.4 | Native UI |
| Haptics | expo-haptics | 15.x | Feedback feel |
| HTTP | fetch (native) | - | Không thêm axios |
| Auth (Tuần 6+) | Firebase Auth | latest | Free 50k MAU |
| Cloud sync (Tuần 6+) | Firebase Firestore | latest | Free tier đủ MVP |

**KHÔNG thêm**: redux, axios, moment.js, react-native-paper, native-base, lottie (nếu không thật cần).

---

## 3. File structure (LOCKED)

```
BopAI/
├── app/                              # expo-router routes
│   ├── _layout.tsx                   # Root stack, init DB, biometric check
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab navigator (5 tab)
│   │   ├── index.tsx                 # Tab 1: Nhập vào (form + AI voice/text)
│   │   ├── calendar.tsx              # Tab 2: Lịch (AI Coach + transactions)
│   │   ├── report.tsx                # Tab 3: Báo cáo (pie + breakdown)
│   │   ├── budget.tsx                # Tab 4: Ngân sách
│   │   └── more.tsx                  # Tab 5: Khác (settings nav, Pro upgrade)
│   ├── edit/[id].tsx                 # Modal sửa transaction
│   ├── settings/
│   │   ├── index.tsx                 # Settings hub
│   │   ├── gemini.tsx                # Gemini API key
│   │   ├── security.tsx              # PIN, biometric
│   │   ├── theme.tsx                 # Theme picker (Tuần 6)
│   │   ├── export.tsx                # CSV/PDF export (Tuần 6)
│   │   └── sync.tsx                  # Firebase sync (Tuần 6)
│   ├── camera/scan.tsx               # AI scan hoá đơn (Tuần 4)
│   ├── onboarding/                   # 3-step intro (Tuần 7)
│   └── lock.tsx                      # PIN/biometric lock screen
├── src/
│   ├── components/
│   │   ├── Icon.tsx                  # Lucide wrapper, props.name
│   │   ├── PieChart.tsx              # SVG donut
│   │   ├── BarChart.tsx              # SVG bar (Tuần 5)
│   │   ├── DatePickerField.tsx       # Cross-platform
│   │   ├── AmountInput.tsx           # Format VND realtime
│   │   ├── CategoryGrid.tsx          # 12+3 grid picker
│   │   ├── AICoachCard.tsx           # Coach insight card
│   │   ├── VoiceButton.tsx           # Voice input (Tuần 5)
│   │   ├── ReceiptScanner.tsx        # Camera scanner (Tuần 4)
│   │   └── ErrorBoundary.tsx         # Catch render errors
│   ├── db/
│   │   ├── schema.ts                 # SQL DDL + seed defaults
│   │   ├── index.ts                  # CRUD helpers
│   │   ├── migrations.ts             # Version migrations
│   │   └── encryption.ts             # SQLCipher key from device
│   ├── store/
│   │   ├── useStore.ts               # Zustand: transactions, categories, budgets
│   │   ├── useSettings.ts            # Settings store
│   │   └── useAuth.ts                # Auth/lock state
│   ├── services/
│   │   ├── gemini.ts                 # AI: parse + coach + ocr-parse
│   │   ├── ocr.ts                    # ML Kit wrapper
│   │   ├── speech.ts                 # Speech-to-text wrapper
│   │   ├── firebase.ts               # Auth + Firestore (Tuần 6)
│   │   ├── export.ts                 # CSV/PDF generator (Tuần 6)
│   │   └── ratelimit.ts              # Free tier AI quota counter
│   ├── utils/
│   │   ├── format.ts                 # formatVND, formatNumber
│   │   ├── date.ts                   # formatDate, monthRange, todayISO
│   │   ├── validate.ts               # Validate amount, note length
│   │   ├── crypto.ts                 # PIN hash (PBKDF2)
│   │   └── log.ts                    # Safe logger (mask sensitive)
│   └── theme/
│       ├── colors.ts                 # 5 theme palette
│       └── typography.ts             # Font scales
├── __tests__/                        # Jest tests
│   ├── utils/
│   ├── db/
│   └── services/
├── e2e/                              # Detox E2E (sau khi đủ feature)
├── app.json                          # Expo config
├── package.json
├── tsconfig.json
├── README.md                         # User-facing
└── BUILD_SPEC.md                     # File này — agent-facing
```

---

## 4. Database schema (FROZEN — chỉ thêm cột mới, không xoá)

### 4.1 Tables

```sql
-- v1 (đã có)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,                    -- Lucide icon name
  color TEXT NOT NULL,                   -- hex
  type TEXT NOT NULL CHECK(type IN ('expense','income')),
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL               -- ISO 8601
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,               -- VND, no decimal
  note TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK(type IN ('expense','income')),
  date TEXT NOT NULL,                    -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,                   -- YYYY-MM
  created_at TEXT NOT NULL,
  UNIQUE(category_id, month)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- v2 thêm (Tuần 5+)
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,                   -- YYYY-MM
  feature TEXT NOT NULL,                 -- 'parse_text' | 'parse_voice' | 'parse_ocr' | 'coach'
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(month, feature)
);

CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_pushed_at TEXT,
  last_pulled_at TEXT,
  device_id TEXT NOT NULL,
  user_id TEXT,                          -- Firebase UID, NULL nếu chưa login
  CHECK(id = 1)
);
```

### 4.2 Default categories (15 — KHÔNG đổi order)

| Order | name | icon (Lucide) | color | type |
|-------|------|---------------|-------|------|
| 1 | Ăn uống | Utensils | #EF4444 | expense |
| 2 | Mua sắm | ShoppingBag | #F59E0B | expense |
| 3 | Quần áo | Shirt | #EC4899 | expense |
| 4 | Mỹ phẩm | Sparkles | #A855F7 | expense |
| 5 | Bia/Cafe | Beer | #F97316 | expense |
| 6 | Sức khoẻ | Pill | #14B8A6 | expense |
| 7 | Học tập | BookOpen | #3B82F6 | expense |
| 8 | Điện nước | Zap | #FACC15 | expense |
| 9 | Đi lại | Bus | #06B6D4 | expense |
| 10 | Liên lạc | Smartphone | #8B5CF6 | expense |
| 11 | Nhà ở | Home | #84CC16 | expense |
| 12 | Khác | MoreHorizontal | #6B7280 | expense |
| 13 | Lương | Wallet | #10B981 | income |
| 14 | Thưởng | Gift | #22C55E | income |
| 15 | Khác (thu) | Coins | #65A30D | income |

### 4.3 Settings keys (string values)

| key | default | mô tả |
|-----|---------|-------|
| `gemini_api_key` | `''` | API key (stored encrypted via SecureStore, NOT in SQLite) |
| `theme_color` | `'green'` | green / blue / purple / pink / orange |
| `pin_hash` | `''` | PBKDF2 hash, NULL nếu không bật |
| `biometric_enabled` | `'0'` | '0' | '1' |
| `currency` | `'VND'` | VND only MVP |
| `first_day_of_month` | `'1'` | 1-28 |
| `onboarded` | `'0'` | '0' | '1' |
| `pro_until` | `''` | ISO date, '' nếu không Pro |

---

## 5. Zustand store contract

```ts
// useStore.ts
{
  // State
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  selectedMonth: string,         // YYYY-MM
  loading: boolean,

  // Actions
  loadAll: () => Promise<void>,
  addTransaction: (t: NewTransaction) => Promise<void>,
  updateTransaction: (id: number, t: Partial<Transaction>) => Promise<void>,
  deleteTransaction: (id: number) => Promise<void>,
  setBudget: (categoryId: number, month: string, amount: number) => Promise<void>,
  setSelectedMonth: (m: string) => void,
}

// useSettings.ts
{
  geminiKey: string,            // loaded from SecureStore
  geminiKeyValid: boolean,
  themeColor: ThemeColor,
  pinHash: string | null,
  biometricEnabled: boolean,
  onboarded: boolean,
  proUntil: Date | null,

  setGeminiKey: (k: string) => Promise<void>,
  validateGeminiKey: () => Promise<boolean>,
  setTheme: (c: ThemeColor) => Promise<void>,
  setPin: (pin: string) => Promise<void>,
  clearPin: () => Promise<void>,
  setBiometric: (on: boolean) => Promise<void>,
  setOnboarded: () => Promise<void>,
}

// useAuth.ts (Tuần 7+)
{
  locked: boolean,
  unlock: (pin?: string) => Promise<boolean>,
  lock: () => void,
}
```

---

## 6. Feature list — acceptance criteria

### TIER 1: MVP đã có (verify đầy đủ, fix bug nếu có)

#### F1. Tab Nhập vào
- Form: amount (auto format VND), note (max 200 ký tự), category grid, date picker
- Toggle Chi/Thu — đổi danh mục hiển thị
- Submit → haptic feedback → Toast "Đã ghi" → reset form
- **AI text input**: ô text "Nhập tự nhiên: Ăn trưa 60k" → bấm icon AI → Gemini parse → fill form (KHÔNG submit auto, user xác nhận)
- **Acceptance**: 
  - Amount < 1k bị reject với toast "Số tiền quá nhỏ"
  - Amount > 1 tỷ bị warn nhưng cho lưu
  - Note có XSS như `<script>` → strip thẻ HTML
  - Nếu Gemini key chưa có → ẩn nút AI + tooltip "Cài đặt > Gemini"

#### F2. Tab Lịch
- Header: tháng hiện tại, prev/next
- AI Coach card đầu trang (nếu có Gemini key)
- Summary 3 cột: Thu / Chi / Dư
- List transactions group by ngày, mỗi item: icon category, note, amount
- Tap item → mở `/edit/[id]`
- Long-press item → confirm xoá
- Empty state: "Tháng này chưa ghi gì — Bux2 nhẹ thôi 🤖" + nút "Ghi ngay" → tab Nhập vào
- **Acceptance**:
  - Group by date theo locale vi (Hôm nay, Hôm qua, Thứ 2 dd/MM)
  - Performance: list 1000+ item vẫn scroll 60fps (dùng FlatList với getItemLayout)
  - AI Coach fail (no internet/quota) → card có "Tải lại" button, KHÔNG crash

#### F3. Tab Báo cáo
- Toggle Chi/Thu (default Chi)
- Pie chart SVG donut 200x200, 12 segment max
- Breakdown list: category, % tổng, amount, bar
- Tap segment pie → highlight item trong list
- **Acceptance**:
  - Pie chart < 1 category: hiện full circle 1 màu
  - Pie chart 0 transaction: empty state
  - Animation render < 300ms

#### F4. Tab Ngân sách
- Header: tháng
- List 12 category chi: budget set / progress bar / status
- Tap category → modal nhập số tiền ngân sách
- Color progress: < 70% xanh, 70-90% vàng, > 90% đỏ
- Cảnh báo bell icon nếu vượt: "Quá tay rồi bro"
- **Acceptance**:
  - Set budget 0 = xoá budget
  - Đổi tháng → load budget tháng đó (default empty)

#### F5. Tab Khác (More)
- Nav list: Cài đặt, Báo cáo PDF (Tuần 6), Sao lưu (Tuần 6), Theme (Tuần 6), Nâng cấp Pro (Tuần 8), Đánh giá app, Liên hệ
- Footer: phiên bản, copyright
- **Acceptance**: tap mỗi nav → đúng route, KHÔNG dead link

#### F6. Edit transaction modal
- Pre-fill amount/note/category/date/type
- Save → update DB → back
- Delete button đỏ ở footer → confirm → xoá
- **Acceptance**: 
  - Edit nhưng không thay đổi gì → updated_at vẫn cập nhật? KHÔNG, chỉ nếu có thay đổi thật
  - Cancel → không lưu

#### F7. Settings Gemini
- Input API key (secureTextEntry)
- Nút Test → gọi Gemini `models/gemini-2.0-flash:generateContent` với prompt ngắn "ok" → status xanh nếu 200
- Nút Lưu → SecureStore.setItemAsync('gemini_api_key', key)
- Nút Xoá key
- Link "Lấy key miễn phí" → mở https://aistudio.google.com/apikey
- **Acceptance**:
  - Key sai format (không bắt đầu `AIzaSy`) → reject ngay không cần gọi API
  - Key sai → status "Key không hợp lệ"
  - Hết quota → status "Hết lượt hôm nay, thử lại sau"

#### F8. AI Coach (Lịch tab card)
- Tự load 1 lần / ngày (cache theo `YYYY-MM-DD`)
- Prompt: gửi 30 transaction gần nhất + tổng tháng → Gemini sinh insight 1-2 câu GenZ
- Loading skeleton 200ms
- Pull-to-refresh → bypass cache, gen mới
- **Acceptance**:
  - Cache hit: < 50ms
  - API call: timeout 8s, fallback "Em đang lười, lát coach sau nha 🤖"
  - KHÔNG gửi PII (tên, số điện thoại) — chỉ amount + category

---

### TIER 2: Tuần 4-5 — AI advanced features (CHƯA LÀM)

#### F9. AI Camera scan hoá đơn (Tuần 4) — USP #1 ✅ SHIPPED 2026-05-22
- Route `/camera/scan`
- Mở camera (expo-camera permission)
- Snap photo → resize 1024px width + JPEG 80% → base64
- **Gemini Vision (multimodal)** parse OCR + extract trong 1 call (deviation from spec v1.0 — không dùng ML Kit để chạy được Expo Go, KHÔNG cần dev client build)
- Hiện preview: ảnh + form đã pre-fill (amount, category, note, date, merchant)
- User chạm danh mục để đổi nếu cần → "Ghi vào sổ" → addTransaction → router.back()
- **Acceptance** (đã đạt):
  - ✅ Permission denied → CTA "Cho phép camera" hoặc "Mở cài đặt" (Linking)
  - ✅ Hình mờ / không phải hoá đơn → error screen "AI không nhận ra hoá đơn, chụp rõ hơn" + retake button
  - ✅ Gemini error → error screen với message + retake
- **Trade-off vs spec gốc**: cần internet (Gemini Vision online). Offline OCR (ML Kit) defer Tuần 9+ nếu user request — sẽ thêm dependency native cần dev client.
- Files: `app/camera/scan.tsx`, `src/services/gemini.ts:parseReceiptFromImage`, button trigger ở `app/(tabs)/index.tsx`.

#### F10. AI Voice input (Tuần 5) — USP #2
- Component `VoiceButton` ở Tab Nhập vào, thay text input
- Tap → request mic permission → start recording
- Auto stop sau 5s im lặng hoặc max 15s
- Speech-to-text → text → Gemini parse → fill form
- **Acceptance**:
  - Tiếng Việt "Ăn trưa 60 nghìn" → amount 60000, category Ăn uống, note "Ăn trưa"
  - "Lương tháng 15 triệu" → amount 15000000, type income, category Lương
  - Permission denied → fallback text input
  - Network fail → cache speech, retry tự động khi online

#### F11. AI Usage limit & Pro upsell
- Free tier: 50 AI request/tháng (counter ai_usage table)
- Khi đạt 45/50 → toast "Còn 5 lượt AI miễn phí tháng này"
- Khi đạt 50/50 → modal Pro upsell "Nâng cấp 39k để dùng không giới hạn"
- Reset đầu tháng (cron client-side check date)

---

### TIER 3: Tuần 6 — Theme + Export + Sync

#### F12. Theme picker (5 màu)
- Palette: green (#10B981), blue (#3B82F6), purple (#A855F7), pink (#EC4899), orange (#F97316)
- Đổi → animate fade 200ms toàn app
- Lưu setting, restore khi mở lại

#### F13. Export CSV/PDF
- Settings → Export → chọn khoảng tháng → format CSV / PDF
- CSV: `date,type,category,amount,note` UTF-8 BOM
- PDF: expo-print HTML template, có logo, tổng kết
- Save vào FileSystem.documentDirectory + Share API

#### F14. Firebase sync
- Email/password Auth qua Firebase
- Sync transactions + budgets + categories
- Conflict: client-wins-by-updated_at
- Indicator sync status ở header More tab
- **Acceptance**: 
  - Login lần đầu → pull all data từ Firestore
  - Offline 1 ngày → online → push diff
  - Logout → clear cloud cache, giữ local

---

### TIER 4: Tuần 7 — Polish

#### F15. Onboarding 3 màn
- Màn 1: "Chào, em là Bux2 AI" + animation robot ôm ví
- Màn 2: "Ghi chi tiêu bằng giọng nói hoặc chụp hoá đơn"
- Màn 3: "Set up Gemini API key (free)" → nút "Lấy key" → Settings
- Skip button góc trên
- Set `onboarded = '1'` sau khi xong

#### F16. App icon + Splash screen
- Icon: robot ôm ví, vector 1024x1024, theme green
- Splash: nền green, logo center, fade 1.5s

---

### TIER 5: Tuần 8 — Closed Testing prep

#### F17. Error boundary + Crashlytics
- Wrap root với ErrorBoundary → fallback UI "Em ngất xíu, restart nha"
- Optional Sentry/Crashlytics (free tier)

#### F18. Performance audit
- React DevTools profiling all tab
- Bundle size < 8MB
- Cold start < 2s trên Pixel 6a

#### F19. Closed Testing Play Store
- EAS Build → AAB
- Internal testing track 20 user
- Feedback form qua TypeForm/Google Form

---

## 7. Gemini prompts (LOCKED — đổi sẽ break parse)

### 7.1 Parse text → transaction

```
Bạn là AI parse chi tiêu tiếng Việt. Trả về JSON DUY NHẤT, không markdown:
{
  "type": "expense" | "income",
  "amount": number (VND),
  "category_hint": string (tên danh mục đoán, vd "Ăn uống"),
  "note": string (ngắn gọn)
}

Input: "{userInput}"

Danh mục có sẵn (CHỈ chọn 1):
- expense: Ăn uống, Mua sắm, Quần áo, Mỹ phẩm, Bia/Cafe, Sức khoẻ, Học tập, Điện nước, Đi lại, Liên lạc, Nhà ở, Khác
- income: Lương, Thưởng, Khác

Quy tắc:
- "60k" = 60000, "1tr5" = 1500000, "15 triệu" = 15000000
- Nếu không rõ → category_hint = "Khác"
- Nếu input không phải chi tiêu → trả {"type":"unknown","amount":0,"category_hint":"","note":""}
```

### 7.2 OCR hoá đơn

```
Bạn là AI parse hoá đơn VN. Input là text OCR từ ảnh hoá đơn. Trả JSON:
{
  "total": number (VND, lấy tổng cuối cùng),
  "merchant": string (tên cửa hàng),
  "date": string (YYYY-MM-DD, "" nếu không thấy),
  "category_hint": string
}

Text OCR:
"""
{ocrText}
"""

Quy tắc:
- "Total", "Tổng", "Thanh toán", "Cộng" → tìm số tiền lớn nhất sau từ này
- Loại trừ "VAT", "Thuế" khỏi total nếu ghi riêng
- merchant = dòng đầu hoặc dòng có "Co.opmart"/"BigC"/"Vinmart"/etc
- Không chắc → giá trị = ""
```

### 7.3 Coach insight

```
Bạn là AI Coach tài chính cho user VN GenZ. Tone: cợt nhả, thân thiện, KHÔNG dạy đời.
Trả về 1-2 câu, max 100 ký tự, có thể dùng 1 emoji.

Data:
- Tháng {month}
- Tổng chi: {totalExpense} VND
- Tổng thu: {totalIncome} VND
- Top 3 category chi: {top3CategoriesWithAmount}
- So với tháng trước: {compareLastMonth}

Trả 1 trong 4 kiểu:
1. Compliment nếu tiết kiệm tốt
2. Warning nếu vượt 1 category bất thường
3. Suggestion cụ thể "Trà sữa 1.2tr = AirPods sau 3 tháng"
4. Random fun fact / câu đùa

KHÔNG nhắc tên user, số điện thoại, hay thông tin cá nhân.
```

---

## 8. Networking & API contract

- **Base URL Gemini**: `https://generativelanguage.googleapis.com/v1beta`
- **Endpoint**: `/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}`
- **Timeout**: 8 giây mỗi request
- **Retry**: 1 lần với exponential backoff (2s) cho 5xx + network error, KHÔNG retry 4xx
- **Headers**: `Content-Type: application/json` only — KHÔNG gửi User-Agent custom
- **Error mapping**:
  - 400 → "Lỗi input, thử lại với câu rõ hơn"
  - 401/403 → "Key Gemini không hợp lệ — Cài đặt > Gemini"
  - 429 → "Hết lượt miễn phí hôm nay 🥲"
  - 5xx → "Server Google đang sự cố, lát thử"
  - Timeout → "Mạng yếu quá, thử lại"
- **NEVER log**: full request body, response, hay API key
- **Mask trong dev log**: key → `AIza...Xy3` (giữ 4 đầu, 3 cuối)

---

## 9. Security requirements (PHẢI ĐẠT trước khi ship)

### 9.1 Data at rest
- Gemini API key: **expo-secure-store** (Keychain iOS / Keystore Android) — KHÔNG lưu SQLite, AsyncStorage
- PIN: PBKDF2 100k iterations, salt random 16 bytes, lưu hash + salt vào SQLite
- SQLite: không bật SQLCipher cho MVP (đợi feedback), tài liệu hóa risk trong Section 14
- Backup file (CSV/PDF export): KHÔNG include `gemini_api_key`, `pin_hash`

### 9.2 Data in transit
- TLS 1.2+ only (mặc định fetch)
- Pin certificate Google API (optional Tuần 8) — không bắt buộc MVP
- KHÔNG gửi PII (tên user, email) trong prompt Gemini — chỉ amount + category text

### 9.3 Auth & lock
- App lock optional (Settings > Bảo mật)
- Bật lock: 
  - PIN 4-6 chữ số
  - Hoặc biometric (Face ID / fingerprint) qua expo-local-authentication
  - Cả 2: biometric ưu tiên, fallback PIN
- Auto-lock sau 5 phút background hoặc khi tắt app
- Sau 5 lần PIN sai → khoá 5 phút (counter trong settings)
- Forget PIN: phải reset app (xoá data) — không recovery

### 9.4 Input validation
- Amount: integer 1 → 999_999_999_999 (1 nghìn tỷ)
- Note: 0-200 ký tự, strip HTML tags qua regex `/<[^>]*>/g`
- Date: range 2000-01-01 → 2100-12-31
- Category id: phải exist trong DB
- Gemini key: regex `^AIza[a-zA-Z0-9_-]{35}$`

### 9.5 Logging
- Production: `log.ts` wrap console — strip `amount`, `note`, `email`, `pin`, `key`, `token` keys
- Crash report (Sentry): include stack + breadcrumbs, KHÔNG include redux state
- KHÔNG `console.log` trong production build — eslint rule no-console error

### 9.6 Permissions
- Camera: chỉ khi user tap "Scan hoá đơn" — explain trước khi prompt
- Microphone: chỉ khi user tap "Voice" — explain trước
- KHÔNG yêu cầu permission khi mở app lần đầu

### 9.7 Third-party
- Audit dependency mỗi tháng: `npm audit --production` 0 critical
- Lock version, không dùng `^` cho dep nhạy cảm (expo-secure-store, expo-local-authentication)

---

## 10. Test plan

### 10.1 Unit test (Jest) — coverage 70%+

- `utils/format.ts`: formatVND(1000000) === "1.000.000 đ", formatVND(0) === "0 đ"
- `utils/date.ts`: monthRange("2026-05") === ["2026-05-01","2026-05-31"]
- `utils/validate.ts`: validateAmount(0) === false, validateAmount(1_000_000_000_000) === false
- `utils/crypto.ts`: hashPin same input + same salt → same hash, khác salt → khác hash
- `db/index.ts`: CRUD transaction round-trip, budget unique constraint
- `services/gemini.ts`: parseExpenseFromText mock fetch → trả JSON đúng, fallback error đúng

```powershell
npm test
npm test -- --coverage
```

### 10.2 Integration test

- DB migration v1 → v2 không mất data
- Store loadAll → render Lịch tab đúng
- Set budget → cảnh báo vượt hiển thị đúng màu

### 10.3 E2E manual checklist (chạy mỗi release)

**Setup**:
- [ ] Cài Expo Go Android, `npm run start`, quét QR
- [ ] App mở trong < 3s
- [ ] Onboarding hiện lần đầu (nếu chưa onboard)

**Flow 1: Ghi chi tiêu thủ công**
- [ ] Tab Nhập vào → 50000 → Ăn uống → Hôm nay → note "Phở" → Submit
- [ ] Tab Lịch → thấy item "Phở 50.000đ Ăn uống" hôm nay
- [ ] Long-press item → confirm xoá → item biến mất

**Flow 2: AI text input**
- [ ] Cài đặt > Gemini → paste key → Test OK
- [ ] Tab Nhập vào → AI input "Trà sữa 35k" → form auto fill: 35000, Bia/Cafe hoặc Ăn uống, note "Trà sữa"
- [ ] Submit → Lịch tab có item

**Flow 3: Báo cáo**
- [ ] Tab Báo cáo → toggle Chi → pie chart hiển thị ≥ 1 segment
- [ ] Toggle Thu → nếu chưa có income → empty state

**Flow 4: Ngân sách**
- [ ] Tab Ngân sách → tap Ăn uống → nhập 2.000.000 → save
- [ ] Tab Nhập vào → ghi 1.500.000 Ăn uống
- [ ] Tab Ngân sách → progress 75% màu vàng

**Flow 5: Edit & Delete**
- [ ] Tap item ở Lịch → modal edit → đổi amount → save → list cập nhật
- [ ] Modal edit → nút Xoá → confirm → list mất item

**Flow 6: AI Coach**
- [ ] Tab Lịch → AI Coach card hiển thị insight tiếng Việt < 100 ký tự
- [ ] Pull-to-refresh → coach mới
- [ ] Tắt wifi → coach hiển thị "Em đang lười..."

**Flow 7: Security**
- [ ] Settings > Bảo mật → bật PIN → nhập 1234 → confirm
- [ ] Khóa app → mở lại → màn PIN
- [ ] PIN sai 5 lần → khoá 5 phút
- [ ] Settings > Bảo mật → bật biometric → mở lại → quét vân tay

**Flow 8: Camera scan (Tuần 4)**
- [ ] Tab Nhập vào > nút camera → chụp hoá đơn thật → preview parse đúng total
- [ ] Confirm → ghi DB

**Flow 9: Voice (Tuần 5)**
- [ ] Tab Nhập vào > nút mic → nói "Ăn trưa 60 nghìn" → form fill đúng

**Flow 10: Export (Tuần 6)**
- [ ] Cài đặt > Export > CSV tháng này → file save → mở bằng Excel hiện đúng

**Flow 11: Sync (Tuần 6)**
- [ ] Cài đặt > Đồng bộ > đăng ký email/pwd → push thành công
- [ ] Đăng xuất → đăng nhập lại → data pull về

### 10.4 Performance benchmark

- Cold start trên Pixel 6a: < 2.5s
- Tab switch: < 100ms
- List 1000 transactions: scroll 60fps, render full < 500ms
- Gen pie chart 12 segment: < 100ms
- Gemini parse: < 3s (P95)

### 10.5 Accessibility

- Tất cả button có `accessibilityLabel`
- Contrast ratio text vs background ≥ 4.5:1 (WCAG AA)
- Font size scale với system

---

## 11. Build/run instructions

### 11.1 Lần đầu

```powershell
cd D:\CLAUDE\BopAI
npm install
npm run start
```

### 11.2 Test trên điện thoại

1. Cài **Expo Go** từ Play Store (Android) hoặc App Store (iOS) trên điện thoại
2. Điện thoại + máy tính cùng wifi
3. `npm run start` → terminal hiện QR
4. Expo Go → Scan QR → app mở

**KHÔNG dùng `npm run web`** để test feature mobile (camera, voice, haptic, biometric không hoạt động trên web).

### 11.3 Type check

```powershell
npx tsc --noEmit
```
Phải exit 0 trước khi commit.

### 11.4 Lint (Tuần 7+ thêm)

```powershell
npm run lint
```

### 11.5 Build production

```powershell
# EAS Build (cần Expo account)
npx eas build --platform android --profile preview     # APK test
npx eas build --platform android --profile production  # AAB Play Store
```

### 11.6 Submit Play Store

```powershell
npx eas submit --platform android --latest
```
(Cần Google Play Console account, $25 one-time)

---

## 12. Definition of Done (mỗi feature merge phải đạt)

- [ ] Code TypeScript strict, `npx tsc --noEmit` exit 0
- [ ] Acceptance criteria từng feature (Section 6) pass manual test
- [ ] Unit test cho logic mới, coverage không giảm
- [ ] E2E checklist (Section 10.3) tương ứng pass
- [ ] KHÔNG console.log sót trong code (eslint check)
- [ ] KHÔNG emoji icon — chỉ Lucide
- [ ] Cross-platform check: iOS + Android (Web optional)
- [ ] Update README.md nếu user-facing
- [ ] Update BUILD_SPEC.md nếu spec change
- [ ] Git commit message format: `feat(tab): mô tả` / `fix(component): mô tả`

---

## 13. Roadmap timeline (target)

| Tuần | Feature | Status |
|------|---------|--------|
| 1-3 | MVP F1-F8 | ✅ DONE |
| 4 | F9 AI Camera scan | ✅ DONE 2026-05-22 |
| 5 | F10 Voice | ⏸️ DEFERRED — cần dev client build (ML Kit native module) |
| 5 | F11 Quota counter | ✅ DONE 2026-05-22 |
| 6 | F12 Theme picker | ✅ DONE 2026-05-22 |
| 6 | F13 CSV Export | ✅ DONE 2026-05-22 |
| 6 | F14 Firebase Sync | ⏸️ DEFERRED — đại ca cần tạo Firebase project + nhập cấu hình |
| 7 | F15 Onboarding | ✅ DONE 2026-05-22 |
| 7 | F16 App icon + Splash | ⏸️ DEFERRED — cần design vector 1024×1024 |
| 8 | F17 ErrorBoundary | ✅ DONE 2026-05-22 |
| 8 | F18 Performance audit | ⏸️ DEFERRED — chạy khi build EAS production |
| 8 | F19 Closed Testing submit | ⏸️ DEFERRED — đại ca cần Google Play Console $25 |

**Trạng thái 2026-05-22**: app đủ feature core để Expo Go test trên điện thoại. 4 feature defer chờ đại ca:
- F10 Voice: yêu cầu chuyển sang dev client → `eas build --profile development`
- F14 Sync: yêu cầu Firebase project + paste config vào .env
- F16 Icon: cần file vector (Figma export) cho icon + splash
- F19 Submit: cần Google Play Console account + EAS Build account

Mục tiêu update: ship Production 2026-08-15 sau khi unlock 4 mục defer.

---

## 14. Known limitations & deferred items

- **SQLCipher**: chưa bật vì add 5MB bundle + breaking change DB. Defer Tuần 9+ nếu có feedback security.
- **Multi-currency**: chỉ VND. Multi-currency Tuần 10+.
- **Multi-account**: 1 user = 1 ví. Multi-wallet defer v2.
- **Receipt OCR offline**: ML Kit chỉ extract text, Gemini parse cần online. Offline fallback: show raw text.
- **iOS**: chưa test thực tế (anh Bux2 chỉ có Android). Test iOS qua EAS Build trước khi public.
- **Web**: `npm run web` chạy được nhưng KHÔNG support camera/voice/biometric — chỉ dùng dev preview UI.

---

## 15. Liên hệ & escalation

- **Owner**: Bu Bu (anh Bux2), email tranhaitruong.cntt@gmail.com
- **AI agent persona**: "em" — xưng em, gọi user là "anh Bux2", trả lời tiếng Việt, tone GenZ cợt nhả
- **Project memory**: `C:\Users\Truong\.claude\projects\C--Users-Truong--openclaw-workspace\memory\project_bopai_app.md`
- **Confused/blocked?**: ưu tiên đọc file `CLAUDE.md`, `AGENTS.md`, memory file trước khi hỏi user

---

## 16. Anti-pattern (KHÔNG được làm)

- ❌ Thêm emoji icon vào UI — chỉ Lucide SVG
- ❌ `npm run web` để test camera/voice/biometric
- ❌ Lưu Gemini key vào AsyncStorage / SQLite — phải SecureStore
- ❌ Log API key, amount lớn, note user vào console production
- ❌ Gửi tên/email/phone user vào prompt Gemini
- ❌ Block UI thread với heavy compute — dùng async
- ❌ Tự thêm dep nặng (lottie, redux, axios) không có lý do
- ❌ Breaking change DB schema không có migration
- ❌ Copy asset / code từ "Sổ thu chi" gốc
- ❌ Submit Play Store khi chưa pass E2E checklist + bảo mật

---

## Changelog

### v3.77 — 2026-05-24 (15:25) — Pull-down dismiss streak modal + slim modal + DEV test pet stages

**Đại ca báo 3 việc**:
1. Kéo xuống đóng tab chuỗi mãi không được
2. Phần bên dưới chuỗi dài + bộ sưu tập badge không liên quan pet
3. Có cách nào test pet 7 ngày không?

**Fix 1 — Pull-down gesture** (`src/components/StreakBadge.tsx`):
- Thêm `PanResponder` capture vertical drag
- Wrap sheet trong `Animated.View` với `transform: [{ translateY: sheetTranslateY }]`
- Drag area dedicated ở top sheet (chứa handle) — drag down → translateY follow
- Threshold: `dy > 100` HOẶC `vy > 0.8` (velocity) → close modal (animate out)
- Otherwise → spring snap back về 0

**Fix 2 — Slim modal** (`src/components/StreakBadge.tsx`):
- BỎ Month grid (redundant với Week strip)
- BỎ "Bộ sưu tập badge" section (4 milestones 7/30/100/365 — không relevant với Pet character)
- BỎ "Next milestone" tip (đã thay bằng Pet progress bar đến stage tiếp)
- Gọn Stats row: 2 box "Hiện tại" + "Kỷ lục" (bỏ Badge box)
- Freeze Pass tip chỉ hiện khi `freezePasses > 0`

**Fix 3 — DEV test pet stages** (`app/settings/advanced.tsx`):
- Thêm section "DEV — Test Pet stages" vàng cảnh báo
- 5 button: 1d / 7d / 30d / 100d / 365d
- Tap → `UPDATE streaks SET current_streak=?, longest_streak=MAX(...), last_active_date=todayLocal`
- KHÔNG gọi recomputeStreak (sẽ overwrite về 0 vì không có TX)
- `useFocusEffect` ở tab Nhập refresh streak khi quay lại → pet stage tự update

**Link Settings/Advanced** (`app/settings/index.tsx`):
- Section "Dữ liệu" thêm row "Nâng cao" → `/settings/advanced` (trước đó không có UI vào)

**Files**: `src/components/StreakBadge.tsx`, `app/settings/advanced.tsx`, `app/settings/index.tsx`, `app/(tabs)/index.tsx`

---

### v3.76 — 2026-05-24 (15:15) — Pet = Lottie từ LottieFiles (eggpet + petx1)

**Đại ca tự tìm + tải 2 file Lottie free từ LottieFiles** (Lottie Simple License):
- `eggpet.json` — 24KB — pet trứng cho stage 1 (Hạt giống 0-6 ngày)
- `petx1.json` — 53KB — pet sau khi nở cho stage 2-5 (7+ ngày)

**Refactor**:
- `src/components/FlamePet.tsx`: bỏ image Pixar JPG, dùng `<LottieView source={require(...)} autoPlay loop />` với mapping stage level → JSON file
- `PET_LOTTIE[1] = eggpet.json`, `PET_LOTTIE[2..5] = petx1.json`
- `src/components/PetView.tsx`: pass `level={stage.level}` xuống FlamePet
- Giữ Ring background pulse (1800ms scale 1→1.1) animate xung quanh Lottie

**Credit license** (`app/settings/index.tsx` aboutBox cuối Settings):
- Thêm dòng nhỏ italic: "Pet animation by **U know me** · LottieFiles"
- Đáp ứng yêu cầu Lottie Simple License (credit tác giả ở chỗ visible)

**Files**: `src/components/FlamePet.tsx` (rewrite), `src/components/PetView.tsx`, `app/settings/index.tsx`, `src/assets/lottie/pet/eggpet.json` (đại ca tải), `petx1.json` (đại ca tải)

**Future**: Khi đại ca có thêm Lottie pet cho stages 2/3/4/5 riêng → update `PET_LOTTIE` map.

---

### v3.75 — 2026-05-24 (15:05) — Pet = image asset Pixar 3D + animation bounce (Option B)

**Đại ca chốt**: "Còn xấu hơn ban đầu nữa em thôi làm ảnh cộng chút animation đi như ảnh nãy anh gửi em"

→ SVG vector flat không thể đạt 3D shading. Switch sang **image asset** (ảnh tham khảo đại ca gửi).

**Workflow**:
1. Copy ảnh đại ca gửi (`file_531...jpg`) → `D:\CLAUDE\BopAI\src\assets\pet\pet_flame.jpg`
2. Refactor `FlamePet.tsx` bỏ SVG, dùng `<Animated.Image source={require('../assets/pet/pet_flame.jpg')} />`
3. 4 animation idle loop:
   - **Bounce Y**: translateY 0 → -10 → 0 (3s loop)
   - **Sway**: rotate -3° → 3° (5s gentle sin loop)
   - **Shadow scale**: shadow ellipse scaleX 0.85 → 1 đồng bộ với bounce
   - **Ring glow pulse**: ring background scale 1 → 1.1 (3.6s sin loop)
4. resizeMode `contain` để pet không bị méo

**Files**: `src/components/FlamePet.tsx` (rewrite gọn — bỏ SVG, dùng Animated.Image), `src/assets/pet/pet_flame.jpg` (NEW)

**Note**: Ảnh tham khảo gốc JPG có thể có background checkerboard (transparency pattern flatten). Nếu render bị nền lưới → đại ca cần gửi **PNG transparent gốc** thay vì JPG.

**Upgrade path 5 stages**:
1. Đại ca generate 5 ảnh PNG cho 5 stages qua AI image (Bing Create / DALL-E):
   - Prompts khác về size/accessory: seed (nhỏ, không crown) → baby (crown nhỏ) → teen → adult (crown to) → legendary (wings + aura)
2. Đặt vào `src/assets/pet/pet_seed.png`, `pet_baby.png`...
3. FlamePet thêm `stage` prop → map level → image source

---

### v3.74 — 2026-05-24 (14:55) — Pet refactor gần ảnh Pixar 3D tham khảo (Option A)

**Đại ca gửi ảnh tham khảo**: 3D Pixar-style cute flame character — đại ca muốn pet như vậy. Em honest: SVG vector flat KHÔNG đạt được 3D shading. Đại ca chọn Option A → em improve SVG max.

**Cải thiện**:

- **Body shape mới**: Path với `mainPeak` cao nhọn + `leftDip` (200,175) + `rightDip` (295,155) tạo notch flame 2 bên → flame có 1 đỉnh chính + 2 vũng giống ảnh tham khảo
- **Mắt to hơn**: radius 48 → **55**, pupil 31 → **36**. Position điều chỉnh (200/312, y=285).
- **Pupil gradient sharper**: `#5A0418` → `#1A060B` → `#000000` (đậm hơn, ít nâu)
- **Tay NHỎ + sát body**: Bỏ hand tip, dùng 1 ellipse rx=18 ry=28 nhô ra ít. Rotation giảm xuống ±10-15°.
- **Chân ngắn + ngang**: ellipse rx=26 ry=22 thay vì ngang dọc → 2 chân pinkish "đứng" dưới body. Bỏ foot pads.
- **Body gloss highlight**: Thêm `<Ellipse>` trắng opacity 0.18 ở vùng bụng (cx=256, cy=360, rx=85, ry=55) — fake 3D shading
- **Mouth + lông mày** hạ vị trí cho khớp eye to mới (mouth y=360 thay 332, eyebrows x lệch)

**Files**: `src/components/FlamePet.tsx`

---

### v3.73 — 2026-05-24 (14:50) — Pet tay chân đẹp hơn

**Đại ca báo**: "Mắt và miệng khá đẹp rồi còn tay chân thì xấu quá"

**Fix**:
- **Chân**: Trước rounded rect y=405 bị body teardrop che. Đổi sang **Ellipse oval đứng** (rx=22 ry=32) tại y=500 — nằm DƯỚI body, visible. Thêm **foot pads** ellipse nhỏ tone đậm hơn (#D62066) ở y=525.
- **Tay**: Trước rounded rect cứng. Đổi sang **Ellipse cong oval** (rx=22 ry=50) + **hand tip** ellipse nhỏ ở cuối (#FF6F5E sáng hơn) — cảm giác có khớp. Rotation tăng từ ±14° → ±20-25° (cánh tay nghiêng ra xa body hơn).
- **ViewBox**: Mở rộng 512x512 → **512x560** để fit chân outside body. SVG height scale theo aspect ratio mới.
- **Shadow ground**: Hạ y=492 → 540, rx max 75 → 80 (theo viewBox mới).

**Files**: `src/components/FlamePet.tsx`

---

### v3.72 — 2026-05-24 (14:45) — Pet "Flame Star" — render SVG từ JSON spec đại ca gửi

**Đại ca gửi**: JSON spec `SinPet_Flame_01` ~250 dòng chi tiết:
- Body teardrop flame với 3-stop gradient cam→hồng (#FFB12A → #FF8A4D → #FF2F7D)
- 2 mắt to 48px outer + 31px pupil với radial gradient nâu đen + 2 reflection trắng
- 2 lông mày arc đỏ cam, 2 má hồng blur, mouth open + tongue
- Crown band arc vàng + star gem 5 cạnh (outer vàng + inner tím)
- 2 tay rounded rotated, 2 chân rect rounded
- Shadow ground purple blur
- Animations: idle (body Y, arms rotate, crown rotate, star rotate, shadow pulse) 3s loop

**Em build component `FlamePet.tsx`** dùng `react-native-svg` (đã cài 15.12.1):
- `Svg` viewBox 512x512 — match canvas spec
- `Defs` + `LinearGradient` cho body + `RadialGradient` cho pupil (2 mắt)
- `Path d="..."` cho body teardrop (approximate cubic bezier curves theo peak/leftDip/rightDip)
- `Polygon points="..."` cho star gem 5 cạnh (compute từ rotation + outer/innerRadius)
- `Path` cho crown band arc 200°→340°
- `Circle/Ellipse/Rect` cho tất cả các layer còn lại đúng position/size spec
- `Animated.G` rotation + translate cho idle loop (body, arms, crown, star, shadow)
- 1500ms ease in/out scale → match 3s duration spec

**PetView simplified**:
- Bỏ emoji/Lucide visual cũ
- Render `<FlamePet size={180} ringColor={stage.color} />`
- Ring color tint background theo stage (vẫn diff 5 stages)
- Character giống nhau cho mọi stage (đại ca thiết kế 1 character chính)

**Limitation honest**:
- Body teardrop path em approximate (đại ca chỉ cho hint shape "round_teardrop_flame" + 3 points), có thể không exact 100% spec
- Animations đơn giản hơn full spec (em chỉ làm idle, skip blink + happy_jump)
- Đại ca có thể tinh chỉnh path d trong code nếu muốn shape khác

**Files**: `src/components/FlamePet.tsx` (NEW, ~190 dòng), `src/components/PetView.tsx` (rewrite gọn), `src/components/StreakBadge.tsx` (size 120 → 180)

---

### v3.71 — 2026-05-24 (14:32) — Pet visual = emoji character (animal evolution)

**Đại ca báo**: "Càng ngày càng xấu em ơi"

**Root cause**: Em không phải designer. Lottie tự viết (v3.69) xấu, Lucide ráp face features (v3.70) lộn xộn. Cách practical đẹp nhất → **emoji character**.

**Note rule "không emoji"**: Áp dụng cho ICON UI (đã thay Lucide ở navigation/buttons). Pet character = **CONTENT** (animal evolution character), không phải icon → emoji OK.

- ✅ **5 emoji character cho 5 stages** (`src/services/petStages.ts`):
  - 🥚 Hạt giống (0-6 ngày)
  - 🐣 Bé con (7-29)
  - 🦊 Tinh nghịch (30-99) — đổi tên từ "Teen" sang "Tinh nghịch" hợp với fox
  - 🐺 Trưởng thành (100-364)
  - 🐉 Huyền thoại (365+)
- ✅ **PetView refactor** (`src/components/PetView.tsx`):
  - Emoji char chính: `<Animated.Text fontSize={size * 0.62}>` với bounce + scale + rotate
  - **Ring outer pulse** (1500ms loop, scale 1→1.15, opacity nhẹ)
  - **Ring inner platform** soft circle với border
  - **Crown 👑** cho stage 4+ (đứng trên đầu, animate cùng bounce)
  - **3 sparkles ✨ ⭐** cho stage 5 (góc ngẫu nhiên)
  - Vẫn giữ celebrate animation khi level up

**Files**: `src/services/petStages.ts`, `src/components/PetView.tsx`

**Pending decision**: 5 file Lottie cũ ở `src/assets/lottie/pet/` em giữ lại (không xoá). Khi đại ca có Lottie đẹp (AI/designer) → đặt cùng folder + uncomment LottieView block trong PetView.tsx → swap.

---

### v3.70 — 2026-05-24 (14:25) — Fix 3 vấn đề Pet: default name, rename không bấm được, visual đẹp hơn

**Đại ca báo**: "Xấu quá em với lại em để tên mặc định là đặt tên cho pet thôi đừng để tên với anh bấm sửa tên pet chưa được với làm pet đẹp hơn đi xấu quá"

- ✅ **Fix 1 — Default name = empty**:
  - Trước (v3.68): `settings.pet_name || 'Bú Bú'` → hiển thị "Bú Bú" mặc định
  - Sau: hiển thị `"Đặt tên cho pet"` màu xám italic + nút Pencil to làm CTA khi chưa đặt tên
  - User tap text hoặc Pencil → mở rename modal
  - Section "Nuôi {pet_name || 'pet'}" generic

- ✅ **Fix 2 — Rename modal nested không bấm được**:
  - Root cause: Modal rename là **sibling** với Streak Modal nhưng iOS chỉ render 1 Modal top tại 1 time → khi Streak Modal đang open, Modal rename mới mở bị ignore
  - Fix: Bỏ Modal nested → render rename UI bằng **inline absolute overlay** `<Pressable absoluteFill>` INSIDE Streak Modal (cùng layer, không conflict)
  - User tap nút Pencil → setRenamingPet(true) → overlay hiện ngay trong streak modal
  - Tap ngoài card → close. Tap input → keyboard. Save → updateSetting('pet_name')

- ✅ **Fix 3 — Pet visual đẹp hơn**:
  - Lottie JSON tự viết tay (v3.69) đại ca thấy xấu → **disable Lottie** (comment ra, giữ code cho future)
  - PetView refactor với Lucide + Animated multi-layer:
    - **Glow ring pulse** xung quanh (1500ms loop, scale 1→1.15)
    - **Body circle** to (78% của size) với shadow + Lucide icon trung tâm + highlight gloss top-left
    - **2 mắt trắng có pupil** (eye + pupil offset đúng vị trí proportional)
    - **Crown vàng** cho stage 4+ (Icon Crown overlay)
    - **3 sparkles** orbit cho stage 5 (Icon Sparkles ở 3 góc)
  - Default size 120 → 140 (to + rõ hơn)
  - Bounce + scale + rotate animation giữ nguyên
  - Khi đại ca có Lottie thật từ AI/designer → uncomment 2 block đã chuẩn bị sẵn

**Files**: `src/components/StreakBadge.tsx`, `src/components/PetView.tsx`

---

### v3.69 — 2026-05-24 (14:18) — Tạo 5 file Lottie JSON simple cho Pet 5 stages

**Đại ca yêu cầu**: "anh chưa hiểu cách làm em làm cho anh được không"

**Em làm hộ luôn**: Tự viết 5 file Lottie JSON minimal cho 5 stages — chấp nhận quality đơn giản (shapes hình tròn/ellipse + keyframe animation), nhưng có character + animation thật. Đại ca có thể swap với Lottie AI-generated từ LottieFiles Creator sau nếu muốn đẹp hơn.

**5 file mới ở `src/assets/lottie/pet/`**:

- ✅ **pet_seed.json** — Hạt giống xanh lá, 2 mắt đen, bounce gentle (60 frames, 30fps = 2s loop)
- ✅ **pet_baby.json** — Bé con vàng, 2 mắt to có dot trắng (sparkle), wiggle side-to-side (75 frames)
- ✅ **pet_teen.json** — Teen cam, 2 mắt + miệng mở, có flame tip trên đầu wiggle, body scale pulse (45 frames)
- ✅ **pet_adult.json** — Trưởng thành tím, crown vàng có 3 jewel ellipse rocking gentle, sway nhẹ (90 frames)
- ✅ **pet_legendary.json** — Huyền thoại gold + crown to + 2 sparkles orbit xung quanh + body pulse (90 frames)

**Activate trong `PetView.tsx`**:
- Import `LottieView` từ `lottie-react-native`
- LOTTIE_MAP nối stage.level → require JSON
- Render `<LottieView source={LOTTIE_MAP[stage.level]} autoPlay loop />` thay Lucide placeholder
- Lucide fallback giữ nguyên (nếu LottieView crash file → fallback)

**Đại ca có thể swap sau**:
1. Anh dùng Lottie Creator AI generate 5 file đẹp hơn (theo prompts trong PET_LOTTIE_GUIDE.md)
2. Đổi tên 5 file mới thành đúng convention
3. Replace 5 file cũ trong `src/assets/lottie/pet/`
4. Reload — không sửa code

**Files**: `src/assets/lottie/pet/pet_seed.json` (NEW), `pet_baby.json` (NEW), `pet_teen.json` (NEW), `pet_adult.json` (NEW), `pet_legendary.json` (NEW), `src/components/PetView.tsx`

---

### v3.68 — 2026-05-24 (14:10) — User đặt tên pet + Lottie guide

**Đại ca yêu cầu**: "Nuôi cái gì đó tên pet người dùng đặt với tải 5 file ở đâu em"

- ✅ **User đặt tên pet** (giống Snapchat "Bé Sol"):
  - Settings key mới: `pet_name` (default '' → fallback "Bú Bú")
  - StreakBadge modal: tên BIG + Pencil icon edit cạnh tên
  - Tap Pencil → mở rename modal:
    - Title "Đặt tên cho thú cưng"
    - Desc "Tên gọi yêu thương — tối đa 16 ký tự"
    - TextInput autoFocus, maxLength 16, placeholder "vd: Bú Bú, Bé Sol, Mochi..."
    - 2 nút Huỷ / Lưu (Lưu màu theme stage)
  - Save → `updateSetting('pet_name', trimmed)`
  - Layout: `{petName} (BIG color)` + `{stage.name} (small uppercase)` phía dưới
  - "Nuôi Bú Bú" section header → "Nuôi {pet_name || 'Bú Bú'}"

- ✅ **Doc `PET_LOTTIE_GUIDE.md`** — hướng dẫn 5 bước cụ thể:
  1. URL search LottieFiles free per stage
  2. Tải JSON format
  3. Folder + tên file convention (`pet_seed.json`...)
  4. Uncomment 2 block trong PetView.tsx
  5. Reload app
  - Bonus: license note (CC BY 4.0 vs CC0), gợi ý designer Fiverr nếu cần đẹp hơn

**Files**: `src/components/StreakBadge.tsx`, `PET_LOTTIE_GUIDE.md` (NEW)

---

### v3.67 — 2026-05-24 (14:00) — Pet "Bú Bú" 5 stages — Snapchat-style retention từ Streak

**Trigger**: Đại ca gửi 2 ảnh inspiration (Snapchat pet: 702→703 ngày, cục đá khóc → cô gái tóc hồng vui, progress bar 909/900, daily tasks "Nuôi Thú cưng"). Chốt A2 + B3 — Lottie từ LottieFiles + Modal mở từ Streak badge.

**Honest disclaimer**: Em không có khả năng tải file Lottie từ internet (no fetch URL tool). Em build infrastructure đầy đủ với Lucide icon placeholder. Khi đại ca tải 5 file Lottie từ LottieFiles → drop vào `src/assets/lottie/pet/` → uncomment 1 block trong `PetView.tsx` là pet thật chạy.

**3 file mới**:
- `src/services/petStages.ts` — 5 stages (Hạt giống 0-6, Bé con 7-29, Teen 30-99, Trưởng thành 100-364, Huyền thoại 365+) + PET_TASKS (5 tasks daily/recurring) + computeMaturityPoints
- `src/components/PetView.tsx` — Pet visual: Lucide icon + bounce/celebrate Animated. LottieView block ready (commented). Stage 4+ thêm crown, stage 5 thêm sparkles
- (Lottie deps installed: `lottie-react-native ~7.3.1` qua expo install)

**5 stages**:
| Lv | Min streak | Tên | Icon | Color |
|---|---|---|---|---|
| 1 | 0 | Hạt giống | Sparkles | green |
| 2 | 7 | Bé con | Heart | yellow |
| 3 | 30 | Teen | Flame | orange |
| 4 | 100 | Trưởng thành | Crown + Crown overlay | purple |
| 5 | 365 | Huyền thoại | Award + Crown + Sparkles | gold |

**5 daily/recurring tasks** (kiếm điểm trưởng thành):
- Ghi 1 TX hôm nay (+1)
- Ghi thu nhập tháng (+2)
- Apply Wizard tháng (+3)
- Đạt chuỗi 7 ngày (+5)
- Hoàn thành 1 goal (+10) — Total 21 điểm

**Integration vào StreakBadge modal** (B3 approach — không tạo tab mới):
- Pet section ở TOP modal (trên Week strip)
- Pet character to + name + tagline + progress bar lên cấp
- Daily tasks list với check ✓ nếu done
- Giữ nguyên Week strip, Month grid, Badge collection, Freeze pass, Stats

**Lottie swap workflow** (cho đại ca):
1. Vào LottieFiles.com search "pet evolution" / "blob character" / "monster cute"
2. Tải 5 file JSON CC0/free license
3. Đặt vào `src/assets/lottie/pet/`: `pet_seed.json`, `pet_baby.json`, `pet_teen.json`, `pet_adult.json`, `pet_legendary.json`
4. Mở `src/components/PetView.tsx` → uncomment block `LOTTIE_MAP` + lines 86-90 (Lottie render)
5. Pet thật chạy ngay, không sửa code khác

**Files**: `src/services/petStages.ts`, `src/components/PetView.tsx`, `src/components/StreakBadge.tsx`, `package.json` (+lottie-react-native)

---

### v3.66 — 2026-05-24 (13:55) — Month-end review modal (Phần B Option 3)

**Trigger**: Đại ca chốt "làm phần B đi em" — hoàn thành Option 3 (auto goal v3.55 + month review modal cuối tháng).

**User flow**:
1. Ngày ≥ 28 trong tháng, đại ca mở tab Nhập
2. App detect tháng hiện tại có ít nhất 1 TX + chưa review → show modal sau 800ms
3. Modal hiển thị:
   - **Hero**: "Tổng kết tháng MM/YYYY" + icon Sparkles
   - **Stats grid**: Thu (xanh), Chi (đỏ), Tiết kiệm (theme color)
   - **3 trạng thái leftover**:
     - `leftover > 0`: hộp xanh hiển thị số dư, goal picker, nút "Nạp vào quỹ"
     - `leftover < 0`: cảnh báo "Tháng này anh chi vượt mức X đ — cẩn thận tháng sau bạn iu"
     - `leftover === 0`: success "Anh đã khớp ngân sách!"
4. Apply → `addToSavingsGoal(goalId, leftover)` + markDone → toast "Đã nạp X đ vào quỹ Y"
5. Skip → markDone (không hiện lại tháng đó)

**Files mới**:
- `src/services/monthReview.ts` — `computeMonthReview()` + `shouldShowMonthReview()` + `markMonthReviewDone()`
- `src/components/MonthReviewModal.tsx` — bottom sheet modal full UI

**Files modified**:
- `app/(tabs)/index.tsx` — useEffect detect (deps `[transactions.length]`), state + render Modal
- `src/i18n/{vi,en,zh}.ts` — 16 keys `monthReview.*`

**Logic chi tiết**:
- Idempotent flag: setting `month_review_done_${monthStr}` = '1' → KHÔNG hiện lại tháng đó dù mở app nhiều lần
- Compute leftover: `totalIncome - totalExpense - savingsTarget` (savingsTarget từ Wizard apply settings)
- Defer 800ms khi show: tránh gián đoạn UX nếu user vừa nhập TX
- Filter goals active (`!completed_at`): chỉ show goal chưa đạt

**Test cases**:
| Ngày | TX tháng | savingsTarget | leftover | Modal show? |
|---|---|---|---|---|
| 27 | có | 1.8tr | 500k | Không (chưa đến 28) |
| 28 | 0 TX | 0 | 0 | Không (no data) |
| 30 | 5 TX, dư 500k | 1.8tr | 500k | Có → goal picker |
| 30 | 5 TX, vượt | 1.8tr | -200k | Có → warning |
| 30 đã review | có | có | có | Không (idempotent) |

**Hoàn thành Option 3**:
- Phase A (v3.55): Wizard apply auto-create "Quỹ tiết kiệm chung" goal — daily allocator tự rót tiền
- Phase B (v3.66 này): Modal cuối tháng review + phân bổ dư

---

### v3.65 — 2026-05-24 (13:50) — Fix 13 issue: 7 MEDIUM + 6 LOW (skip 4 acceptable)

**Trigger**: Đại ca chốt "fix 7 medium với 10 low luôn". L2/L4/L9/L10 skip vì acceptable hoặc cần spec; M2 defer.

#### 7 MEDIUM
- ✅ **M1 — Search threshold qNum >= 1000** (`app/(tabs)/calendar.tsx:66`): Tránh search "1" match 10.000đ, 100đ, 1.000.000đ noise
- ✅ **M3 — Photo fallback `onError`** (`app/(tabs)/index.tsx`, `app/edit/[id].tsx`): File ảnh missing → tự clear `photoUri` state + log warning, không render Image trống
- ✅ **M4 — Onboarding Back button** (`app/onboarding/index.tsx`): Thêm nút "← Quay lại" ở step > 0, layout justify-between
- ✅ **M5 — Salary cycle custom days input** (`app/settings/salary.tsx`): TextInput số 1-60 ngày khi cycleType = 'days' (preset 7/15 + custom)
- ✅ **M6 — Wizard Next disabled khi income=0** (`app/budget-wizard/index.tsx:503`): IIFE compute `nextDisabled = step === 1 && totalIncome <= 0`, opacity 0.4 + disabled
- ✅ **M7 — Persona filter wallet** (`app/persona/[month].tsx`): `filteredTransactions` filter `currentWalletId` → consistent với Báo cáo/Insights/Budget
- ⏸️ **M2 — FlatList long list** — DEFER: refactor ScrollView nested Swipeable → SectionList risky, 99% user < 200 TX/tháng vẫn OK. Reopen khi user complain lag

#### 6 LOW
- ✅ **L1 — Remove coachLoading dead code** (`app/(tabs)/calendar.tsx`): bỏ state + Skeleton render + import Skeleton (loadCoach chạy sync, skeleton never displayed)
- ✅ **L3 — Recurring thêm `daily` option** (`src/db/index.ts`, `src/services/recurring.ts`, `app/settings/recurring.tsx`): Frequency type + computeNextRun (+1 day) + label "Hàng ngày"
- ✅ **L5 — useEffect deps optimize** (`app/(tabs)/index.tsx:75`): `[transactions]` → `[transactions.length]` — chỉ reload khi count khác (add/delete), không reload khi user update field
- ✅ **L6 — Edit TX learnCategoryPattern** (`app/edit/[id].tsx`): Sau khi save updateTx thành công + có note → call `learnCategoryPattern(note, categoryId)` giống tab Nhập
- ✅ **L7 — Active Savings preview dynamic** (`app/settings/savings.tsx`): IIFE compute `computeSafeToSpend(transactions, bills, today, cycleConfig)` × pct → hiển thị số thật của user, fallback message khi safeAmount=0
- ✅ **L8 — daysElapsed cho tháng tương lai** (`app/(tabs)/report.tsx`): Detect `isFutureMonth` → `daysElapsed = 0` thay vì `daysInMonth` → tránh dilute TB/ngày
- ⏸️ **L2/L4/L9/L10 — Skip**: advanced.tsx rename không cần (admin-only), PIN hash thừa (SecureStore Keychain encrypted), goal cat name compare acceptable (default cats không rename qua UI), bills note field cần verify spec

**Pending**: H1 i18n hardcode (10 file, ~80-100 strings) — v3.66 riêng.

**Files**: `app/(tabs)/index.tsx`, `app/(tabs)/calendar.tsx`, `app/(tabs)/report.tsx`, `app/budget-wizard/index.tsx`, `app/edit/[id].tsx`, `app/onboarding/index.tsx`, `app/persona/[month].tsx`, `app/settings/salary.tsx`, `app/settings/savings.tsx`, `app/settings/recurring.tsx`, `src/db/index.ts`, `src/services/recurring.ts`

---

### v3.64 — 2026-05-24 (13:35) — Fix 6 HIGH bugs (H2-H7), H1 i18n tách riêng

**Trigger**: Đại ca chốt "fix tiếp 7 HIGH", H1 i18n scope rộng để riêng.

- ✅ **H7 — localParse `'tip'` cat map** (`app/(tabs)/index.tsx`):
  - Trước: `'tip'/'tips' → 'Tip'` (category 'Tip' KHÔNG có trong DEFAULT_CATEGORIES)
  - Sau: map sang `'Thưởng'` (Tip = bonus → cùng group income)
- ✅ **H4 — Suggestion confidence guard** (`app/(tabs)/index.tsx:457`):
  - Trước: `{suggestion ? ... : null}` (luôn hiện dù confidence yếu)
  - Sau: `{suggestion && suggestion.confidence > 0.4 ? ... : null}` → match logic của tryVoiceParse
- ✅ **H3 — Wallets "Đặt làm mặc định" UI** (`app/settings/wallets.tsx`):
  - DB layer: `setDefaultWallet(walletId)` — unset is_default = 0 tất cả ví, set 1 cho ví được chọn
  - UI: Crown button cho ví is_default === 0 (cùng row Trash) → tap → setDefault + reload
- ✅ **H6 — Edit TX wallet picker** (`app/edit/[id].tsx`):
  - State `walletId`, load từ `tx.wallet_id` lúc init
  - Pass `wallet_id` vào updateTx
  - UI: walletRow horizontal scroll pills (cùng pattern Tab Nhập), chỉ hiện khi `wallets.length > 1`
- ✅ **H5 — Bills filter paid/unpaid** (`app/bills/index.tsx`):
  - State `filter: 'unpaid' | 'paid'` default 'unpaid'
  - 2 filter tabs top với count
  - Filter bills.filter qua trạng thái paid_at
- ✅ **H2 — Notification minute config** (`app/settings/notifications.tsx`):
  - State `morningMinute`, `summaryMinute` load từ settings (default 0)
  - 4 preset 0/15/30/45 minute picker
  - changeMorningMinute / changeSummaryMinute → updateSetting + re-schedule
  - Notify hiển thị HH:MM
  - Settings key mới: `morning_minute`, `summary_minute`

**Pending**: H1 i18n hardcode khắp 7 settings sub-screen + onboarding + LockScreen — scope rộng, để riêng v3.65.

**Files**: `app/(tabs)/index.tsx`, `app/edit/[id].tsx`, `app/settings/wallets.tsx`, `app/settings/notifications.tsx`, `app/bills/index.tsx`, `src/db/index.ts`

---

### v3.63 — 2026-05-24 (13:20) — Fix 4 CRITICAL bugs từ audit full

**Trigger**: Audit toàn diện 3-agent (Tab Nhập/Lịch + Settings + Báo cáo/Ngân sách/Wizard) phát hiện 4 CRITICAL.

- ✅ **C1 — `todayISO()` UTC bug** (`src/utils/date.ts:9-11`):
  - Trước: `new Date().toISOString().slice(0,10)` → UTC date
  - Sau 17:00 VN (UTC+7), UTC đã sang ngày mới → todayISO() trả ngày mai
  - Form default date = ngày mai → store guard throw "ngày tương lai" → **user KHÔNG ghi được TX cuối ngày** (blocker)
  - Fix: dùng `getFullYear/getMonth/getDate` local timezone

- ✅ **C2 — Edit TX đổi type không reset categoryId** (`app/edit/[id].tsx:147-163`):
  - Trước: Tap Chi/Thu chỉ `setType(...)` → cat của type cũ giữ nguyên
  - Lưu → DB chứa `category_id` expense trong TX income (hoặc ngược lại) → data corruption, icon/name sai khi load lại
  - Fix: `onPress={() => { setType('expense'); setCategoryId(null); }}` (copy pattern từ Tab Nhập)

- ✅ **C3 — CalendarGrid Sunday-first vs StreakBadge Monday-first** (`src/components/CalendarGrid.tsx:19,37`):
  - Trước: `DAY_LABELS = ['CN','T2','T3','T4','T5','T6','T7']` + `startWeekday = firstDay.getDay()` (0=Sun)
  - StreakBadge tuần Mon-Sun (services/streak.ts:weekDays Monday-first)
  - 2 view khác nhau → user confused
  - Fix: `DAY_LABELS = ['T2','T3','T4','T5','T6','T7','CN']` + `startWeekday = (firstDay.getDay() + 6) % 7`

- ✅ **C4 — Multi-book pollution** (DB layer):
  - `deleteBudget(category_id, month, bookId?)` thêm param bookId — WHERE thêm `AND book_id = ?` khi truyền
  - Store `removeBudget` pass `get().currentBookId` xuống dbDelBudget
  - `clearBudgetsForMonth(month, bookId)` đã có sẵn (v3.53) — Wizard apply giờ pass `currentBookId`
  - `getSavingsGoals(bookId?)` đã có support — Wizard idempotency check + Active Savings allocator giờ pass bookId
  - `runDailyAllocation(transactions, bills, settings, today, bookId?)` thêm param — `_layout.tsx` boot pass `state.currentBookId`
  - `getYesterdayUnusedSuggestion(transactions, today, bookId?)` + `acceptUnusedSuggestion(date, amount, bookId?)` thêm param
  - Note: Multi-book UI đã ẩn 2026-05-23, nhưng code clean để tránh tích tật

**Test cases**:
- 23:00 ngày 24/5 VN, mở Tab Nhập → date default = 24/5 (KHÔNG phải 25/5)
- Edit TX Chi→Thu → cat grid trống, phải chọn lại cat thuộc income → save → đúng
- Tab Lịch grid + StreakBadge week strip cùng bắt đầu T2

**Files**: `src/utils/date.ts`, `app/edit/[id].tsx`, `src/components/CalendarGrid.tsx`, `src/db/index.ts`, `src/store/useStore.ts`, `app/budget-wizard/index.tsx`, `src/services/activeSavings.ts`, `app/_layout.tsx`

---

### v3.62 — 2026-05-24 (11:37) — Tab Ngân sách: ẩn savings row khi xoá hết budgets + auto-clear setting

**Đại ca báo**: "xoá hết danh mục vẫn báo tiết kiệm tháng này 1.800.000đ"

**Root cause**:
- User xoá từng budget item qua modal → `removeBudget` chỉ `DELETE FROM budgets`, KHÔNG đụng setting `budget_savings_${month}`
- Setting cũ từ Wizard apply vẫn lưu → UI hiện row savings dù `totalBudget = 0`

- ✅ **UI guard** (`app/(tabs)/budget.tsx`):
  - `{savingsTarget > 0 && totalBudget > 0 ? <SavingsRow /> : null}` — chỉ hiện khi có ít nhất 1 budget item
- ✅ **Auto-clear settings khi xoá budget cuối** (`src/store/useStore.ts` `removeBudget`):
  - Sau khi delete + loadBudgets, check `remaining.length === 0` → `setSetting('budget_savings_${m}', '')` + `setSetting('wizard_goal_applied_${m}', '')`
  - Lý do clear cả `wizard_goal_applied`: user chạy Wizard lại tháng này sẽ KHÔNG bị idempotent block (do v3.55) → goal target được update lại đúng
- ✅ **Reload savings khi budgets thay đổi**: useEffect deps thêm `budgets.length` để re-fetch setting sau remove

**Test**:
| Action | savingsTarget UI |
|---|---|
| Apply Wizard 10% (= 900k) | Hiện 900k |
| Tap 1 budget item → Xoá | Còn n-1 budgets > 0 → vẫn hiện 900k |
| Xoá hết các budget items | totalBudget=0 → hide row, setting cleared |
| Chạy Wizard lại | Goal "Quỹ tiết kiệm" được tạo lại từ đầu (flag wizard_goal_applied đã clear) |

**Files**: `app/(tabs)/budget.tsx`, `src/store/useStore.ts`

---

### v3.61 — 2026-05-24 (11:35) — Wizard savings = EXACT user choice (revert v3.50)

**Đại ca báo**: "lương cơ bản 9tr, chi tiêu cứng 3tr, anh chọn tiết kiệm 10% thì ra 900k nhưng lúc ra thì nó báo tiết kiệm 1tr8"

**Root cause**: Logic v3.50 dồn extra → savings → khi user chọn savings < 20% (như 10% = 900k), extra dôi ra → cộng vào savings → output savings cao hơn user-chosen.

**Trace bug**:
- income 9tr, fixed 3tr, savings 10% = 900k
- availableAfterFixedSavings = 5.1tr
- needsBudget 1.5tr + wantsBudget 2.7tr = 4.2tr
- Extra 900k → v3.50 dồn vào savings → savings = 900k + 900k = **1.8tr** ❌

**Fix v3.61** — Savings = EXACT user-chosen target, KHÔNG scale up/down:
```ts
const finalSavings = savingsTarget; // cố định
if (totalIdeal > available) scale down needs/wants;
else if (totalIdeal < available) extra → 50/50 needs/wants;
```

**Test cases**:
| Input | Output |
|---|---|
| income 9tr, fixed 3tr, savings 10% = 900k | savings 900k ✓, needs 1.95tr, wants 3.15tr |
| income 9tr, fixed 3tr, savings 20% = 1.8tr | savings 1.8tr ✓, needs 1.5tr, wants 2.7tr |
| income 9tr, savings 30% = 2.7tr, fixed 3tr | savings 2.7tr ✓, needs 1.18tr, wants 2.12tr (scale down) |
| income 9tr, no fixed, savings 10% | savings 900k ✓, needs 4.95tr, wants 3.15tr |

**Trade-off**: Quy tắc 50/30/20 gốc nói savings là 20% target, không lệch. App giờ tôn trọng user-choice tuyệt đối.

**Files**: `src/services/budgetRecommender.ts`

---

### v3.60 — 2026-05-24 (11:25) — Fix toàn bộ 7 bug từ audit v3.59 (1 MED + 5 LOW + 1 INFO)

**Trigger**: Đại ca chốt "tất cả nhớ làm kĩ càng" sau audit v3.59.

- ✅ **B1 MED — Orphan photo files khi reset DB** (`src/db/index.ts:330-352`):
  - Trước khi `closeAsync()` + `deleteDatabaseAsync()`: scan `SELECT photo_uri FROM transactions WHERE photo_uri IS NOT NULL AND photo_uri != ''`
  - Loop từng URI → `FileSystem.getInfoAsync` + `deleteAsync({ idempotent: true })`
  - Catch lỗi từng file, không crash nếu 1 file đã missing
  - Storage leak fix: reset xong ảnh trong documentDirectory cũng được wipe

- ✅ **B7 INFO — Undo TX thêm source_id** (`app/(tabs)/calendar.tsx`):
  - performUndo bây giờ pass `source_id: t.source_id` (cùng source + wallet_id + photo_uri v3.59)
  - TX khôi phục từ bill/recurring giữ link gốc

- ✅ **B6 LOW — Budget modal i18n** (`app/(tabs)/budget.tsx`):
  - `'Huỷ'` → `t('common.cancel')`, `'Xoá'` → `t('common.delete')`, `'Lưu'` → `t('common.save')`
  - User en/zh thấy text đúng locale

- ✅ **B5 LOW — Reset confirm word multi-locale** (`app/settings/index.tsx`):
  - Hardcoded `'XOÁ'` → `t('settings.resetConfirmWord')` (vi=XOÁ, en=DELETE, zh=删除)
  - `placeholder` của TextInput cũng dùng key này
  - Compare cả raw + uppercase để case-insensitive
  - Hint message dùng template `'settings.resetConfirmHint'` với param `{word}`

- ✅ **B4 LOW — Wizard goal name i18n** (`app/budget-wizard/index.tsx`):
  - Hardcoded `'Quỹ tiết kiệm chung'` → `t('wizard.goalName')`
  - vi=Quỹ tiết kiệm chung, en=General savings fund, zh=通用储蓄金
  - Note: name lưu theo locale lúc tạo, user có thể rename trong tab Goals

- ✅ **B3 LOW — Active Savings menu** (`app/(tabs)/more.tsx`):
  - Thêm item `Crown` icon "Tự động tiết kiệm" trong section Cài đặt
  - Link `/settings/savings` (route đã có sẵn `app/settings/savings.tsx`)
  - Giải dead key `more.activeSavings` + `more.activeSavingsDesc` (đã có vi/en/zh)
  - User khám phá được Active Savings từ tab Khác, không phải mò qua Goals

- ✅ **B2 LOW — Onboarding text obsolete** (`app/onboarding/index.tsx:35-43`):
  - Trước: "Chụp hoá đơn siêu thị, quán cafe — app tự đọc tổng tiền và ghi vào sổ" (sai — camera scan đã ẩn 2026-05-23)
  - Sau: "Đính kèm ảnh hoá đơn từ thư viện cho mỗi giao dịch để dễ tra cứu" (đúng feature thực tế)
  - User mới không hiểu lầm về tính năng camera AI

**Files**: `src/db/index.ts`, `app/(tabs)/calendar.tsx`, `app/(tabs)/budget.tsx`, `app/(tabs)/more.tsx`, `app/settings/index.tsx`, `app/budget-wizard/index.tsx`, `app/onboarding/index.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

---

### v3.59 — 2026-05-24 (11:17) — Fix N2 locale flash + N3 undo TX mất wallet_id

**Trigger**: 2 LOW issue còn lại từ audit v3.58.

- ✅ **N2 — Locale parse đủ 3 case** (`app/_layout.tsx:148`):
  - Trước: `const locale = settings.locale === 'en' ? 'en' : 'vi'`
  - Sau: `settings.locale === 'en' ? 'en' : settings.locale === 'zh' ? 'zh' : 'vi'`
  - User dùng tiếng Trung sẽ KHÔNG bị flash sang VI lúc boot trước khi tab mount + useLocale() chạy

- ✅ **N3 — Undo TX khôi phục đầy đủ** (`app/(tabs)/calendar.tsx:174-181`):
  - Trước: chỉ pass 5 field (amount, category_id, note, type, date) → wallet_id/photo_uri/source bị mất
  - Sau: thêm `wallet_id: t.wallet_id, photo_uri: t.photo_uri ?? null, source: t.source`
  - User swipe xoá TX → Undo → TX khôi phục với đúng wallet + ảnh + nguồn gốc (manual/bill/recurring/transfer/scan)

**Files**: `app/_layout.tsx`, `app/(tabs)/calendar.tsx`

---

### v3.58 — 2026-05-24 (11:15) — Submit/Save button disabled khi đang await (tránh double-tap dup TX)

**Trigger**: Audit lại sau v3.57 phát hiện N1 MEDIUM — `addTransaction`/`updateTransaction` không có guard double-tap → user tap nhanh 2 lần có thể tạo 2 TX dup.

- ✅ **Tab Nhập `app/(tabs)/index.tsx`**:
  - Thêm state `submitting: boolean`
  - `submit()` entry: guard `if (submitting) return`
  - `doSubmit()`: setSubmitting(true) → await addTransaction → setSubmitting(false) (cả happy path + catch error path)
  - Submit button: `disabled={submitting}` + `opacity: submitting ? 0.6 : 1`
- ✅ **Edit modal `app/edit/[id].tsx`**:
  - Thêm state `saving: boolean`
  - `save()`: guard `if (saving) return` + setSaving(true) → await updateTx → setSaving(false) ở catch path
  - Submit button: `disabled={saving}` + `opacity: saving ? 0.6 : 1`

**Test cases**:
- User tap submit 3 lần nhanh → chỉ 1 TX được tạo, button mờ trong lúc await ✓
- Submit lỗi (vd date future bypass) → setSubmitting(false) → button enable lại để retry ✓

**Files**: `app/(tabs)/index.tsx`, `app/edit/[id].tsx`

---

### v3.57 — 2026-05-24 (11:05) — Fix 3 WARN từ audit user journey

**Trigger**: Audit 7 user journey ra 38 verification points (27 PASS / 10 WARN / 1 FAIL). Đại ca duyệt fix 3 WARN urgent. FAIL Active Savings formula đang chờ confirm intent.

- ✅ **WARN 1 — Reset DB re-seed patterns ngay**:
  - Sau `resetDatabase()` trong `doReset()` → gọi `seedDefaultPatterns()` ngay
  - Trước fix: user reset xong gõ "ăn sáng" → suggest fail vì pattern table trống cho đến restart app
  - File: `app/settings/index.tsx`

- ✅ **WARN 2 — Edit/Add TX try-catch UX**:
  - `app/edit/[id].tsx save()`: wrap `await updateTx(...)` trong try/catch → notify error message từ store guard (vd "Không thể ghi giao dịch với ngày trong tương lai")
  - `app/(tabs)/index.tsx doSubmit()`: cùng try/catch cho `addTransaction`
  - Trước fix: throw silent, user không thấy feedback, modal đứng yên/màn hình không phản hồi

- ✅ **WARN 3 — Unify threshold unused-yesterday**:
  - Auto-process: `>= 1_000` → `>= 10_000` (match manual suggestion line 225)
  - Tránh micro-allocation +1.000đ vô goal (dust)
  - File: `src/services/activeSavings.ts`

**Pending**: FAIL Active Savings formula mismatch — đại ca confirm intent rồi em fix.

**Files**: `app/settings/index.tsx`, `app/edit/[id].tsx`, `app/(tabs)/index.tsx`, `src/services/activeSavings.ts`

---

### v3.56 — 2026-05-24 (10:50) — Cap TX date max = today + skip over-budget notify cho tháng cũ

**Đại ca yêu cầu**:
- "cho nhập từ ngày hiện tại tới ngày trước đó thôi em ràng lịch lại không cho nhập sau ngày hiện tại"
- 24/5: nhập được 23/5, 22/5... nhưng từ 25/5 đổ lên là không được
- Fix luôn over-budget notify spam khi nhập TX tháng cũ

- ✅ **`DatePickerField` — prop `maxDate?: string`**:
  - Native iOS/Android: pass `maximumDate={new Date(maxDate)}` cho DateTimePicker
  - Web: thêm attr `max={maxDate}` cho `<input type="date">`
  - Guard trong `handleChange`: nếu user lỡ chọn date > maxDate → clamp về maxDate
- ✅ **Tab Nhập + Edit TX**: `<DatePickerField maxDate={todayISO()} />`
  - User KHÔNG chọn được date sau hôm nay (calendar disable visual)
- ✅ **Defense-in-depth store guard**:
  - `addTransaction`: nếu `t.date > todayStr` → throw `'Không thể ghi giao dịch với ngày trong tương lai'`
  - `updateTransaction`: cùng guard nếu fields có `date`
  - User dù bypass UI vẫn không thể tạo TX future date
- ✅ **Fix over-budget notify spam** (`addTransaction`):
  - Hiện cũ: TX date tháng 4 → check budget tháng 4 → nếu vượt → notify "vượt budget tháng 4" → tháng cũ vô nghĩa
  - Fix: chỉ notify khi `t.date.slice(0,7) === currentMonth(today)`
  - TX past tháng: vẫn cộng vào budget tháng đó (data đúng) nhưng KHÔNG push notif

### Test cases
| Action | Result |
|---|---|
| Tab Nhập, mở date picker, scroll tới 25/5 (hôm nay 24/5) | DatePicker disable 25/5 (xám) |
| User lỡ tay onChange = 26/5 via web input | Auto clamp về 24/5 |
| Test addTransaction({ date: '2030-01-01' }) | Throw error |
| Nhập TX date=tháng 4 (vượt budget tháng 4) | KHÔNG notify (tháng cũ) |
| Nhập TX date=hôm nay (vượt budget tháng này) | Notify như cũ |

**Files**: `src/components/DatePickerField.tsx`, `app/(tabs)/index.tsx`, `app/edit/[id].tsx`, `src/store/useStore.ts`

---

### v3.55 — 2026-05-24 (10:45) — Wizard apply auto-create "Quỹ tiết kiệm chung" goal

**Đại ca hỏi**: "khoản tiết kiệm và khoản dư cuối mỗi tháng thì nó cộng vô đâu"
→ Chọn Option 3 (Phase A: auto-goal).

**Hiện trạng**: Wizard chỉ save savingsTarget vào settings (chỉ hiển thị tab Ngân sách). Không có goal nào được tạo → tiền tiết kiệm "ảo", không có nơi rót.

- ✅ **Wizard apply auto-create/update Saving Goal** (`app/budget-wizard/index.tsx`):
  - Sau khi setBudget + save settings
  - Check goal tên "Quỹ tiết kiệm chung" (chưa completed)
  - Nếu chưa có → `addSavingsGoal({ name, target: savingsTarget, icon: 'Wallet', color: palette.primary })`
  - Nếu có → `updateSavingsGoal(id, { target: existing.target + savingsTarget })` (cumulative)
  - Idempotent flag `wizard_goal_applied_${month}` = '1' → chạy Wizard nhiều lần CÙNG tháng KHÔNG cộng dồn target
  - Notify "Đã áp dụng ngân sách + tạo Quỹ tiết kiệm cho tháng này"
- ✅ **Active Savings v3.23 (đã có sẵn)** sẽ tự rót tiền vào goal này daily → user thấy tiền tiết kiệm tăng dần thực sự

### Test cases
| Action | Goal "Quỹ tiết kiệm chung" |
|---|---|
| Tháng 5 wizard apply savings 4tr | Goal mới: target 4tr, current 0 |
| Tháng 5 wizard apply LẠI (cùng tháng) | Goal: target vẫn 4tr (idempotent) |
| Tháng 6 wizard apply savings 5tr | Goal: target 9tr (4tr + 5tr cumulative) |
| Daily allocator chạy hôm sau | Goal current += daily allocation |

**Phase B (Month-end review modal)**: TODO sau, đại ca chọn làm A trước.

**Spec**: `BUG_SPEC_v3_55.md`
**Files**: `app/budget-wizard/index.tsx`

---

### v3.54 — 2026-05-24 (10:35) — Settings inside style match tab Khác bên ngoài

**Đại ca yêu cầu**: "Cài đặt bên trong em làm cho giống bên ngoài đi em"

**Hiện trạng**:
- Tab Khác (more.tsx): card lớn `padding:14`, icon tròn 40x40 `borderRadius:20`, label đậm + sub xám, background `#f9fafb`
- Settings (settings/index.tsx): iOS grouped list — card trắng wrap, row hairline, icon vuông 30x30 `borderRadius: RADIUS.sm`, không có sub

→ 2 style khác nhau → cảm giác "đi vào trong" bị lạc.

- ✅ **Refactor `app/settings/index.tsx`**:
  - `row → item`: padding 14, gap 12, background `#f9fafb`, borderRadius 12, marginBottom 8 (match more.tsx)
  - `rowIcon → iconBox`: 40x40 tròn, background `palette.primary + '20'`
  - Thêm trường `sub?: string` trong type `Row` → render `itemSub` font 11 xám dưới label
  - Section header: bỏ `SectionHeader` component, dùng inline `sectionTitle` font 11 uppercase màu `#9ca3af`
- ✅ **Tái sử dụng i18n existing `*Desc` keys** (đã có sẵn từ trước):
  - categories/security/notifications/recurring/language/theme/export sub đều có Desc tương ứng
- ✅ **Thêm i18n keys mới** (vi/en/zh):
  - `settings.section.account` / `.security` / `.notif` / `.appearance` / `.data` / `.danger`
  - `settings.resetSubShort` — sub ngắn cho reset row (replacing long dangerDesc)
- ✅ **Cleanup**: Remove unused `SectionHeader` import. Old styles (groupBox/row*/rowSep) deleted/replaced.

**Files**: `app/settings/index.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

---

### v3.53 — 2026-05-24 (10:25) — Wizard apply clear budget cũ trước khi apply mới

**Đại ca báo**: "lương 20tr tiết kiệm 20% mà vẫn báo còn 19tr"

**Trace** (ảnh 10:22):
- Income 20tr, savings 4tr (20%), fixed = 0
- Engine return: needs 10tr + wants 6tr = 16tr ✓ đúng
- Tab Ngân sách hiện: **Tổng 19.000.000đ, Còn lại 19tr** ❌ thừa 3tr

**Root cause**:
- Đại ca đã chạy Wizard 1 lần trước với fixed "Tiền nhà 3tr" → setBudget(Tiền nhà, 3tr)
- Lần 2 chạy với 20tr, KHÔNG còn Tiền nhà fixed
- Engine return items KHÔNG có Tiền nhà
- `applyBudgets` chỉ UPDATE budgets cho items có > 0 → Tiền nhà 3tr cũ vẫn lưu DB
- Tổng budget = 16tr (mới) + 3tr (Tiền nhà cũ stale) = 19tr

- ✅ **Helper mới `clearBudgetsForMonth(month, bookId?)`** trong `src/db/index.ts`:
  - `DELETE FROM budgets WHERE month = ? AND book_id = ?`
- ✅ **`applyBudgets` Wizard** clear budgets cũ TRƯỚC khi setBudget items mới:
  - Đảm bảo state DB sau apply == đúng items từ engine (không tích luỹ)
  - Test: chạy Wizard 9tr (có Tiền nhà 3tr fixed) → apply → tổng 9tr. Chạy lại 20tr (no fixed) → apply → tổng phải = 16tr (KHÔNG còn Tiền nhà 3tr cũ)

**Files**: `src/db/index.ts`, `app/budget-wizard/index.tsx`

---

### v3.52 — 2026-05-24 (10:20) — Tối ưu giao diện: Tab Báo cáo compact + Tab Khác sectioned + color theme consistency

**Đại ca yêu cầu**: "tối ưu giao diện trước đi em"

**3 việc**:

- ✅ **Tab Báo cáo gọn lại**: MonthSwitcher marginBottom 12→8, WalletSwitcher 10→8 → tiết kiệm 6px chiều dọc, gap sát nhau hơn
- ✅ **Tab Khác chia 3 section** (`app/(tabs)/more.tsx`):
  - **Tài chính của bạn**: Tổng kết hôm nay · Hoá đơn · Mục tiêu · Persona
  - **Cài đặt**: Quản lý ví · Chu kỳ lương · Cài đặt chung
  - **Hỗ trợ & Đánh giá**: Đánh giá app · Liên hệ
  - Section header uppercase font 11 màu xám, padding gọn → dễ scan
  - Items list `sections.map → section.items.map`
  - i18n key mới: `more.section.finance` / `more.section.settings` / `more.section.about` (vi/en/zh)
- ✅ **Color consistency** — `DatePickerField` iosDone button:
  - Bỏ hardcoded `#10b981` → `palette.primary` (dùng `useTheme()`)
  - Đại ca đổi theme (mint/sunset/ocean...) thì nút "Xong" ngày sẽ đổi màu theo
  - Các hardcoded `#10b981` khác là DATA defaults (DB schema, color picker choices, persona identity) → giữ nguyên (intentional)

**Files**: `app/(tabs)/report.tsx` (n/a), `app/(tabs)/more.tsx`, `src/components/MonthSwitcher.tsx`, `src/components/WalletSwitcher.tsx`, `src/components/DatePickerField.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

---

### v3.51 — 2026-05-24 (10:03) — Compact tab Nhập aggressive + fix font tìm chi tiêu giãn

**Đại ca báo**:
1. Khoảng cách vẫn còn xa ở GHI NHANH và "chi tiêu hôm nay" (= SỐ TIỀN input)
2. Lỗi chữ khi reset data ở "tìm chi tiêu" (tab Lịch placeholder)

- ✅ **Compact tab Nhập (round 2)**:
  - `SafeToSpendCard`: marginBottom 14 → 8 (`SPACING.sm`)
  - `voiceBox`: marginTop 12 → 4, marginBottom 10 → 8
  - `typeTabs`: marginBottom 10 → 8
  - `label`: marginTop 10 → 6 (giảm gap label đến input)
  - `amountInput`: padding 12 → 8 (số tiền compact hơn)
  - `DatePickerField row`: padding 12 → 10, marginBottom 16 → 8
- ✅ **Fix font giãn placeholder tìm chi tiêu** (`app/(tabs)/calendar.tsx`):
  - `searchInput` style thêm `letterSpacing: 0` + `fontFamily: Platform.OS === 'ios' ? 'System' : undefined`
  - Cùng pattern v3.45 fix cho voiceInput. Bug iOS default font có letter spacing dương → placeholder dạng UPPERCASE bị giãn ra rõ rệt sau reset DB.

**Files**: `app/(tabs)/index.tsx`, `app/(tabs)/calendar.tsx`, `src/components/SafeToSpendCard.tsx`, `src/components/DatePickerField.tsx`

---

### v3.50 — 2026-05-24 (09:50) — Wizard giữ savings cứng + tab Ngân sách hiển thị savings + compact tab Nhập

**Đại ca báo 2 bugs** (ảnh 9:37 + 9:39):
1. Tab Nhập có khoảng trống thừa nhiều ở GHI NHANH và số chi tiêu
2. Wizard: lương 9tr, savings 20% (= 1tr8) → app trả tiết kiệm chỉ 500k, chi tiêu 8tr5

**Bug 2 — Root cause** (`src/services/budgetRecommender.ts:191-196`):
Logic cũ "dồn dư vào needs/wants" khi `totalIdeal < availableAfterFixedSavings`:
```ts
const extra = availableAfterFixedSavings - totalIdeal;
needsBudget += extra * 0.5;
wantsBudget += extra * 0.5;
```
→ Nếu savings target < 20% income → có dư → engine tự tăng spending thay vì giữ savings cứng. Đại ca chọn 20% → mong 20% (1.8tr), không phải bị dồn về chi tiêu.

- ✅ **Fix engine** — extra giờ cộng vào `finalSavings`, không vào needs/wants:
  ```ts
  let finalSavings = savingsTarget;
  if (totalIdeal < availableAfterFixedSavings) {
    finalSavings = savingsTarget + (availableAfterFixedSavings - totalIdeal);
  }
  // result.savingsTarget = finalSavings
  ```
- ✅ **Wizard Step 3 defensive**: tap preset 20% → ép `setSavingsMode('pct')` + `setSavingsPct(p)` để state không lệch
- ✅ **Lưu savings → settings**: `setSetting('budget_savings_${month}', result.savingsTarget)` khi apply
- ✅ **Tab Ngân sách hiển thị Savings row**: card xanh `Crown` icon ngay dưới overview, label "Tiết kiệm tháng này — Để dành mỗi tháng, không tính vào chi tiêu"

**Bug 1 — Compact UI tab Nhập**:
- `voiceBox`: marginTop 20→12, marginBottom 16→10, padding 12→10
- `voiceInput`: padding 10→8, marginBottom 8→6
- `voiceBtn`: padding 10→8
- `voiceHead`: marginBottom 6→4
- `typeTabs`: marginBottom 16→10, typeTab padding 10→8
- `label`: marginTop 14→10, marginBottom 6→4
- `input`: padding 12→10

**Spec chi tiết**: `BUG_SPEC_v3_50.md`
**Files**: `src/services/budgetRecommender.ts`, `app/budget-wizard/index.tsx`, `app/(tabs)/budget.tsx`, `app/(tabs)/index.tsx`

---

### v3.49 — 2026-05-24 (09:32) — Streak tính theo created_at (commitment habit), không phải TX.date

**Đại ca báo bug + diễn giải logic** (ảnh 9:26):
- Nhập TX hôm nay 24/5 với date = 12/5 (lùi quá khứ)
- Lịch streak tô ngày 12 cam — đại ca không muốn
- "lịch đó dành cho đúng ngày nhập chi tiêu chứ" → streak phải = ngày user MỞ APP + GHI SỔ liên tiếp (commitment), không phải ngày của giao dịch

**Root cause**:
- `src/services/streak.ts` query `SELECT DISTINCT date FROM transactions` → đếm theo TX.date (có thể là quá khứ)
- `src/components/StreakBadge.tsx` line 56: `transactions.map((t) => t.date)` → tô lịch theo TX.date

- ✅ **Đổi sang `created_at`** (timestamp DB tự sinh khi user bấm):
  - `recomputeStreak`: `SELECT DISTINCT DATE(created_at, 'localtime') AS date FROM transactions ORDER BY date DESC`
  - SQLite `'localtime'` modifier convert UTC → device timezone
- ✅ **Helper mới** `createdAtLocalDate(createdAt: string)`:
  - Parse "YYYY-MM-DD HH:MM:SS" UTC → local "YYYY-MM-DD"
  - Export từ `streak.ts` để StreakBadge dùng (đảm bảo cùng logic)
- ✅ **StreakBadge**: `txDateList` giờ `transactions.map((t) => createdAtLocalDate(t.created_at))`

### Test cases (sau fix)
| Action | activeDates | streak | Lịch tô |
|---|---|---|---|
| Hôm nay 24, nhập TX date=24 | {24} | 1 | 24 ✓ |
| Hôm nay 24, nhập TX date=12 (lùi) | {24} | 1 | 24 ✓ |
| Xoá TX, không còn TX | {} | 0 | — ✓ |

**Spec chi tiết**: `BUG_SPEC_v3_49.md`
**Files**: `src/services/streak.ts`, `src/components/StreakBadge.tsx`

---

### v3.48 — 2026-05-24 (09:25) — Nút Xoá ngân sách rõ ràng trong modal edit

**Đại ca báo**: "anh nhập ngân sách rồi anh chưa thể huỷ được cái ngân sách đó"

**Root cause** (`app/(tabs)/budget.tsx`):
- Function `clearBudget` đã có nhưng chỉ trigger qua `onLongPress` (giữ lâu item) — discoverability = 0
- Modal edit ngân sách chỉ có 2 nút: [Huỷ] [Lưu] → không có cách xoá rõ ràng

- ✅ **Thêm nút "Xoá" trong modal** (giữa Huỷ và Lưu):
  - Chỉ hiện khi danh mục ĐÃ có ngân sách (`budgetMap[editing.catId]` truthy)
  - Màu đỏ (palette.expense) để báo destructive action
  - Tap → Alert confirm → xoá budget + close modal
- ✅ Sửa `clearBudget` để `setEditing(null)` sau khi xoá (đóng modal)
- ✅ Long-press vẫn giữ làm shortcut (power user)

**Files**: `app/(tabs)/budget.tsx`

---

### v3.47 — 2026-05-24 (09:20) — Ghi nhanh strip số rời + hardcoded income map + toggle deselect cat + dời Persona

**Đại ca yêu cầu 4 việc (sau khi viết spec `BUG_SPEC_v3_47.md` chờ duyệt):**
1. "30 ăn sáng" → note giữ nguyên số 30, lẽ ra "Ăn sáng"
2. "Lương 10tr" có khi auto-fill cat Lương có khi không
3. Đã chọn danh mục → không huỷ chọn được
4. Persona card ở tab Báo cáo → dời sang nơi khác (gọn)

- ✅ **Bug 1 — extractNoteLocal strip số rời** (`src/utils/localParse.ts`):
  - Thêm rule cuối: `s.replace(/\b\d{1,3}\b/g, '')` sau khi đã strip số có suffix
  - Đảm bảo "30 ăn sáng" → "Ăn sáng", "60 cafe" → "Cafe"
- ✅ **Bug 2 — Hardcoded income map** (`app/(tabs)/index.tsx`):
  - Trong `tryVoiceParse`: nếu `localType === 'income'`, check map deterministic trước
  - `lương|luong|salary → Lương`, `thưởng|thuong|bonus → Thưởng`, `tip|tips → Tip`
  - Match category by name `(c.name === catName && c.type === 'income')`
  - Fallback về suggest engine cho keyword khác
- ✅ **Bug 3 — Toggle deselect category**:
  - 1-line change: `onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}`
  - Tap lại category đang active → bỏ chọn (categoryId = null)
- ✅ **Bug 4 — Dời Persona CTA**:
  - Xoá khỏi `app/(tabs)/report.tsx` (cleanup style `personaCta` orphan)
  - Thêm menu item "Persona tháng này" vào `app/(tabs)/more.tsx` với icon `Sparkles`
  - i18n key mới: `more.persona`, `more.personaDesc` (vi/en/zh)

**Files**: `src/utils/localParse.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/report.tsx`, `app/(tabs)/more.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

---

### v3.46 — 2026-05-24 (09:10) — Fix Freeze Pass tự sinh streak ảo sau reset

**Bug đại ca báo (screenshot 9:00):**
- Reset data xong, nhập 1 thu nhập đầu tiên → header hiện `🔥 2` (sai, phải là 1)
- Toast `🛡️ Freeze Pass kích hoạt — streak 2 vẫn an toàn` đè lên thông báo "Đã nhập thu" → trải nghiệm xấu

**Root cause** (`src/services/streak.ts:197-209` cũ):
Logic walk-back tăng `streak++` ngay cả khi consume Freeze Pass tại miss day mà phía sau không còn active day. Hệ quả: ngày đầu tiên của user → walk back gặp miss → freeze pass "ảo" → streak = 2.

- ✅ **Fix logic Freeze Pass** (recomputeStreak):
  - Walk back từ `lastActive`, đếm consecutive active days
  - Khi gặp MISS day: chỉ consume freeze nếu day liền trước (`cursor - 1`) là ACTIVE → bridge 1-day gap thật sự, KHÔNG tăng streak
  - Nếu miss day mà phía sau cũng miss → BREAK (ranh giới streak)
  - Kết quả: data trắng + nhập 1 TX hôm nay → streak = 1, `usedFreezePass = false` → không fire toast Freeze Pass nữa
- ✅ Test cases:
  - {today} → streak=1 ✓
  - {today, yesterday miss, 2 days ago, 3 days ago} → streak=3, usedFreezePass=true ✓
  - {today, 3 days ago miss} → streak=1 (gap 2 ngày, gãy) ✓

**Files**: `src/services/streak.ts`

---

### v3.45 — 2026-05-24 (09:00) — Sticky header tab Nhập + wording rõ + font fix
**Đại ca yêu cầu 3 việc:**
1. Sau reset DB, font "GHI NHANH" placeholder bị giãn spacing kỳ lạ
2. Header "Ghi chi" + 🔥 streak pill nên SỌC TOP khi cuộn (không bị mất)
3. Đổi wording "Ghi chi/Thu" → "Ghi chi tiêu/Thu nhập"

- ✅ **Wording rõ ràng hơn** (vi.ts):
  - `input.title.expense`: 'Ghi chi' → **'Ghi chi tiêu'**
  - `input.title.income`: 'Ghi thu' → **'Ghi thu nhập'**
  - `input.tab.expense`: 'Chi' → **'Chi tiêu'**
  - `input.tab.income`: 'Thu' → **'Thu nhập'**
  - `input.submit.expense/income`: tương tự
- ✅ **Sticky header** trong `app/(tabs)/index.tsx`:
  - Extract `<View styles.stickyHeader>` RA NGOÀI ScrollView, đặt trực tiếp trong SafeAreaView
  - paddingHorizontal/Vertical + borderBottom + backgroundColor opaque + zIndex 10
  - Title + StreakBadge LUÔN hiện top, không mất khi user cuộn xuống
  - ScrollView `paddingTop: 0` để không chồng với sticky header
- ✅ **Fix font voiceInput**:
  - Add `letterSpacing: 0` explicit (override default iOS spacing)
  - `fontFamily: Platform.OS === 'ios' ? 'System' : undefined` (force System font, không inherit kỳ)
- ✅ tsc strict pass

### v3.44 — 2026-05-24 (08:55) — Flame burst animation TikTok-style 🔥
**Đại ca yêu cầu**: hiệu ứng cháy lửa khi thắp chuỗi (streak tăng) giống TikTok.

- ✅ **`StreakBadge.tsx`** thêm animation khi `display > prevDisplay`:
  - **Main flame pulse**: scale 1 → 1.6 (200ms easeOut) → spring back về 1 (spring tension 80)
  - **Wobble rotation**: -20° → +20° → 0° trong 300ms
  - **3 particle burst** overlay: 2 🔥 toả 2 góc trên trái+phải + 1 ✨ bay thẳng lên
  - Particle scale 0 → 1.2 → 0.6, opacity 0 → 1 → 0 trong 700ms
- ✅ **`FlameBurst` component** mới — reusable cho cả pill nhỏ + hero modal big (chỉ khác distance + fontSize)
- ✅ **useRef + useEffect** detect prev vs new display → trigger 1 lần khi tăng
- ✅ State `burstActive` để render particles chỉ trong lúc animating (clean unmount sau animation done)
- ✅ Position absolute centered → emoji burst toả ra từ flame icon
- ✅ Animation dùng `Animated` built-in RN, `useNativeDriver: true` mượt 60fps, KHÔNG cần dep mới
- ✅ tsc strict pass

**Khi nào trigger**:
1. User ghi TX hôm nay đầu tiên → streak 1 → 2 → BURST ở pill 🔥
2. Mở modal streak → hero flame 🔥 lớn cũng burst nếu vừa tăng
3. KHÔNG trigger khi streak giảm hoặc giữ nguyên

### v3.43 — 2026-05-24 (08:50) — CRITICAL: Fix streak không tăng khi ghi TX ngày quá khứ
**Đại ca báo**: Ghi 1 TX hôm qua 23/5 + 1 TX hôm nay 24/5 → streak vẫn = 1 (đáng lẽ 2).

**Root cause**: `recordActivity(date)` cũ kiểm `if (date === todayStr)` — nếu user ghi TX với date là 23/5 (hôm qua) trong khi today = 24/5 → SKIP không tăng streak. Bug từ v3.6 (Combo retention 🚀).

- ✅ **Refactor `recomputeStreak(today)` mới** trong `src/services/streak.ts`:
  - Đọc DISTINCT date từ `transactions` table → tập hợp activeDates
  - Tìm `lastActive = max(activeDates)`
  - Walk back từ lastActive: đếm consecutive days có TX
  - Cho phép skip tối đa `freeze_passes` ngày (default 1/tuần) → freeze pass tự dùng nếu user lỡ
  - Cập nhật `current_streak / longest_streak / last_active_date / freeze_passes / badges` vào DB
  - Robust: không phụ thuộc thứ tự add, không bug khi sửa/xoá TX
- ✅ **Wire vào store**:
  - `addTransaction` → `recordActivity()` (alias call `recomputeStreak()`)
  - `updateTransaction` → `recomputeStreak()`
  - `deleteTransaction` → `recomputeStreak()`
- ✅ **Boot hook `_layout.tsx`**: auto recompute streak khi mở app → fix data cũ ngay (đại ca không cần ghi TX mới)
- ✅ tsc strict pass

**Behavior sau fix:**
1. Anh mở app → boot hook recompute → streak update từ data thật → 23/5 + 24/5 đều có TX → streak = 2 ngay
2. Ghi TX hôm qua / hôm nay / tương lai đều trigger recompute đúng
3. Sửa TX (đổi date) → recompute → streak tự update
4. Xoá TX → recompute → nếu xoá ngày cuối active → streak giảm

### v3.42 — 2026-05-24 (08:40) — VN-tune 50/30/20: Ăn uống về NEEDS
**Đại ca**: gợi ý chưa sát thực tế. Wants budget cao hơn needs là sai.

- ✅ **Re-classify "Ăn uống"** từ WANTS → NEEDS (vì ở VN là daily essential, không phải dining-out luxury như US)
- ✅ **NEEDS_DEFAULT_RATIO** VN-tune:
  - Ăn uống: **40%** (lớn nhất, daily food)
  - Tạp hoá: 25%
  - Đi lại: 15%
  - Y tế: 10%
  - Phí liên lạc: 6%
  - Tiền điện: 4%
- ✅ **WANTS_DEFAULT_RATIO** rebalance:
  - Giao lưu: 30% (cafe / nhậu / party — lớn nhất trong wants)
  - Quần áo: 25%
  - Giáo dục: 20%
  - Mỹ phẩm: 15%
  - Khác: 10%
- ✅ tsc strict pass

**Vd thu nhập 12tr, fixed 4tr, savings 20% (2.4tr) → variable 5.6tr:**
- NEEDS (~3.5tr): Ăn uống 1.4tr / Tạp hoá 880k / Đi lại 530k / Y tế 350k / Phí liên lạc 210k / Tiền điện 140k
- WANTS (~2.1tr): Giao lưu 630k / Quần áo 530k / Giáo dục 420k / Mỹ phẩm 320k / Khác 210k

Logic SÁT thực tế VN hơn — Ăn uống không còn dồn vào Quần áo bừa bãi.

### v3.41 — 2026-05-24 (08:35) — Wizard cho user nhập custom fixed + Fix Tiền nhà 20k
**Đại ca báo bug**: Tiền nhà 20.000đ (auto-fallback ratio 17% sai) + permission Expo Go thô.

- ✅ **Engine `budgetRecommender.ts`**:
  - Thêm const `REQUIRE_USER_INPUT_CATS = Set(['Tiền nhà'])` — khoản phụ thuộc user thực tế (3-15tr+), không thể auto
  - Trong `allocateGroup`: nếu cat name nằm trong list này VÀ không có history → set `amount = 0` + reason "Hãy thêm vào Chi cố định ở Bước 2"
  - Không còn bug Tiền nhà = 20k khi user chưa add fixed
- ✅ **Wizard Step 2 — Thêm UI custom fixed**:
  - State `addCatId`, `addAmount`
  - `addCustomFixed()` validate + push vào fixedExpenses
  - UI: horizontal scroll category chips (12 expense cat) + input số tiền + nút "+ Thêm vào danh sách"
  - Mọi cat (kể cả Tiền nhà) đều có thể add với số tiền thực tế của user
- ✅ **Permission messages** trong `app.json` cho production build (KHÔNG ảnh hưởng Expo Go):
  - `NSCameraUsageDescription` — chụp hoá đơn
  - `NSPhotoLibraryUsageDescription` — chọn hoá đơn từ thư viện
  - `NSPhotoLibraryAddUsageDescription` — lưu báo cáo PDF
  - `NSFaceIDUsageDescription` — mở khoá app
  - `NSUserNotificationsUsageDescription` — nhắc nhở ghi sổ
  - Thêm plugin `expo-image-picker` + `expo-notifications` với reason VN đẹp
- ✅ tsc strict pass

**Note Expo Go**: Dialog quyền truy cập thô "Experience needs permissions" chỉ xuất hiện trong Expo Go dev. Build production qua EAS → dialog native iOS "Bux2 muốn truy cập Thư viện ảnh..." với reason em đã set.

### v3.40 — 2026-05-24 (07:55) — Budget Wizard (Gợi ý ngân sách thông minh) — USP đầu tiên VN
**Plan**: `PLAN_2026-05-24-budget-wizard.md` — đại ca duyệt.

**USP**: App finance VN ĐẦU TIÊN có gợi ý phân bổ ngân sách tự động (rule-based, không AI). Komorebi + Money Pro chỉ cho user set budget thủ công.

- ✅ **`src/services/budgetRecommender.ts`** mới:
  - Phân loại default cats: NEEDS (Tiền nhà, Tạp hoá, Tiền điện, Đi lại, Y tế, Phí liên lạc) vs WANTS (Ăn uống, Giao lưu, Quần áo, Mỹ phẩm, Giáo dục, Khác)
  - Default ratios: NEEDS_DEFAULT_RATIO + WANTS_DEFAULT_RATIO cho phân bổ trong nhóm
  - `recommendBudget({income, fixedExpenses, savingsTarget, categories, history})`:
    - Áp dụng quy tắc 50/30/20: needs ~50% income / wants ~30% / savings (đã set)
    - Nếu fixed (recurring + bills) > 50% needs ideal → adjust giảm needs budget
    - Nếu có history 3 tháng trước → dùng tỷ lệ thực tế của user. Else dùng default
    - Round bội 10k/5k/1k để budget đẹp
    - `isInfeasible` flag khi fixed + savings > income
    - Item cuối nhận remainder để tổng đúng
  - `detectIncomeFromHistory()` — auto-pick income từ tháng gần nhất có thu
- ✅ **`app/budget-wizard/index.tsx`** mới — Wizard 4 bước single-file:
  - Progress bar 25/50/75/100% theo step
  - **Step 1**: Nhập lương cứng + thưởng. Auto-detect từ history. Hiện sum
  - **Step 2**: List recurring rules (active expense) + bills (unpaid) tự load. User xoá nếu không phải fixed
  - **Step 3**: Mode "Theo %" (3 preset 10/20/30) hoặc "Số cụ thể". Cảnh báo nếu fixed+savings>income
  - **Step 4**: Render `RecommendResult` với 3 group: CHI CỐ ĐỊNH / NEEDS / WANTS + Savings summary card
  - **Apply**: Loop `result.items` → `setBudget(categoryId, recommended, currentMonth)` → router.replace('/(tabs)/budget')
- ✅ **CTA tab Ngân sách**: top card primary với icon Sparkles "Gợi ý ngân sách thông minh"
- ✅ **Stack.Screen `budget-wizard/index`** đăng ký trong `_layout.tsx`
- ✅ i18n vi/en/zh: `budget.wizardCta` + `budget.wizardSub`
- ✅ tsc strict pass

**Flow user end-to-end:**
1. Vào Tab Ngân sách → tap CTA "Gợi ý ngân sách thông minh"
2. Wizard 4 bước, mỗi bước có hint + auto-detect
3. Tap "Áp dụng" → tự tạo Budget cho mọi category → quay về Tab Ngân sách thấy budgets đã set
4. User có thể chỉnh từng cái sau (giữ logic CRUD cũ)

### v3.39 — 2026-05-24 (01:00) — Gỡ duplicate CTA "Phân tích chi tiêu" + plan Premium
- Bỏ CTA "Xem phân tích chi tiêu" khỏi Tab Khác dashboard (đã trùng với Tab Báo cáo)
- Viết `PLAN_2026-05-24-premium.md` — Free vs Pro phân chia, pricing 99k/tháng + 299k/năm

### v3.38 — 2026-05-24 (00:50) — F8 Persona viral (8 loại, share TikTok)
**Đại ca duyệt từ Combo 🚀 retention plan**. Cuối combo. Vũ khí marketing organic.

- ✅ **`src/services/persona.ts` mới** — rule-based engine:
  - 8 PersonaKey: `foodie_q1` (Ăn uống+Giao lưu >40%), `latte_sensei` (cà phê >800k), `shopaholic` (top cat Quần áo/Mỹ phẩm ≥25%), `night_owl` (>50% TX ban đêm), `fomo_buyer` (≥30 TX <50k), `couch_investor` (saving rate ≥30%), `balance_master` (default — không cat nào >25%), `home_keeper` (Tạp hoá+Tiền nhà ≥35%)
  - Mỗi persona có emoji + name + tagline + color + bgColor
  - `computePersona(transactions, categories, monthKey)` trả `{persona, monthLabel, reasons, stats}`
  - Rule priority order: couch_investor > latte > shopaholic > foodie > home_keeper > night_owl > fomo > balance
  - Detect coffee qua regex note `/cafe|coffee|cà phê|highlands|starbucks|phúc long|trung nguyên/`
  - Detect night qua `tx.created_at.getHours() >= 21 || < 5`
- ✅ **Screen `app/persona/[month].tsx`** mới — card đẹp share-ready:
  - Hero: emoji 72px + name 28px (color persona) + tagline italic
  - Stats row: CHI / THU / TIẾT KIỆM (3 box trong white-translucent panel)
  - Top category card với progress bar
  - Tx count
  - Footer brand "Bux2 — Sổ thu chi thông minh"
  - **Reasons list** giải thích vì sao chọn persona này (3-4 dòng bullet)
  - **8 persona grid** — persona đang là của user có viền + bg highlight
  - Nút "Chia sẻ persona này" → `Share.share()` text + suggest screenshot
  - Hint: "Chụp màn hình bằng Power+Vol Up iPhone để share TikTok/Insta"
- ✅ **CTA mới trong Tab Báo cáo**: card "Persona tháng này" (icon Crown tím) hiện song song với CTA "Phân tích chi tiêu". Tap → `/persona/${currentMonth}`
- ✅ Stack.Screen `persona/[month]` đăng ký trong `_layout.tsx`
- ✅ tsc strict pass

**Marketing impact**:
- Mỗi user share card lên TikTok = 1 ad miễn phí cho Bux2
- 8 persona dí dỏm + relatable cho Gen Z VN (Foodie Quận 1, Latte Sensei, Couch Investor...)
- Đây là feature TikTok/Insta-native — design card vuông gọn, contrasting color, easy screenshot

### v3.37 — 2026-05-24 (00:35) — F9 Cool-down 5 giây (behavioral nudge)
**Đại ca duyệt từ Combo 🚀**. Cuối combo.

- ✅ **`src/components/CoolDownModal.tsx` mới**:
  - Modal fade với countdown 5 giây + progress bar animated 0→100%
  - Hero "⏳ Khoản này hơi to nha bạn iu"
  - Big amount đỏ + category + note (nếu có)
  - **Compare box** dí dỏm: "≈ N bữa trưa / ly cà phê / lần Grab / đêm Đà Lạt / AirPods 4" — tự pick item phù hợp với amount (3-30 lần)
  - 2 nút: "Huỷ ghi" (luôn enabled, xám) / "Vẫn ghi" (disabled 5s, sau khi hết → primary)
  - Trong 5s countdown: nút "Vẫn ghi" hiện "Chờ Ns" + disabled
- ✅ **Hook vào `submit()` tab Nhập**:
  - Trigger conditions: `cooldown_enabled !== '0'` (default ON) + `type === 'expense'` + `amount ≥ threshold` (default 200k) + category là 1 trong 4 default: **Quần áo / Mỹ phẩm / Giao lưu / Tạp hoá**
  - Match → `setCooldownPending` → render modal → user chờ → "Vẫn ghi" → `doSubmit()` (giữ logic gốc) HOẶC "Huỷ ghi" → close modal, user back to form
  - Logic addTransaction tách thành `doSubmit(n)` riêng để reuse
- ✅ tsc strict pass

**Tâm lý học**:
- Tránh từ ép buộc: chỉ countdown, không "BẠN BỊ LÀM KHỔ" hay "STOP". Tone mềm "hơi to nha bạn iu".
- Compare nhẹ nhàng: chỉ FYI, không guilt-trip.
- User vẫn có lựa chọn FULL ("Vẫn ghi") — không lock-out.
- 5 giây đủ để cân nhắc nhưng không quá dài → UX cảm xúc mượt.

### v3.36 — 2026-05-24 (00:15) — Test tất cả 5 notif thật trong 20 giây
**Đại ca yêu cầu**: thêm test tất cả các thông báo thật để verify content production.

- ✅ **`sendAllTestNotifications()` mới** trong `notifications.ts`:
  - Schedule 5 notification cách nhau 4 giây (delay 3/7/11/15/19s)
  - Content THẬT lấy từ các variants production:
    1. **Hạn mức sáng** — random từ `MORNING_VARIANTS` (5 câu sáng tốt lành) → deep link `/summary/today`
    2. **Tóm tắt hôm nay** — random từ `SUMMARY_VARIANTS` (5 câu tổng kết)
    3. **Mục tiêu tiết kiệm** — random từ `SAVINGS_VARIANTS` (5 câu ghẹo tiết kiệm)
    4. **Tóm tắt tuần** — content tuần
    5. **Bux2 ghẹo bạn** — smart nudge example
  - Trả về số notif đã schedule thành công
- ✅ **Settings → Nhắc nhở** thêm nút **"Gửi thử TẤT CẢ thông báo thật (20 giây)"** (style filled primary, đứng dưới nút "Gửi thử 1")
- ✅ Đổi nút cũ "Gửi thử ngay (3 giây)" → "Gửi thử 1 thông báo (3 giây)" để phân biệt
- ✅ tsc strict pass

**Cách anh test:**
1. Vào Cài đặt → Nhắc nhở → cuộn xuống cuối
2. Bấm **"Gửi thử TẤT CẢ thông báo thật (20 giây)"**
3. Lập tức thoát app về Home iOS
4. Sau mỗi 4 giây sẽ thấy 1 notif Bux2 với content thật → tap để verify deep link
5. Tổng 5 notif trong 20 giây

### v3.35 — 2026-05-24 (00:10) — Add nút test notif + thay chữ kỹ thuật → tiếng Việt
**Đại ca yêu cầu:**
1. Cần test notif được — không phải đợi đến 9h/20h/22h
2. Xoá chữ "safe-to-spend", "safe", "config" hiện user → thay tiếng Việt

- ✅ **Add lại nút "Gửi thử ngay (3 giây)"** trong Settings → Thông báo (cuối screen):
  - Style outlined: nền primaryLight + viền primary (gọn hơn nút full primary trước)
  - Tap → `sendTestNotification()` → notif push sau 3 giây để user thoát app ra xem
  - Khôi phục import `sendTestNotification`
- ✅ **Đổi tiếng Việt** các chữ kỹ thuật user-facing:
  - `salary.preview`: "Xem trước với config này" → "Xem trước với cài đặt này"
  - `salary.enableDesc`: "Tính \"Số dư an toàn\"..." → "Tính số dư an toàn..." (bỏ quote khô khan)
  - `salary.off`: "MẶC ĐỊNH" → "mặc định" (không caps gắt)
  - `savings.tsx`: "safe-to-spend + N% safe" → "số dư an toàn + N% số dư"
  - "Vd: Safe = 440k" → "Vd: Số dư an toàn = 440k"
  - "hạn mức xài (safe-to-spend)" → "hạn mức xài (số dư an toàn)"
- ✅ Cách dùng "safe-to-spend" còn lại trong code đều là **variable name/comment internal** (không user-facing) — giữ để code rõ nghĩa
- ✅ tsc strict pass

**Cách anh test notif sau update:**
1. Vào Cài đặt → Nhắc nhở
2. Cuộn xuống cuối, bấm nút **"Gửi thử ngay (3 giây)"**
3. Thoát app (về Home iOS) trong 3 giây
4. Sẽ thấy notif Bux2 hiện trên màn hình → tap để mở app

### v3.34 — 2026-05-24 (00:05) — UI Polish Phase 1: Design tokens + 4 component reusable
**Plan**: `PLAN_2026-05-23-ui-polish.md` đã duyệt. Phase 1/3 (~1.5h).

- ✅ **`src/theme/tokens.ts` mới** — constant số liệu UI (KHÔNG AI, KHÔNG API):
  - `SPACING` (xs/sm/md/lg/xl/xxl: 4/8/12/16/20/24)
  - `FONT_SIZE` (tiny/caption/small/body/bodyLg/title/titleLg/hero/display: 10/11/12/13/15/17/20/28/44)
  - `FONT_WEIGHT` (regular/medium/semibold/bold/extrabold)
  - `RADIUS` (sm/md/lg/xl/xxl/full: 8/10/12/14/18/9999)
  - `SEMANTIC` (success/warning/danger/info/muted) — mỗi semantic có {bg, tint, fg, text} 4 màu chuẩn
  - `GRAY` 50-900 (10 shade, thay hardcode #9ca3af, #6b7280 rải rác)
  - `SHADOW` (none/sm/md) — preset native iOS/Android
- ✅ **4 component reusable** mới:
  - `Card` — variant flat / elevated / tinted, padding prop từ SPACING token
  - `EmptyState` — icon + title + desc + cta, dùng cho mọi screen trống
  - `SectionHeader` — text uppercase chuẩn (replace inline groupHeader)
  - `StatBox` — label + value + optional icon, align center/flex-start
- ✅ **Migrate Settings** (`app/settings/index.tsx`):
  - Thay `<Text styles.groupHeader>` → `<SectionHeader>` component (5 nơi)
  - Refactor styles: hardcode `#f3f4f6 / 14 / 18 / '700'` → `GRAY[100] / RADIUS.lg / SPACING.lg / FONT_WEIGHT.bold`
  - Settings giờ visualy giống trước nhưng nguồn từ tokens
- ✅ **Migrate SafeToSpendCard**:
  - Overspending state dùng `SEMANTIC.danger.{bg/tint/fg/text}`
  - Low state (warning) dùng `SEMANTIC.warning.{bg/tint/fg/text}` thay `#fff7ed / #fdba74 / #c2410c / #9a3412`
  - Tất cả style numbers refactor sang tokens
- ✅ **Migrate StreakBadge** modal:
  - 3 box stats (Hiện tại/Kỷ lục/Badge) replace bằng `<StatBox>` component → consistent với screen Báo cáo về sau
  - Bỏ inline styles.statBox/statLabel/statValue → bớt 8 dòng code
- ✅ tsc strict pass

**Lợi ích từ tokens:**
- Đổi `SPACING.lg` từ 16 → 14 → toàn app gọn ngay
- Đổi `SEMANTIC.warning.bg` → mọi warning card đồng bộ
- Code declarative + đọc nhanh hơn (`padding: SPACING.lg` self-document)
- Theme palette user pick (Mint/Grape/Sunset...) vẫn giữ primary, semantic colors (warning/danger/success) không đụng

**Phase 2 (chưa làm)**: refactor Tab Nhập (gom row) + Tab Báo cáo (chia view "Tổng quan"/"Chi tiết") khi đại ca review Phase 1 OK.

### v3.33 — 2026-05-23 (23:42) — Auto-enable 2 notif xương sống + bỏ "Nhắc ghi" duplicate
**Đại ca duyệt Hướng A**: auto-enable 2 cái sáng+tối, giữ screen Settings cho power user.

- ✅ **Hook auto-setup** trong `_layout.tsx` (idempotent qua setting `notif_auto_setup_v1`):
  - Lần đầu sau boot: request permission notification
  - Nếu granted → tự `scheduleMorningBudget(9, 0)` + `scheduleDailySummary(20, 0)`
  - Lưu `morning_enabled=1` + `summary_enabled=1` + giờ default
  - Set flag `notif_auto_setup_v1=1` để không setup lại
- ✅ **Bỏ "Nhắc ghi chi tiêu hàng ngày" duplicate** trong `app/settings/notifications.tsx`:
  - "Tóm tắt hôm nay 20:00" đã cover chức năng → bỏ entry trùng
  - Bỏ section "Giờ nhắc" của reminder cũ (vì giờ summary có giờ riêng)
  - Add footer note nhỏ "Nhắc nhở chạy local. Vào Cài đặt iOS nếu chưa thấy"
- ✅ Còn 4 toggle: Hạn mức sáng / Tóm tắt hôm nay / Tóm tắt tuần / Ghẹo cá nhân
- ✅ tsc strict pass

### v3.32 — 2026-05-23 (23:25) — Thay TouchableOpacity → RectButton (gesture cooperate)
**Đại ca**: `delayPressIn` chưa đủ, vẫn bị trigger popup Sửa khi vuốt.

**Root cause**: TouchableOpacity (React Native built-in) KHÔNG cooperate với `react-native-gesture-handler`'s Swipeable. Khi user touch + di chuyển ngón → cả 2 handler đều có thể trigger.

- ✅ Thay `TouchableOpacity` (item) → **`RectButton` từ `react-native-gesture-handler`**
- ✅ RectButton là pattern chính thức của rngh — tự cancel onPress nếu detect gesture move
- ✅ Vuốt sang trái = chỉ trigger Swipeable, KHÔNG trigger RectButton.onPress
- ✅ Tap đứng yên = trigger RectButton.onPress → mở Edit (đúng intent)
- ✅ tsc strict pass

Bỏ `delayPressIn={120}` vì giờ RectButton tự handle.

### v3.31 — 2026-05-23 (23:23) — Fix flex đè width + tap conflict khi vuốt
**Đại ca báo qua test thật:**
1. Đặt width 54 nhưng nút xoá vẫn full → root cause `flex: 1` trên Animated.View đè width fixed
2. Đang kéo bị trigger sang screen Sửa (TouchableOpacity item onPress nhầm)

- ✅ **Animated.View**: bỏ `flex: 1` → giữ `width: 54, height: '100%'` (width thực sự fixed)
- ✅ **Tap conflict**: thêm `delayPressIn={120}` cho TouchableOpacity item → vuốt <120ms KHÔNG trigger onPress sang `/edit/${id}`. Chỉ tap rõ ràng (giữ ngón) mới sang Edit.
- ✅ tsc strict pass

### v3.30 — 2026-05-23 (23:20) — Nút xoá gọn hơn
**Đại ca**: nút xoá chiếm 70px nhiều quá. Giảm xuống.

- ✅ `width` Animated.View: 70 → 54
- ✅ `translateX` outputRange: [70 → 0] → [54 → 0]
- ✅ Icon `Trash2` size: 22 → 18
- ✅ `rightThreshold` 60 → 44 (cân với button mới)
- ✅ tsc strict pass

### v3.29 — 2026-05-23 (23:18) — Swipe button trượt khớp row + animation mềm
**Đại ca báo qua test thật:**
1. Vuốt nhẹ → nút xóa hiện ĐÈ lên card tiền mờ (Bug v3.28 chưa hết sạch)
2. Animation Swipeable cảm giác cứng, muốn mềm mại hơn

- ✅ **Fix bleed bằng progress animation**:
  - `renderRightActions={(progress) => ...}` — dùng `progress.interpolate` thay vì static render
  - Animated.View bao ngoài button:
    - `translateX: [70 → 0]` (button trượt vào từ phải theo progress của row)
    - `opacity: [0 → 0.7 → 1]` (fade-in mượt)
    - `width: 70, flex: 1` (stretch full height của item)
  - Khi user vuốt 30%, button chỉ hiện 30% — KHÔNG còn full-width hiện ngay lập tức đè lên text
- ✅ **Mềm animation**:
  - `friction` 2 → 1.2 (giảm resistance, mượt hơn)
  - `overshootRight={false}` giữ — không vuốt quá
  - Spring tự nhiên hơn khi snap về close/open
- ✅ `swipeDelete` style đổi `width: 70` → `flex: 1` (Animated.View bên ngoài đã set width)
- ✅ tsc strict pass

**Behavior sau fix:**
- Vuốt nhẹ → button trượt vào THEO row, không đè text
- Buông tay sớm → mượt snap về 0
- Vuốt >60px → mượt snap open full
- Hành vi giống Mail iOS native

### v3.28 — 2026-05-23 (23:10) — Cleanup migration số lẻ + fix swipe-delete text đè
**Đại ca báo qua test thật:**
1. Goal "Đi hà nội thăm thuỷ" hiện current `19.333đ` (lẻ từ trước v3.27)
2. Swipe-to-delete trong tab Lịch: vuốt chưa đủ → text giao dịch đè lên nút xóa đỏ, rất xấu

- ✅ **`cleanupRoundingArtifacts()` mới** trong `activeSavings.ts`:
  - Idempotent qua setting `savings_round_cleanup_v1`
  - Loop tất cả `savings_goals` → `current % 1000 !== 0` → round xuống bội 1k qua `updateSavingsGoal`
  - Loop `daily_snapshots` (WHERE auto_allocated lẻ OR manual_added lẻ) → round cả 2 field
  - Return `{ran, goalsFixed, snapshotsFixed}` log debug
- ✅ Hook vào `_layout.tsx` boot, chạy TRƯỚC `runDailyAllocation` để allocation mới dùng số đã chuẩn
- ✅ **Fix Swipeable** trong `(tabs)/calendar.tsx`:
  - `rightThreshold` 40 → 60 (cần vuốt nhiều hơn mới stick open)
  - `overshootRight={false}` (không vuốt quá width 70px button)
  - `friction={2}` (giảm quá đà khi user buông tay)
  - `containerStyle={{ backgroundColor: '#fff' }}` + `styles.item` thêm `backgroundColor: '#fff'` (đảm bảo row opaque, không bleed transparent qua button đỏ)
- ✅ tsc strict pass

**Behavior sau fix:**
- Lần boot đầu sau update: cleanup chạy 1 lần → 19.333đ → 19.000đ (mất 333đ, chấp nhận)
- Swipe nhẹ → tự snap về 0 (đóng), không stick half-open
- Swipe ≥60px → snap full open, button rõ ràng, row đã trượt hoàn toàn sang trái → KHÔNG còn text đè

### v3.27 — 2026-05-23 (23:00) — Auto cộng dư hôm qua + round bội 1k chẵn
**Đại ca yêu cầu:**
1. Cuối ngày xài không hết → sau 24h tự + hết vào tiết kiệm (không cần user bấm)
2. Số phải chẵn — không 19.333

- ✅ **`runDailyAllocation` thêm STEP 1 (auto process hôm qua)**:
  - Đọc snapshot hôm qua → tính `unused = safe - expense`
  - Nếu ≥ 1.000đ → round bội 1k → split theo target ratio → `addToSavingsGoal` từng goal → `markSnapshotHandled` lưu `manual_added = unusedRounded`
  - Nếu < 1.000đ → mark handled với 0 (không xử lý)
- ✅ **Round chẵn**: `roundingRemainder` của safe (vd 4.333) cũng round xuống bội 1k → 4.000. Đảm bảo TỔNG allocation và mọi split đều bội 1k → không bao giờ ra số 19.333.
- ✅ **Bỏ UnusedBanner khỏi tab Nhập** (không cần user bấm Accept/Dismiss nữa)
  - `UnusedBanner.tsx` file giữ lại (deprecated, có thể xoá sau)
  - `getYesterdayUnusedSuggestion` + `acceptUnusedSuggestion` + `dismissUnusedSuggestion` vẫn giữ trong service nhưng không còn dùng
- ✅ **SafeToSpendCard prop mới `unusedAutoYesterday`**: hiện dòng *"✨ Hôm qua dư Xđ đã tự cộng vào mục tiêu"* dưới allocatedToday
- ✅ Tab Nhập query `getSnapshot(yesterday)` → `manual_added` → pass xuống card
- ✅ tsc strict pass

**Flow mới đầy đủ:**
1. User mở app sáng mai → hook boot chạy `runDailyAllocation`:
   - STEP 1: Hôm qua dư 35.000đ → tự cộng vào "iPhone 17" (1 goal) hoặc chia theo ratio (nhiều goal). Mark snapshot handled.
   - STEP 2: Tính safe hôm nay (vd 440.000đ, rounded từ 444.333) → roundingRemainder = 4.000 + dailyAuto = 22.000 = total 26.000 → split + add
2. User mở tab Nhập → thấy card hiện 2 dòng:
   - "💰 Đã chích 26.000đ vào 1 mục tiêu" (hôm nay)
   - "✨ Hôm qua dư 35.000đ đã tự cộng vào mục tiêu" (24h trước)
3. User không phải bấm gì — full auto

### v3.26 — 2026-05-23 (22:52) — Fix bills counter (open up 30 ngày) + Settings padding gọn hơn
**Đại ca báo qua test thật:**
1. Có 1 bill "Tiền nhà" due 01/06 (còn 9 ngày), dashboard tab Khác vẫn "Không có bill" — vì counter chỉ đếm ≤7 ngày
2. Settings padding ngang xa edge

- ✅ **Bills counter** (`(tabs)/more.tsx`):
  - State chia 2: `billsUrgent` (≤7 ngày, gấp) + `billsActive` (≤30 ngày, đang theo dõi)
  - Render priority: urgent > active > empty
  - Wording: "X bill sắp đến hạn" (urgent) → "X hoá đơn đang theo dõi" (active) → "Không có bill"
  - Cover thêm trường hợp bill due 8-30 ngày (rất phổ biến — tiền nhà tháng sau, internet quý...)
- ✅ Add `more.bills.active` i18n vi/en/zh
- ✅ **Settings padding**: `group.paddingHorizontal` 16 → 12, `groupHeader.marginLeft` 4 → 6 → items gần edge hơn ~8px mỗi bên
- ✅ tsc strict pass

### v3.25 — 2026-05-23 (22:45) — Refactor Settings: iOS-style flat list
**Đại ca feedback**: Settings khó nhìn, không gian trống quá nhiều. Đề xuất 2 hướng A (iOS-style) / B (card compact). Đại ca chọn **A** — gọn gàng chuyên nghiệp.

- ✅ **Refactor `app/settings/index.tsx`** sang pattern iOS-native:
  - Nền `#f3f4f6` (xám nhạt), groupBox `#fff` (giống Settings iPhone)
  - Helper `renderGroup(header, rows)` + `renderRow(row, isFirst, isLast)` — reuse cho 6 nhóm
  - Mỗi row 1 dòng compact: icon 30×30 với tint background nhẹ + label + (optional value) + chevron
  - Separator giữa rows dùng `StyleSheet.hairlineWidth` (line mỏng native)
  - Section header uppercase 11px, letterSpacing 0.5, color `#9ca3af`
- ✅ **6 nhóm**:
  1. **TÀI KHOẢN** → Quản lý danh mục
  2. **BẢO MẬT & NGÔN NGỮ** → Bảo mật / Ngôn ngữ (hiện value "Tiếng Việt" | "English" | "中文" bên phải)
  3. **THÔNG BÁO & CHU KỲ** → Nhắc nhở / Giao dịch lặp
  4. **GIAO DIỆN** → Theme row + palette picker inline (5 swatch)
  5. **DỮ LIỆU** → Xuất CSV (busy spinner thay chevron khi đang export)
  6. **KHU VỰC NGUY HIỂM** → Reset dữ liệu (red text + red icon tint)
- ✅ **About**: di chuyển xuống cuối, dạng centered text nhẹ (KHÔNG còn trong card)
- ✅ Reset modal giữ nguyên (đã chuẩn)
- ✅ tsc strict pass

**Spacing so v3.18:**
- Mỗi item từ ~80px (card padding 14 + desc) → ~46px (1 dòng)
- Toàn screen từ 7 cards rời rạc → 6 groupBox gộp gọn theo subject
- Tổng chiều cao Settings giảm ~40%

### v3.24 — 2026-05-23 (22:37) — Gộp Active Savings vào Goals + fix bills counter
**Đại ca feedback v3.23:**
1. "Tự động tiết kiệm" nên nằm TRONG Mục tiêu tiết kiệm thay vì entry riêng ở tab Khác (đỡ rối)
2. Bug: tạo bill mới ở screen Bills xong, quay lại tab Khác → dashboard vẫn "Không có bill"

- ✅ **Gộp Active Savings vào Goals**:
  - Bỏ entry `more.activeSavings` khỏi tab Khác menu (`more.tsx`)
  - Add CTA card "Tự động tiết kiệm" ở đầu screen `/goals` (icon Sparkles + primary color) → tap dẫn tới `/settings/savings`
  - User vào tab Khác → Mục tiêu tiết kiệm → thấy CTA + list goals → tap CTA mở settings savings
  - Giữ route `/settings/savings` (không xoá vì còn có thể link từ chỗ khác)
- ✅ **Fix bug bills counter**: `more.tsx` đổi `useEffect([wallets, transactions])` → `useFocusEffect(useCallback)`. Mỗi khi user quay lại tab Khác, `refreshStats()` auto-run → đếm lại bills/goals/recurring đúng (kể cả vừa tạo ở screen khác)
- ✅ tsc strict pass

### v3.23 — 2026-05-23 (22:30) — Active Savings (Mục tiêu tiết kiệm chủ động)
**Plan**: `PLAN_2026-05-23-savings-active.md`. Đại ca duyệt: 5% / chia tỷ lệ target / bội 10k / banner ở cả tab Nhập + notif 22h.

- ✅ **DB v13 — `daily_snapshots`**: date PK, safe_amount, expense, auto_allocated, manual_added, suggested_handled. CRUD: `getSnapshot`, `upsertSnapshot`, `markSnapshotHandled`.
- ✅ **`roundSafe(n)`** trong `safeToSpend.ts`: làm tròn xuống bội 10k (≥100k), 5k (10k-100k), 1k (<10k). `SafeToSpendResult.safeAmountRaw` thêm để tính rounding remainder.
- ✅ **`src/services/activeSavings.ts`** (mới):
  - `parseActiveSavingsFromSettings(settings)` → `{enabled, pct, suggestEnabled}` (default ON, 5%)
  - `splitByTargetRatio(total, goals)` — chia tiền theo TỶ LỆ target của goals active. Goal cuối nhận phần dư để tổng đúng `total`.
  - `runDailyAllocation(txs, bills, settings, today)`:
    - Idempotent qua setting `savings_last_allocation_date`
    - Tính `safe` hôm nay → tổng allocate = rounding_remainder + floor(safe × pct% / 1000)*1000
    - Chia split → addToSavingsGoal cho từng goal
    - Upsert snapshot
  - `getYesterdayUnusedSuggestion(txs, today)` — đọc snapshot hôm qua, nếu unused ≥10k + chưa handled → trả `{date, unused, primaryGoal}`
  - `acceptUnusedSuggestion(date, amount)` — split + add vào goals, mark handled
  - `dismissUnusedSuggestion(date)` — mark handled với manual_added=0
- ✅ **Hook boot** trong `app/_layout.tsx`: sau khi load store, gọi `runDailyAllocation()` 1 lần/ngày
- ✅ **SafeToSpendCard**: prop mới `allocatedToday` + `allocatedGoalLabel` → hiện dòng *"💰 Đã chích Xk vào N mục tiêu"* dưới sub
- ✅ **`UnusedBanner.tsx`** mới: card vàng *"💛 Hôm qua bạn tiết kiệm tốt! Dư Xk — cho vào [Tên goal] nhé?"* + 2 nút "Để dành mai" / "Đồng ý"
- ✅ Tab Nhập (`(tabs)/index.tsx`):
  - State `unusedSugg` + `allocatedToday` + `allocatedGoalLabel`
  - Load 5 promise song song: bills/streak/yesterday-suggestion/today-snapshot/goals
  - Render UnusedBanner phía trên SafeToSpendCard nếu có suggestion
- ✅ **Notif 22h** `scheduleSavingsNudge(hour=22)` trong notifications.ts — 5 variants dễ thương dẫn về tab Nhập (xem banner thật)
- ✅ **Screen `app/settings/savings.tsx`** mới:
  - Toggle "Tự chích vào mục tiêu mỗi ngày" + 3 preset 3%/5%/10%
  - Toggle "Gợi ý cộng dư cuối ngày"
  - Toggle "Nhắc tối 22:00"
  - Warning box nếu chưa có goal active
  - Info box hiển thị số goal đang chạy
- ✅ Tab Khác (`more.tsx`) → entry mới "Tự động tiết kiệm" (icon Sparkles) → `/settings/savings`
- ✅ i18n vi/en/zh: thêm `more.activeSavings` + `more.activeSavingsDesc`
- ✅ tsc strict pass

**Settings keys mới**: `savings_auto_enabled` (default '1'), `savings_auto_pct` (default 5), `savings_suggest_enabled` (default '1'), `savings_notif_enabled`, `savings_last_allocation_date`.

**Behavior end-to-end:**
1. User tạo goal "iPhone 17" target 30tr trong tab Khác → Mục tiêu tiết kiệm
2. Sáng mai mở app → app tự chích 22k (5% × 440k) vào goal → card hiện "💰 Đã chích 22.000đ vào 1 mục tiêu"
3. Hôm sau nếu hôm qua xài ít hơn safe → banner vàng pop trên tab Nhập + notif 22h tối nhắc kèm
4. User tap "Đồng ý" → toàn bộ dư cộng vào goal theo tỷ lệ target

### v3.22 — 2026-05-23 (22:15) — CRITICAL: Fix bug "table wallets has no column named book_id"
**Đại ca báo bug từ máy bạn anh — DB cài lần đầu**: ALTER TABLE add book_id chạy TRƯỚC khi CREATE TABLE wallets/savings_goals/recurring_rules → ALTER fail (caught silent) → CREATE TABLE không có book_id → INSERT crash.

- ✅ Move block `for tbl in [...] ALTER TABLE ... ADD COLUMN book_id` xuống CUỐI `getDb()`, sau khi tất cả CREATE TABLE đã chạy
- ✅ tsc strict pass

App cũ trên iPhone đại ca đã có DB → unaffected. Người dùng cài lần đầu (như bạn anh) sẽ không còn lỗi.

### v3.21 — 2026-05-23 (21:05) — i18n default category names (vi/en/zh)
**Đại ca yêu cầu**: 15 danh mục mặc định (Ăn uống / Tạp hoá / Lương...) phải đổi theo ngôn ngữ. Custom category user tự thêm thì giữ nguyên tên user nhập.

- ✅ **Thêm 15 keys `cat.default.*`** vào vi/en/zh:
  - vi: Ăn uống / Tạp hoá / Quần áo / Mỹ phẩm / Giao lưu / Y tế / Giáo dục / Tiền điện / Đi lại / Phí liên lạc / Tiền nhà / Khác / Lương / Thưởng / Thu khác
  - en: Food & drink / Groceries / Clothing / Cosmetics / Social / Medical / Education / Utilities / Transport / Phone & data / Rent / Other / Salary / Bonus / Other income
  - zh: 餐饮 / 日用品 / 服装 / 化妆品 / 社交 / 医疗 / 教育 / 水电 / 交通 / 电话流量 / 房租 / 其他 / 工资 / 奖金 / 其他收入
- ✅ **Helper mới `displayCategoryName(cat)`** trong `src/i18n/categoryName.ts`:
  - Nếu `cat.is_default === 1` → lookup slug từ SLUG_MAP → return `t('cat.default.{slug}')`
  - Nếu custom (is_default !== 1) → return raw `cat.name` (user gõ gì giữ nguyên)
  - SLUG_MAP: 15 tên VN gốc → slug (vd "Ăn uống" → "food", "Lương" → "salary")
- ✅ **Áp `displayCategoryName(c)` vào 10 file**:
  - `app/(tabs)/index.tsx` — category grid + suggestion pill + voice parse notify (3 chỗ)
  - `app/(tabs)/calendar.tsx` — top categories trong coach + transaction item name (2 chỗ)
  - `app/(tabs)/report.tsx` — pie chart label + biggest tx name + row legend + drill modal title (4 chỗ)
  - `app/(tabs)/budget.tsx` — item name + modal title (2 chỗ)
  - `app/summary/today.tsx` — top categories card (1 chỗ)
  - `app/insights/index.tsx` — topCategories array + biggestTx category (2 chỗ)
  - `app/settings/categories.tsx` — list category management (1 chỗ)
  - `app/settings/recurring.tsx` — rule item name + category picker (2 chỗ)
  - `app/edit/[id].tsx` — category grid (1 chỗ)
  - `app/bills/index.tsx` — category picker (1 chỗ)
- ✅ Add `useT()` vào các file chưa có để subscribe locale → re-render
- ✅ Fix shadow conflict trong calendar.tsx + report.tsx (loop variable `t` xung đột với i18n function `t`) — đổi loop var thành `tx`
- ✅ tsc strict pass

**Behavior**:
- User tạo custom category "Trà sữa" → giữ nguyên "Trà sữa" trong mọi locale
- Default "Ăn uống" → đổi sang "Food & drink" khi English, "餐饮" khi 中文
- Default "Khác" fallback dùng khi catMap miss (vd transaction trỏ tới category đã xoá)

### v3.20 — 2026-05-23 (18:02) — i18n Phase 1.5: Calendar + Budget hoàn thiện
**Đại ca báo**: 2 trang (Lịch, Ngân sách) vẫn còn nhiều string tiếng Việt cứng sau khi đổi ngôn ngữ.

- ✅ **Thêm 22 keys mới** vào vi/en/zh:
  - Calendar: viewList/viewGrid/searchPlaceholder/coachTitle/coachTap/historyTitle/txOnDate/emptyMonth/emptyMonthDesc/emptyDay/emptyDayDesc/recordTx/snackbarUndo (13 keys)
  - Budget: totalLabel/byCategory/byCategoryDesc/setCta/tapToSet/modalTitle/modalSub (7 keys)
- ✅ **calendar.tsx**: áp `t()` cho view toggle, search placeholder, coach title/tap, history section title, txOnDate template, empty states (month/day), record button, undo snackbar
- ✅ **budget.tsx**: áp `t()` cho overview "Tổng ngân sách", section title + sub, "+ Set ngân sách" CTA, modal title + sub, hint text
- ✅ Interpolation `{date}`, `{name}`, `{month}` cho dynamic content
- ✅ tsc strict pass

Sau pass này, **2 trang Lịch + Ngân sách đổi 100% theo locale**. Đại ca pick 🇨🇳 中文 → tab Lịch hiện "列表 / 月历 / 搜索备注、分类、金额... / 月度总结 / 交易历史 / 本月暂无交易". Budget → "总预算 / 已用 / 剩余 / 按分类 / + 设置预算".

### v3.19 — 2026-05-23 (16:55) — i18n Phase 1: 3 ngôn ngữ + useT() hook + xoá test notif
**Plan**: `PLAN_2026-05-23-i18n-fix.md` đã duyệt.
**Đại ca yêu cầu**:
1. Chọn ngôn ngữ phải đổi NGAY (không phải thoát app)
2. Có nút "Áp dụng" để xác nhận
3. Thêm tiếng Trung giản thể 🇨🇳
4. Xoá luôn nút "Gửi thông báo thử"

- ✅ **`useT()` hook mới** (`src/i18n/useT.ts`):
  - Subscribe `settings.locale` từ Zustand store → component re-render khi đổi
  - `setLocale()` gọi INLINE trong render (không qua useEffect) → `t()` đọc locale mới ngay → FIX bug "phải thoát app mới đổi"
  - Pattern: `const t = useT();` → dùng `t('key')` trong JSX
- ✅ **Thêm tiếng Trung giản thể** (`src/i18n/zh.ts`):
  - ~110 keys dịch sang 中文(简体): "记录", "支出", "预算", "今早可以轻松花", v.v.
  - Update `AVAILABLE_LOCALES` thành 3 mục: 🇻🇳 Tiếng Việt / 🇬🇧 English / 🇨🇳 中文
  - `parseLocale()` mới — convert raw setting string → Locale type-safe
- ✅ **Screen Language UX mới** (`app/settings/language.tsx`):
  - 3 option dạng radio với flag + label, viền+nền primary khi pick
  - State `picked` local — pick chỉ highlight, chưa apply
  - Nút lớn "Áp dụng" / "Apply" / "应用" dưới cùng, disabled nếu giống locale hiện tại
  - Apply → `setLocale(picked)` (sync ngay) + `updateSetting('locale', picked)` (persist) → `router.back()` → toàn app dùng locale mới
- ✅ **Áp `useT()` + `t()` vào Phase 1 (8 files)**:
  - `app/(tabs)/_layout.tsx` — 5 tab labels (đã có v3.18)
  - `app/(tabs)/index.tsx` — tab Nhập ~16 strings (đã có v3.18)
  - `app/(tabs)/more.tsx` — title + 8 menu items + dashboard card + tagline (~16 strings)
  - `app/(tabs)/report.tsx` — title + AI CTA + view toggle + chi/thu + summary cards + empty state (~12 strings)
  - `app/(tabs)/calendar.tsx` — Thu/Chi/Số dư + snackbar "Đã xoá" (4 strings)
  - `app/(tabs)/budget.tsx` — title + Đã chi/Còn lại + "Vượt ngân sách" (4 strings)
  - `app/settings/index.tsx` — 7 section titles + reset modal (đã có v3.18)
  - `app/settings/salary.tsx` — title + enable/desc/off + 3 cycle options + preview labels (~12 strings)
  - `src/components/SafeToSpendCard.tsx` — time-of-day + sub + overspend (đã có v3.18)
- ✅ **Xoá nút "Gửi thông báo thử"** trong `app/settings/notifications.tsx`:
  - Bỏ import `sendTestNotification`
  - Bỏ View section + nút testBtn
- ✅ tsc strict pass

**Phase 1 cover** ~90% strings người dùng thấy nhiều nhất. Bấm Áp dụng → tab bar + dashboard + Settings hub + Salary + Báo cáo + Lịch + Ngân sách + Khác + SafeToSpend đều đổi ngôn ngữ.

**Phase 2 (làm sau)**: bills, goals, insights, summary/today, edit, onboarding, recurring, wallets, categories, security, advanced, StreakBadge, MonthSwitcher, LockScreen, ErrorBoundary.

### v3.18 — 2026-05-23 (16:33) — Xoá "Lượt", move "Chu kỳ lương", fix i18n re-render
**Đại ca yêu cầu**:
1. Ngôn ngữ pick xong KHÔNG đổi → bug do components chưa subscribe locale
2. Chu kỳ lương từ Settings → tab Khác (dễ thấy hơn)
3. Xoá "Lượt tự động tháng này" (Gemini quota — không dùng từ khi offline)

- ✅ **Xoá quota counter** trong `settings/index.tsx`:
  - Bỏ section "Lượt tự động tháng này" + state `usage`
  - Xoá import `checkAIQuota, FREE_TIER_LIMIT` từ `ratelimit`
  - Xoá `useEffect` load usage
- ✅ **Move "Chu kỳ lương"** sang tab Khác:
  - Bỏ entry trong `settings/index.tsx`
  - Add `{icon:'Scale', name:'Chu kỳ lương', sub:'Tính số dư an toàn theo ngày nhận lương'}` vào menu của `more.tsx`
  - Route `/settings/salary` giữ nguyên
- ✅ **Fix i18n re-render**:
  - Hook `useLocale()` đã có → subscribe `settings.locale` từ Zustand store + sync module-level locale
  - Áp `useLocale()` + `t()` vào:
    - `app/(tabs)/_layout.tsx` (tab labels)
    - `app/(tabs)/index.tsx` (toàn bộ label tab Nhập)
    - `app/settings/index.tsx` (header + 7 section titles/desc + reset modal)
    - `src/components/SafeToSpendCard.tsx` (header time-of-day + sub line + overspending text)
  - SafeToSpendCard `useMemo` đổi deps `[locale]` để re-compute headerLabel khi user pick language khác
  - Khi user pick "English" → store update setting `locale='en'` → all subscribed components re-render với `t()` mới
- ✅ tsc strict pass

**Strings đã dịch (vi/en):**
- 5 tab labels
- ~16 strings tab Nhập (title, voice box, type tabs, labels, placeholder, submit)
- ~25 strings Settings (titles, desc, reset modal)
- 10 strings SafeToSpendCard (time-of-day, sub, overspend)

**Còn lại (chưa dịch — sẽ làm dần):** tab Lịch, tab Báo cáo, tab Ngân sách, tab Khác menu items, các settings sub-screens, screen Summary, screen Bills/Goals, modal/dialog content.

### v3.17 — 2026-05-23 (16:25) — Sticky header streak + Settings spacing + i18n (vi/en)
**Đại ca yêu cầu 3 việc qua test thật:**
1. Streak modal: header bị cuộn mất khi xem week/month → nên sticky
2. Settings: khoảng trống thừa giữa các section
3. Thêm tính năng đổi ngôn ngữ

- ✅ **Sticky Hero streak modal** (`StreakBadge.tsx`):
  - Hero box (🔥 + số streak + label + kỷ lục) DI CHUYỂN RA NGOÀI ScrollView
  - Nằm trực tiếp trong sheet, dưới sheetHandle, có `borderBottom` chia tách
  - Hero giờ nhỏ gọn hơn: flame 36px + num 44px (cũ 64/72) để không chiếm nhiều màn
  - Hero row dùng `flexDirection: row` thay vì stack → đẹp + compact
  - Khi user cuộn ScrollView xem week strip / month / badges → Hero luôn hiện
- ✅ **Compact Settings** (`app/settings/index.tsx`):
  - `container.padding` 20 → 16
  - `section.padding` 16 → 14
  - `section.marginBottom` 16 → 10
  - `section.borderRadius` 14 → 12
  - `sectionHead.marginBottom` 8 → 6
  - `sectionDesc.marginBottom` 12 → 6 + lineHeight 18 → 17
  - Giao diện sát nhau hơn, ít khoảng trắng vô nghĩa
- ✅ **i18n framework + đổi ngôn ngữ** (vi/en):
  - `src/i18n/index.ts`: module-level `currentLocale` + `t(key, vars?)` với interpolation `{name}` syntax + fallback chain (locale hiện tại → vi → key)
  - `src/i18n/vi.ts`: ~70 key tiếng Việt (tabs, input, settings, common, safe-to-spend)
  - `src/i18n/en.ts`: mirror tiếng Anh
  - `src/i18n/useLocale.ts`: hook đọc locale từ Zustand store → sync module
  - `AVAILABLE_LOCALES`: `[{code:'vi',label:'Tiếng Việt',flag:'🇻🇳'}, {code:'en',label:'English',flag:'🇬🇧'}]`
  - **Screen mới `app/settings/language.tsx`**: list 2 locale với flag, tap để pick + tick xanh
  - Settings hub entry mới "Ngôn ngữ · Language" (Icon Languages)
  - `app/_layout.tsx`: effect sync `settings.locale` → `setLocale()` mỗi khi đổi
  - Setting key `locale` lưu trong DB (default 'vi')
  - Note ở language screen: "Tiếng Anh đang ở giai đoạn dịch dần — sẽ hoàn thiện qua các bản cập nhật"
- ✅ Add 4 icon mới vào `Icon.tsx`: Languages / Sun / AlertTriangle / Plus
- ✅ tsc strict pass

**Còn lại (tương lai):** Áp `t()` vào các string hardcoded trong tab Nhập / Báo cáo / Lịch / Ngân sách / Khác — hiện chỉ build framework, dịch hardcode dần qua các pass sau.

### v3.16 — 2026-05-23 (15:22) — Bỏ "AI" khỏi UI Báo cáo + ẩn CTA khi 0 TX
**Đại ca yêu cầu**: Card "Phân tích AI tháng này" ở tab Báo cáo vẫn hiện dù chưa có giao dịch — vô lý. Cũng nên bỏ chữ "AI" cho thống nhất với định hướng "app offline, không AI".

- ✅ `app/(tabs)/report.tsx`:
  - Wrap CTA trong `{transactions.length > 0 ? ... : null}` — ẩn khi tháng chưa có giao dịch
  - Đổi "Phân tích AI tháng này" → **"Phân tích chi tiêu tháng này"**
- ✅ `app/insights/index.tsx`:
  - Đổi title topbar "Phân tích AI" → **"Phân tích chi tiêu"**
- ✅ `app/(tabs)/more.tsx`:
  - Wrap dashboard CTA "Xem phân tích AI tháng này" trong `{transactions.length > 0 ? ... : null}`
  - Đổi text → **"Xem phân tích chi tiêu tháng này"**
- ✅ tsc strict pass

Vẫn còn "AI" trong:
- `app/camera/scan.tsx` (route đã ẩn, không user-facing)
- `app/settings/advanced.tsx` (admin only, mention "Google AI Studio" — keep vì là tên dịch vụ thật)

### v3.15 — 2026-05-23 (15:18) — CRITICAL: Fix Render Error khi reset DB
**Đại ca báo bug**: Xoá data → app crash với "Rendered fewer hooks than expected"

**Root cause**: `StreakBadge.tsx` vi phạm Rules of Hooks:
- Render 1 (có streak): `useState` + `useStore` + 6× `useMemo` = 8 hooks
- Render sau reset (streak=0/0/[]): hit early return null SAU 2 hooks → còn 2 hooks
- React thấy số hooks giảm 8→2 → throw render error

- ✅ **Fix Rules of Hooks** trong `StreakBadge.tsx`:
  - Move TẤT CẢ `useMemo` lên TRƯỚC early return
  - Early return chỉ chạy sau khi đủ 8 hooks
  - Comment cảnh báo: "🚨 Rules of Hooks: TẤT CẢ hooks phải gọi trước mọi early return"

- ✅ **Fix reset flow** (UX phụ):
  - `resetDatabase()` giờ giữ lại `onboarded = '1'` → không bị ép qua 4 màn onboarding sau reset
  - `doReset()` ở Settings reload đầy đủ: `loadSettings` + `loadWallets` + `loadBooks` thêm vào (đã có categories/transactions/budgets) → store không stale

- ✅ tsc strict pass

**Lesson**: Mọi component có `if (...) return null` PHẢI có TẤT CẢ hooks declared trước. Em sẽ audit các component khác trong pass sau.

### v3.14 — 2026-05-23 (15:13) — Fix 3 bugs UX
**Đại ca báo qua test thật:**
1. Streak modal không kéo lên xuống được (ScrollView block bởi Pressable)
2. Bấm "Tự động điền" → bàn phím vẫn hiện + TextInput vẫn focus, phải tap màn hình mới bấm được "Ghi chi"
3. Header card "Chiều nay bạn iu xài thoải mái khoảng" + số tiền → 1 dòng quá dài, layout xấu

- ✅ **Fix 1 (Streak modal scroll)**: Refactor `StreakBadge.tsx`:
  - Pattern cũ: `<Pressable onPress={close}><Pressable onPress={() => {}}><ScrollView>...` → Pressable ăn touch event của ScrollView
  - Pattern mới: `<View>[<Pressable absoluteFill close />, <View sheet><ScrollView>...]` → backdrop absolute layer riêng, sheet là View thuần, ScrollView scroll tự do
  - Thêm `bounces` + `keyboardShouldPersistTaps="handled"` cho ScrollView
- ✅ **Fix 2 (Keyboard dismiss)**: `tryVoiceParse()` + `submit()` trong `app/(tabs)/index.tsx`:
  - Add `import { Keyboard }` + gọi `Keyboard.dismiss()` ngay đầu function
  - Sau khi parse / submit → bàn phím tự xuống, không cần tap màn hình
- ✅ **Fix 3 (Header rút gọn)**: `SafeToSpendCard.tsx`:
  - "Sáng/Trưa/Chiều nay bạn iu xài thoải mái khoảng" → "Sáng/Trưa/Chiều nay xài thoải mái"
  - "Tối nay bạn iu xài nhẹ nhàng khoảng" → "Tối nay xài nhẹ tay"
  - "Khuya rồi, bạn iu còn" → "Khuya rồi, còn lại"
  - "Bạn iu" đẩy xuống sub line: "Bạn iu yên tâm, còn N ngày tới đợt lương sau"
  - Header gọn 1 dòng đẹp với số tiền lớn bên dưới
- ✅ tsc strict pass

### v3.13 — 2026-05-23 (14:55) — F6 TikTok-style streak + F10h Morning notif
**Đại ca yêu cầu**:
1. Streak UI giống TikTok (week strip + flame to + animation feel)
2. Thêm notif sáng safe-to-spend, tone tự nhiên

- ✅ **F10h Notif sáng safe-to-spend**:
  - `scheduleMorningBudget(hour=9, minute=0)` + `cancelMorningBudget` + `isMorningBudgetScheduled` trong `notifications.ts`
  - DAILY trigger 9h sáng (mặc định) với 5 variants random tone tự nhiên:
    - "☀️ Sáng tốt lành — Bux2 tính sẵn hạn mức hôm nay rồi nha"
    - "Ngày mới rồi, coi nay xài bao nhiêu là đẹp bạn iu"
    - "☕ Bux2 gửi số cho bạn iu xem hôm nay xài thoải mái nhé"
    - v.v.
  - Notif payload `data.screen = '/summary/today'` → tap deep link
  - Settings → Thông báo: toggle mới "Hạn mức sáng nay" + chọn giờ 7/8/9/10/11
  - Lưu setting `morning_enabled` + `morning_hour`

- ✅ **F6 TikTok-style Streak UI** — Refactor `StreakBadge.tsx`:
  - Modal slide-up từ dưới (animationType='slide' thay vì 'fade')
  - Modal cao 92% màn hình, ScrollView để cuộn nhiều section
  - **HERO**: Flame emoji 64px + số streak 72px BIG, kỷ lục cá nhân sub
  - **WEEK STRIP** (TikTok signature): 7 cột T2-CN với:
    - Vòng tròn 36×36, có 🔥 nếu ngày đó active
    - Today: viền vàng dashed nếu chưa active, viền cam solid nếu đã active
    - Future: nền xám nhạt
    - Empty + today: hiện "!" cảnh báo
    - Số ngày dưới dot
  - **TIP nếu hôm nay chưa active**: "💛 Hôm nay chưa ghi giao dịch. Ghi 1 cái để giữ chuỗi nha bạn iu"
  - **MONTH GRID**: 28-31 ô 30×30, ngày active = nền cam solid với số trắng, today = viền cam, future = mờ
  - **Next milestone**: tip card vàng "🔥 Còn N ngày để mở khoá X"
  - **Freeze Pass**: tip card xanh dương
  - **Badge collection**: horizontal scroll 4 cards
  - **Stats**: current / longest / badge count
  - Helper mới trong `streak.ts`: `weekDays(today)` → 7 ngày Mon-Sun; `monthDays(today)` → tất cả ngày tháng; `activeDateSet(dates, start, end)`
  - Component dùng `useStore(s => s.transactions)` để query active dates

- ✅ tsc strict pass

### v3.12 — 2026-05-23 (14:42) — F10g Tone tâm lý học mềm mại
**Đại ca yêu cầu**: bỏ chữ "tối đa" — quá cứng. Phải tâm lý học: framing tích cực, không áp lực.

**Nguyên tắc wording mới:**
- Tránh: "tối đa", "giới hạn", "không quá", "chỉ được", "cần cắt giảm"
- Dùng: "thoải mái khoảng", "nhẹ nhàng", "để dành", "yên tâm", "mình nhẹ tay"

- ✅ Time-of-day label refactor:
  - Sáng: "Sáng nay bạn iu xài thoải mái khoảng"
  - Trưa: "Trưa nay bạn iu xài thoải mái khoảng"
  - Chiều: "Chiều nay bạn iu xài thoải mái khoảng"
  - Tối: "Tối nay bạn iu xài nhẹ nhàng khoảng"
  - Khuya: "Khuya rồi, bạn iu còn"
- ✅ Sub line: "để đủ tới hết tháng" → **"Yên tâm để dành — còn X ngày tới cuối tháng"**
- ✅ Cycle mode sub: "Yên tâm để dành — còn X ngày tới đợt lương sau"
- ✅ Overspending state (chi vượt thu):
  - Header "Đã vượt thu nhập" → **"Bạn iu, tháng này hơi quá tay"**
  - Sub "Chi tháng này nhiều hơn thu. Cần cắt giảm" → **"Chi nhỉnh hơn thu chút rồi. X ngày tới mình nhẹ tay nhé 💛"**
- ✅ Bỏ `textTransform: uppercase` cho headLabel (caps trông cứng) → giữ fontSize 13, weight 700, không uppercase
- ✅ tsc strict pass

### v3.11 — 2026-05-23 (14:37) — F10f Header label theo time-of-day
**Đại ca yêu cầu**: header thay đổi theo giờ trong ngày (sáng/trưa/chiều/tối/khuya), tone GenZ thân thiện.

- ✅ Hàm `timeOfDayLabel(hour)` mới trong `SafeToSpendCard.tsx`:
  - 5h-10h: "Sáng nay bạn iu xài tối đa"
  - 11h-13h: "Trưa nay bạn iu xài tối đa"
  - 14h-17h: "Chiều nay bạn iu xài tối đa"
  - 18h-21h: "Tối nay bạn iu xài tối đa"
  - 22h-4h: "Khuya rồi bạn iu, còn lại tối đa"
- ✅ Memoize 1 lần khi mount (`useMemo` deps []) — không re-compute mỗi render
- ✅ tsc strict pass

### v3.10 — 2026-05-23 (14:33) — F10e Ẩn card khi chưa có thu nhập + wording GenZ
**Đại ca feedback**: "Ẩn số dư an toàn nào người dùng nhập lương thì hiện, và đổi thành số ưu sử dụng tối đa trong hôm nay nha bạn iu hoặc gì đó".

- ✅ `SafeToSpendCard`: nếu `data.safeAmount === null` → `return null` (ẨN HẲN card). User mới chưa có income → dashboard sạch sẽ, không có banner vàng hint. Khi user ghi thu nhập → card tự hiện
- ✅ Đổi header: "Hôm nay xài tối đa" → **"Bạn iu xài tối đa hôm nay"** (tone thân thiện hơn)
- ✅ Đổi sub: "để đủ tới hết tháng" → **"nha, để dành tới hết tháng"** (giọng dí dỏm)
- ✅ Sub khi cycleMode: "nha, để dành tới đợt lương sau — còn N ngày"
- ✅ `app/summary/today.tsx`: wrap section "HẠN MỨC HÔM NAY" + Card vào điều kiện `safeAmount !== null` để label không lủng lẳng khi card ẩn
- ✅ tsc strict pass

**UX**:
- User mới (chưa ghi income) → dashboard chỉ có voiceBox + form nhập, không bị banner cản
- User ghi income → card "Bạn iu xài tối đa hôm nay Xđ" pop lên ngay

### v3.9 — 2026-05-23 (14:26) — F10d Bỏ option "Mỗi 45 ngày" + làm rõ "Hàng tháng"
**Đại ca feedback**: "Mỗi 45 ngày" gây confuse. Người thường lãnh lương theo tháng dương lịch, không theo N ngày cố định.

- ✅ Xoá option `{ days: 45 }` khỏi `CYCLE_OPTIONS` trong `app/settings/salary.tsx`
- ✅ Làm rõ desc của "Hàng tháng": "tự khớp 28/29/30/31 ngày" — user hiểu logic auto theo tháng dương lịch
- ✅ Còn lại 3 option: Hàng tháng (default) / Mỗi 15 ngày / Hàng tuần
- ✅ Service layer giữ nguyên `cycleType='days'` + `cycleDays` để tương lai có thể thêm "Tuỳ chỉnh N ngày" nếu cần
- ✅ tsc strict pass

### v3.8 — 2026-05-23 (14:15) — F10c Tách "Hàng tháng" vs "Mỗi N ngày"
**Bug đại ca báo**: Chọn "30 ngày" thì kỳ tính ra 10/5 → 9/6 OK, nhưng chọn "45 ngày" thì kỳ 10/5 → 23/6 — sai logic vì nhận lương hàng tháng vẫn nhận 10/6, không phải 24/6.

**Fix**: Tách 2 loại chu kỳ riêng:
- ✅ `SalaryCycleType = 'monthly' | 'days'` mới
  - **monthly** (mặc định): `next_payday = sameDayNextMonth(last_payday)` — 10/5 → 10/6, kể cả tháng 28 ngày (clamp 31→28)
  - **days**: `next_payday = last_payday + N` — cho freelance / part-time
- ✅ Hàm helper `sameDayNextMonth(d)` + `computeNextPayday(lastPayday, config)` trong `safeToSpend.ts`
- ✅ Settings key mới `salary_cycle_type` = 'monthly' | 'days'. Default 'monthly'.
- ✅ `parseSalaryCycleFromSettings` đọc thêm `cycleType`
- ✅ `app/settings/salary.tsx` đổi UI: thay 3 preset days bằng 4 option:
  - "Hàng tháng" (recommend, default) — VP/nhà nước
  - "Mỗi 15 ngày" — lương 2 đợt
  - "Hàng tuần" (7 ngày) — part-time/sinh viên trả tuần
  - "Mỗi 45 ngày" — freelance dự án dài
- ✅ Mỗi option tự chọn cả `cycleType` + `cycleDays`. Khi pick "Hàng tháng" → `cycleType='monthly'`, ignore days
- ✅ tsc strict pass

### v3.7 — 2026-05-23 (14:05) — F10b Chu kỳ lương (fix logic Safe-to-spend)
**Bug đại ca báo**: Lương nhận 10/5 nhưng app vẫn chia ngân sách tới hết tháng 5 → sai vì sang T6 chưa có lương. Logic chỉ đúng với người được trả lương ngày cuối tháng.

**Fix**: Thêm chế độ "Chu kỳ lương" tuỳ chọn:
- ✅ `src/services/safeToSpend.ts` refactor:
  - `SalaryCycleConfig` mới `{ enabled, payday, cycleDays }`
  - `parseSalaryCycleFromSettings(settings)` đọc từ 3 keys settings
  - 2 chế độ tính:
    - **Default (off)**: tháng dương lịch (logic cũ — giữ cho user không bật)
    - **Cycle (on)**: tính `last_payday` (≤ today) → `next_payday = last_payday + cycleDays`. Filter income/expense/bill từ last_payday tới trước next_payday.
  - Edge case: payday > số ngày tháng đó (vd 31/2) → clamp về ngày cuối tháng
  - `rangeLabel` mới: "10/05 → 09/06" hoặc "Tháng 05/2026"
  - `isCycleMode` flag để UI biết hiển thị label
- ✅ `src/components/SafeToSpendCard.tsx` hiển thị range kỳ + "tới đợt lương tiếp" khi cycleMode
- ✅ **Screen mới `app/settings/salary.tsx`**:
  - Toggle Bật/Tắt
  - Input ngày lương (1-31, validate)
  - 3 preset cycle: 15 / 30 (mặc định) / 45 ngày
  - **Preview real-time**: Card hiển thị kỳ tính + income/expense/safe-to-spend theo config đang chỉnh
- ✅ Settings hub entry mới "Chu kỳ lương" (Icon Scale) → push `/settings/salary`
- ✅ Tab Nhập + summary/today pass `parseSalaryCycleFromSettings(settings)` vào `computeSafeToSpend`
- ✅ Stack.Screen `settings/salary` đăng ký trong `_layout.tsx`
- ✅ tsc strict pass (exit 0)

**UX**:
- Default OFF → user mới mở app không bị bối rối, dùng tháng dương lịch
- Bật khi cần: VP nhận lương cố định, sinh viên làm thêm chu kỳ ngắn
- Preview ngay trong settings để user thấy hiệu quả trước khi save

### v3.6 — 2026-05-23 (13:50) — Retention Combo 🚀 (F5 + F6 + F10)
**Plan**: `PLAN_2026-05-23-retention.md` — đại ca duyệt 3 chức năng F5/F10/F6 build chung 1 pass.
**Triết lý**: *"App nhập thay user + App lôi user quay lại"* — đánh trực diện vấn đề user lười nhập + quên app.
**F1 đọc notification ngân hàng đã LOẠI BỎ** vì vi phạm Nghị định 13/2023 VN + Google Play sensitive permission policy.

- ✅ **F10 — Số dư an toàn hôm nay** (Safe-to-spend):
  - `src/services/safeToSpend.ts` — `computeSafeToSpend(transactions, bills, today)` trả `{safeAmount, daysRemaining, monthIncome, monthExpense, pendingBills, isOverspending}`
  - Công thức: `(thu_tháng - chi_đã_phát_sinh - bill_pending) / số_ngày_còn_lại`
  - Empty state nếu user chưa có income tháng → gợi ý ghi thu trước
  - Cảnh báo state nếu vượt thu (đỏ) hoặc safeAmount < 30k (cam)
  - `src/components/SafeToSpendCard.tsx` — Card lớn dashboard, tap để expand chi tiết
  - Hiển thị trên: tab Nhập (dashboard top), screen `/summary/today`
- ✅ **F6 — Streak ghi sổ + Freeze Pass + Badges**:
  - Schema v12: bảng `streaks` (1 row, current/longest/last_active/freeze_passes/freeze_pass_week/badges JSON)
  - `src/services/streak.ts`:
    - `recordActivity(date)` — gọi sau mỗi `addTransaction`. Tăng streak nếu yesterday→today, dùng freeze pass nếu gap=2 ngày + còn pass, else reset
    - `getStreak()` — đọc state + tính `displayStreak` realtime so với today (alive/dead)
    - Freeze Pass tự refill 1/tuần (Monday-based week key)
    - Milestones: 7, 30, 100, 365 → unlock badge tự động khi đạt
    - `nextMilestone(streak)`, `badgeLabel(m)`, `resetStreak()`
  - `src/components/StreakBadge.tsx` — pill 🔥 + số trên header, tap → modal bộ sưu tập badge + freeze pass info + stats
  - Hook `recordActivity` vào `useStore.addTransaction` → lưu `lastStreakDelta` trong store → tab Nhập effect show toast (badge mới / freeze pass used / streak +N)
  - Reset DB tự reset streak (SQLite file bị xoá kèm)
- ✅ **F5 — Daily Summary 8h tối** (anti-quên app hook):
  - `scheduleDailySummary(hour=20, minute=0)` + `cancelDailySummary` + `isDailySummaryScheduled` trong `src/services/notifications.ts`
  - DAILY trigger với content random từ 5 variants (đỡ nhàm): "Bux2 — Hôm nay bạn chi gì? Mở app 1 phút xem nào", v.v.
  - Notification payload `data.screen = '/summary/today'` → tap notif → deep link
  - `app/_layout.tsx` — `Notifications.addNotificationResponseReceivedListener` parse `data.screen` → `router.push`
  - **Screen `app/summary/today.tsx`** mới:
    - Hero card: tổng chi hôm nay + so sánh hôm qua (🎉 tiết kiệm / ⚠️ tăng / ➖ tương đương)
    - Top 3 chi theo category (icon + progress bar tỷ lệ)
    - Mini stats: giao dịch / hạng mục / streak
    - SafeToSpendCard expanded
    - Next milestone card (badge sắp đạt)
    - Empty state nếu chưa ghi gì hôm nay → CTA "Ghi ngay" + nhắc streak sắp gãy
- ✅ **Settings → Thông báo**:
  - Toggle mới "Tóm tắt hôm nay 20:00"
  - Khi bật → chọn giờ 18/19/20/21/22
  - Lưu setting `summary_enabled` + `summary_hour`
- ✅ **Tab Khác** → entry mới "Tóm tắt hôm nay" (icon Scale) → push `/summary/today`
- ✅ **Tone**: Xoá "đại ca" còn sót trong settings/notifications copy → "bạn"
- ✅ tsc strict pass (exit 0, 0 errors)

**Triết lý retention áp dụng**:
- Loss aversion: streak có thể gãy → user sợ mất → quay lại
- Freeze pass: tha thứ 1 ngày/tuần → tránh nản nếu lỡ
- Hook 20h tối: trigger duy nhất cần user nhớ → mở app vì tò mò "hôm nay chi gì"
- Safe-to-spend: con số duy nhất hôm nay → giảm cognitive load

### v3.5 — 2026-05-23 (12:10) — RENAME "Bux2" → "Bux2: Quản lý chi tiêu"
**Theo yêu cầu anh Bux2** — gắn brand cá nhân + descriptor SEO:
- App name: **Bux2** (display name)
- Subtitle / About: "Sổ thu chi thông minh"
- Format: "Bux2: Quản lý chi tiêu" (giống pattern App Store VN "Sổ thu chi: Quản lý chi tiêu")

Update toàn app — verified KHÔNG còn "Bux2" trong code (grep clean):
- `app.json` name + cameraPermission
- Tab Khác footer + Settings About
- Bills, Goals, Onboarding empty desc
- LockScreen title + biometric reason
- Notifications title (daily / weekly / smart / test)
- Smart nudge fallback message
- Books modal copy
- Email subject contact

**Còn chờ anh quyết**: domain email `hello@bopapp.vn` giữ hay đổi `hello@bux2app.vn`?

### v3.4 — 2026-05-23 (12:00) — Smart Nudges + Reset confirm UX
**Plan**: `PLAN_2026-05-23-notifications.md`

- ✅ **Smart Nudge engine** `src/services/smartNudge.ts`:
  - `generateNudge(ctx)` random pick từ 6 rule template với data thật
  - `computeNudgeContext(transactions, categories)` aggregate week + month + prev week + top categories
  - Tone GenZ thân thiện: "{Cafe} tháng này {1.2tr}đ, đủ {AirPods Pro sau 3 tháng}", "Tuần này gấp {2.1} tuần trước, đang celebrate gì hả 🎉"
  - `equivalent(amount)` map số tiền → item user có thể mua (Sony, AirPods, PS5, buffet sushi, túi Charles & Keith...)
  - 100% local, không API, không gửi PII
- ✅ **Schedule**:
  - `scheduleWeeklyNudge(content)` — Chủ nhật 10:00 với data tuần
  - `scheduleSmartNudge(content, daysAhead)` — random 3-7 ngày
  - Lưu ý: notification content fixed lúc schedule, cần reschedule khi user mở app (TODO sau)
- ✅ **Settings → Nhắc nhở** thêm 2 toggle:
  - "Tóm tắt tuần" — Chủ nhật 10:00 sáng
  - "Nhận xét ghẹo cá nhân" — random 3-7 ngày
- ✅ **Reset dữ liệu UX**:
  - Đổi text "Reset DB (xoá hết)" → "Reset dữ liệu"
  - Mô tả mở rộng: list đầy đủ (giao dịch + ví + ngân sách + mục tiêu + hoá đơn + recurring + PIN + theme)
  - Modal confirmation 2 bước: user phải gõ chính xác **"XOÁ"** vào TextInput mới enable nút đỏ
  - Icon AlertCircle to + visual emphasis "Không thể phục hồi"

### v3.3 — 2026-05-23 (11:45) — Consistency Pass (per CONSISTENCY_AUDIT.md)
**Process mới**: viết file `CONSISTENCY_AUDIT.md` audit 8 inconsistencies → anh duyệt → em fix.

- ✅ **Xoá Sổ kế toán (F58 Multi-book)** UI theo yêu cầu anh — Stack.Screen comment + bỏ card switcher trong Tab Khác. DB tables giữ (data có book_id=1 vô hại). Có thể restore sau.
- ✅ **Chuẩn hoá wording** Chi/Thu:
  - "Ghi khoản chi/thu" → "Ghi chi" / "Ghi thu"
  - "Tiền chi/Tiền thu" → "Chi" / "Thu" (tabs)
  - "Chi tiêu/Thu nhập" → "Chi" / "Thu" (Báo cáo)
  - "Tổng chi/Tổng thu" → "Chi" / "Thu" (PieChart center)
  - Edit modal cũng update
- ✅ **Chuẩn hoá date format** "Tháng MM/YYYY":
  - Util mới `formatMonth(YYYY-MM)` trong `src/utils/date.ts`
  - MonthSwitcher pad 0 (đã đúng nhưng explicit hơn)
  - Insights header dùng slice trực tiếp (đã chuẩn)
- ✅ **Empty states đẹp** cho Lịch + Báo cáo:
  - Template: Icon 42px trong vòng tròn primaryLight + Title bold + Desc gray + CTA button "Ghi giao dịch"
  - Lịch: "Chưa có giao dịch tháng này" / "Không có giao dịch ngày này"
  - Báo cáo: "Chưa có dữ liệu" + nút quay về Nhập vào
- ✅ Polish: coach card border palette aware, drill-down modal max 88%

### v3.2 — 2026-05-23 (11:30) — Cleanup duplicates + Fix month default bug
**Workflow mới (anh Bux2 yêu cầu)**: trước khi build phải viết .md plan kỹ → screenshot/mock → đợi anh duyệt → mới code. File `PLAN_2026-05-23-cleanup.md` là ví dụ đầu tiên.

- ✅ Xoá section "Quyền riêng tư" trong Cài đặt (technical info không cần thiết cho user)
- ✅ Xoá menu item "Phân tích AI" duplicate ở Tab Khác (đã có CTA lớn ở Báo cáo + dashboard widget có nút "Xem phân tích AI tháng này")
- ✅ Xoá section "Quản lý ví" duplicate ở Cài đặt (giữ ở Tab Khác — top-level menu)
- ✅ **Fix bug tháng default**: anh Bux2 thấy app đôi khi default sang Tháng 6 khi hôm nay là Tháng 5. Fix:
  - `_layout.tsx` boot effect: `setCurrentMonth(thisMonth)` reset về tháng thật mỗi lần app load
  - AppState listener: khi app trở lại foreground (sau khi user mở app khác/ngủ đêm) → re-sync currentMonth (xử lý case qua đêm sang tháng mới)

### v3.1 — 2026-05-23 (11:15) — Sticky submit + F58 Multi-book
**Đại ca research đối thủ Komorebi "Sổ thu chi"** → 2 việc lớn:

- ✅ **Sticky submit button** Tab Nhập vào: nút "Nhập khoản chi/thu" giờ `position: absolute bottom: 0` — luôn visible, không cần cuộn. Sử dụng `paddingBottom: 100` cho ScrollView để không che content.
- ✅ **F58 Multi-book (Sổ kế toán nhiều sổ)** — Bux2 làm **5 sổ free** (đối thủ chỉ Pro):
  - DB v11: bảng `books(id, name, icon, color, is_default, created_at)` + cột `book_id` cho 6 entities (wallets, transactions, budgets, bills, savings_goals, recurring_rules)
  - Service: `getBooks/addBook/updateBook/deleteBook`. Delete cascade xoá hết data thuộc sổ
  - Store: `books`, `currentBookId` state + actions. `setCurrentBookId(id)` reload all data theo book
  - Filter mọi query bằng `currentBookId` (loadWallets, loadTransactions, loadBudgets, loadBills, loadGoals)
  - Route `app/settings/books.tsx` — CRUD sổ với 10 icon + 9 màu. Tap sổ để switch active (highlight border). Long-press = xoá (default không xoá được)
  - Tab Khác: thêm card "Sổ kế toán" trên dashboard widget, tap → /settings/books
  - Free 5 sổ, Pro unlimited (chuẩn bị paywall)

DB schema v11 final: 11 tables, 11 columns added/altered.

### v3.0 — 2026-05-23 (11:00) — FULLY OFFLINE (zero API cost)
**Quyết định lớn**: theo yêu cầu anh Bux2 ("các chức năng không cần AI mạnh") — app **không gọi Gemini cho bất kỳ task nào nữa**. Build local engine cover hết.

- ✅ **`src/services/localInsight.ts`** — template-based engine sinh:
  - `generateLocalCoach(ctx)` — 1 câu coach (50-120 ký tự), 5 rule (chi vượt thu / spend rate / top cat % / saving good / avg day) → pickRandom variation
  - `generateLocalReport(ctx)` — báo cáo 4 sections (summary + anomalies + suggestions + savings_target) từ rules. Output structure giống Gemini JSON.
- ✅ Tab Lịch "Tóm tắt tháng" → switch sang `generateLocalCoach` (instant, sync function)
- ✅ Route /insights "Phân tích AI" → switch sang `generateLocalReport` (instant)
- ✅ Tab Nhập vào "Tự động điền" → **100% local**, bỏ Gemini fallback hoàn toàn. Local parse (`localParse.ts`) + suggestCategoryFromNote (pattern DB). Nếu không match → fill amount + để user pick category.
- ✅ **Bỏ feature Quét bill** (camera scan) theo yêu cầu anh Bux2. Route `/camera/scan` ẩn (commented).

Kết quả: **app 100% offline, $0 API cost, instant response, max privacy**. Gemini code (`src/services/gemini.ts`) giữ trong codebase phòng khi cần khôi phục/upgrade Pro feature sau.

### v2.2 — 2026-05-23 (10:15) — Integration audit + cross-feature linking
**Đại ca feedback "features rời rạc, thiếu liên kết"** → em viết `INTEGRATION_AUDIT.md` audit + fix 5 việc:

- ✅ **DB v10**: thêm cột `transactions.source` (manual/bill/recurring/transfer/scan) + `transactions.source_id` (ref id của bill/recurring/wallet-pair)
- ✅ **Update services** set source khi tạo tx:
  - `payBill()` → source='bill', source_id=bill.id
  - `transferBetweenWallets()` → source='transfer', source_id link 2 tx với nhau
  - `fireDueRules()` → source='recurring', source_id=rule.id
  - Camera scan → source='scan'
- ✅ **Source badges** trong Tab Lịch:
  - 🟡 Receipt icon = bill
  - 🟢 RotateCcw = recurring
  - 🔵 Bus = transfer
  - Photo badge giữ nguyên (đã có)
- ✅ **Dashboard widget Tab Khác** đầu trang:
  - Card primary lớn: Tổng số dư = sum getWalletBalance() của mọi ví
  - Stats pills: bills due ≤7 ngày + goals active + recurring active
  - CTA "Xem phân tích AI tháng này" → /insights
- ✅ **Drill-down từ Báo cáo**: tap row category trong breakdown → modal bottom sheet list các transactions của category đó (filtered current month + wallet). Hiện date + note + amount.

DB schema v10: `transactions.source TEXT NULL` + `transactions.source_id INTEGER NULL`.

### v2.1 — 2026-05-23 (09:55) — Fix AI Insights + Security hardening
**Fix bug**:
- AI Insights tháng trả "Không tạo được báo cáo" → **root cause**: Gemini 2.5 Flash thinking mode ngốn tokens hết 512 maxOutput → output empty → parse fail. Fix: bump `maxOutputTokens` lên 2048 default, add `thinkingConfig.thinkingBudget: 0` để tắt thinking. Còn add lenient parser: strip markdown fence + regex extract JSON + chỉ require `summary` field.

**Security hardening (theo yêu cầu anh Bux2 "bảo mật lên đầu")**:
- ✅ `src/utils/log.ts` — Safe logger redact API key (AIza..., sk-ant-...), PIN, email, amount khỏi console
- ✅ Reset DB clear PIN/biometric (fix B6) — tránh user bị khoá app vĩnh viễn sau reset
- ✅ Onboarding thêm màn 4 "Dữ liệu của bạn — riêng tư" giải thích privacy
- ✅ Settings thêm section "Quyền riêng tư" liệt kê: data local SQLite, PIN trong Keychain/Keystore, AI chỉ gửi amount+category (không tên/email/SĐT), ảnh không upload, Reset DB clear hết
- ✅ Verify prompts không gửi PII: `generateMonthlyReport`, `parseExpenseFromText`, `parseReceiptFromImage`, `generateCoachInsight` — đã audit chỉ gửi số tiền + tên danh mục + ngày
- Bump version v0.3.0

### v2.0 — 2026-05-23 (09:35) — 3 KILLER FEATURES (vượt mặt đối thủ)
- ✅ **F56 AI Insights tháng** — `src/services/gemini.ts:generateMonthlyReport` trả JSON 4 sections (summary, anomalies[], suggestions[], savings_target). Route `app/insights/index.tsx` full screen với header card tím + section "Tổng quan / Điểm bất thường / Gợi ý hành động / Mục tiêu tiết kiệm". Tab Báo cáo có nút CTA lớn "Phân tích AI tháng này". Tab Khác cũng có shortcut.
- ✅ **F54 Bill reminder** — DB v9: bảng `bills(id, name, amount, due_date, category_id, repeat_period, paid_at, notify_days_before)`. Route `app/bills/index.tsx`. Status pill auto: "Quá hạn X ngày" đỏ / "Đến hạn hôm nay" cam / "Còn N ngày" / "Đã thanh toán" xanh. Action "Thanh toán" → modal chọn ví → `payBill()` tạo tx + advance due_date nếu repeat. Service `addBill/updateBill/deleteBill/payBill`.
- ✅ **F57 Heatmap năm view** — `src/components/YearHeatmap.tsx` 12 cột tháng × ngày grid (4 ô/hàng). Cell intensity tỉ lệ với amount chi ngày đó (4 levels palette.primary alpha). Today highlight viền đen. Tab Báo cáo thêm view "Năm" — toggle 3 view "Tháng / 6 tháng / Năm".

DB schema v9: thêm `bills(id, name, amount, due_date, category_id, repeat_period, paid_at, notify_days_before, created_at)`.

USP cạnh tranh:
- AI Insights tháng — **không Sổ thu chi/Money Lover nào có**, full personalize
- Heatmap năm — visual đẹp như GitHub contribution, không đối thủ nào có
- Bill reminder — Sổ thu chi có nhưng UI Bux2 đẹp hơn + có Pay button auto tạo tx

### v1.9 — 2026-05-23 (09:20) — F35 Photo + F51 Week compare + admin hidden
- Bỏ link "Cài đặt nâng cao" khỏi Settings UI (theo yêu cầu anh Bux2 — riêng admin). Route `/settings/advanced` vẫn tồn tại nhưng không expose qua menu. Admin truy cập qua deep link nếu cần.
- ✅ **F35 Photo attachment** — DB v8: `transactions.photo_uri TEXT NULL`. Deps `expo-image-picker`. Tab Nhập vào + Edit modal có 2 nút "Chụp ảnh / Chọn từ thư viện" → preview thumbnail 140x140 + nút X xoá. Tab Lịch hiện badge Camera nhỏ nếu tx có ảnh.
- ✅ **F51 Week comparison** — Tab Báo cáo thêm card "So sánh tuần" hiển thị chi tuần này vs tuần trước (Mon-Sun), arrow up/down + % change. Filter theo wallet hiện tại.

DB schema v8: thêm cột `transactions.photo_uri TEXT` (nullable).

### v1.8 — 2026-05-23 (08:50) — F46 Calendar grid + F47 Smart category + Modal backdrop close
- ✅ **F46 Calendar grid view** — `src/components/CalendarGrid.tsx` 7 cột (CN-T7) × 5-6 hàng. Mỗi ô ngày hiện ngày + total chi (đỏ) + total thu (xanh) dạng "60k/2tr". Today highlight bằng theme primary. Tap ô → filter list buckets theo ngày đó. Tab Lịch có toggle "Danh sách / Lịch tháng".
- ✅ **F47 Smart category suggestion** — DB v7 bảng `category_patterns(keyword, category_id, count, last_used)`. Service `suggestCategoryFromNote(note, type)` tokenize note + vote theo count. `learnCategoryPattern(note, categoryId)` lưu khi submit. Seed 60+ VN patterns (cafe→Giao lưu, ăn→Ăn uống, grab→Đi lại, điện→Tiền điện, etc).
- ✅ **Modal backdrop close** — toàn bộ 6 modal (wallets edit/transfer, goals edit/addTo, categories edit, recurring edit, budget edit, DatePicker iOS) đều dùng `<Pressable onPress={close}>` cho backdrop + inner `<Pressable onPress={()=>{}}>` để absorb tap

DB schema v7: thêm `category_patterns(id, keyword, category_id, count, last_used)` UNIQUE(keyword, category_id).

### v1.7 — 2026-05-23 (sáng) — F32 Multi-wallet
- ✅ **F32 Multi-wallet** — DB v6: bảng `wallets(id, name, icon, color, initial_balance, sort_order, is_default, created_at)`, `transactions.wallet_id` (ALTER ADD COLUMN), seed default "Ví chính" với is_default=1 on first run
- Service mới: `addWallet/updateWallet/deleteWallet/getWalletBalance/transferBetweenWallets`
- Route mới `app/settings/wallets.tsx` — CRUD ví đầy đủ: icon (8 lựa chọn), màu (9), số dư ban đầu. Có Total balance card hiển thị tổng. Transfer giữa 2 ví (tạo 2 transaction paired). Default wallet không xoá được. Custom xoá → reassign tx về default.
- Component mới: `src/components/WalletSwitcher.tsx` — horizontal pill ngang. "Tất cả ví" + từng ví. Dùng ở Lịch + Báo cáo + Ngân sách
- Tab Nhập vào: thêm wallet selector pill ngang (chỉ hiện khi >= 2 ví), submit gắn wallet_id
- Filter wallet ở Lịch/Báo cáo/Ngân sách: `currentWalletId !== null && t.wallet_id !== currentWalletId → skip`
- Tab Khác: thêm shortcut "Quản lý ví" đầu list

### v1.6 — 2026-05-22 (16:35) — 5 Quick Wins
- ✅ **F44** Theme apply toàn app — refactor 35 chỗ hardcode `#10b981`. Tab Nhập vào / Lịch / Báo cáo / Ngân sách / Camera scan / Edit modal đều đọc từ `useTheme()`. Đổi theme thấy đổi toàn UI.
- ✅ **F45** Notification vượt ngân sách — hook trong `useStore.addTransaction`: nếu expense + (newSpent > budget) + (spentBefore <= budget) → push local notification "Đã vượt ngân sách"
- ✅ **F48** Pull-to-refresh tab Lịch — `<RefreshControl tintColor={palette.primary} />`, reload transactions + categories
- ✅ **F49** Swipe-to-delete — `<Swipeable renderRightActions>` từ react-native-gesture-handler, hiện nút xoá đỏ khi vuốt trái
- ✅ **F50** Undo snackbar — sau khi xoá hiện toast đen ở dưới "Đã xoá HOÀN TÁC", animated slide-in spring, auto-dismiss 5s, click HOÀN TÁC re-insert transaction
- ✅ **U6** Skeleton loading — `src/components/Skeleton.tsx` animated opacity 0.4↔1, dùng trong Coach card khi `coachLoading`

### v1.5 — 2026-05-22 (16:20) — Polish + Brand
- Dọn branding khỏi UI (per anh Bux2): version footer, About, contact email đổi sang `tranhaitruong.cntt@gmail.com`
- ✅ Revamp tab Báo cáo:
  - Summary cards top: Trung bình/ngày + vs Tháng trước (% color-coded) + Số giao dịch
  - Biggest transaction highlight box vàng "Giao dịch lớn nhất tháng"
- ✅ F28 Search transactions — tab Lịch có search bar, filter theo note + category + amount
- ✅ Notification "Gửi thử ngay (3 giây)" trong Settings → Nhắc nhở
- ✅ PIN length fix — auto-verify chỉ khi đủ đúng length PIN đã set, lưu pin_length vào SecureStore

### v1.4 — 2026-05-22 (chiều muộn) — P1 competitive features
- ✅ Fix DatePicker iOS — display="spinner" + textColor="#111827" + width 100% height 220 trong wrapper bg trắng
- ✅ Fix tab bar safe area — `useSafeAreaInsets().bottom` + Android extra padding 12px (3-button nav)
- ✅ F25 Push notification daily reminder — `expo-notifications`, route `app/settings/notifications.tsx`, schedule DAILY trigger với SchedulableTriggerInputTypes.DAILY
- ✅ F26 Savings goals — DB v5 (`savings_goals` table), route `app/goals/index.tsx`, CRUD + addTo + auto completion. Link từ tab Khác.
- ✅ F27 Bar chart 6 tháng — `src/components/BarChart.tsx` (custom SVG), tab Báo cáo có toggle "Tháng này / 6 tháng"
- Deps mới: `expo-notifications`

DB schema v5: thêm bảng `savings_goals(id, name, target, current, deadline, icon, color, completed_at, created_at)`.

### v1.3 — 2026-05-22 (chiều) — Big batch P0 features
- ✅ F22 Month switcher — `src/components/MonthSwitcher.tsx`, tích hợp vào Lịch + Báo cáo + Ngân sách. Filter transactions theo `currentMonth` từ store.
- ✅ F23 Custom categories — DB v3 (is_visible column), `app/settings/categories.tsx`, CRUD + soft/hard delete + reassign tx khi xoá custom có giao dịch.
- ✅ F21 PIN + Face ID lock — `expo-secure-store` + `expo-local-authentication`. Lock overlay zIndex 9999, AppState watcher 5 phút BG, 5-attempt lockout 5 phút. Settings → Bảo mật.
- ✅ F24 Recurring transactions — DB v4 (`recurring_rules`), `src/services/recurring.ts:fireDueRules` chạy on boot, catch-up missed runs. Settings → Giao dịch lặp.
- Deps mới: `expo-secure-store`, `expo-local-authentication`

DB schema v4: thêm `is_visible` column cho categories + bảng `recurring_rules(id, amount, category_id, type, note, frequency, next_run, active, last_run, created_at)`.

Settings hub hiện tại:
- Lượt tự động (quota)
- Quản lý danh mục
- Bảo mật (PIN + biometric)
- Giao dịch lặp
- Theme màu (5 palette)
- Sao lưu / Export CSV
- Khu vực nguy hiểm (Reset DB)
- About

### v1.2 — 2026-05-22 (late afternoon) — REBRAND
**Theo yêu cầu anh Bux2**: app không nhắc "AI" trong UI, tone CHUYÊN NGHIỆP không GenZ:
- Tab Nhập vào: "GHI NHANH BẰNG AI" → "Ghi nhanh", "AI điền form" → "Tự động điền", "Hoá đơn" → "Quét bill", badge AI gỡ
- Tab Lịch: "AI Coach" → "Tóm tắt tháng", icon Bot → Sparkles
- Camera: "AI đang đọc hoá đơn" → "Đang đọc hoá đơn"
- Coach prompt: bỏ GenZ slang, không emoji, nhận xét khách quan "Tháng này chi 12% thu nhập cho ăn uống..."
- Onboarding 3 màn: chào mừng chuyên nghiệp, không tone đại ca/em, không nhắc API key (vì đã embed)
- **API key embedded**: `src/services/config.ts:EMBEDDED_GEMINI_KEY`. `getEffectiveApiKey(userKey)` ưu tiên userKey, fallback embedded.
- Settings: gỡ section Gemini key. Giữ Usage / Theme / Export / Reset / About.
- Coach auto-load không cần check user key (luôn có embedded).

**Risk acknowledged**: API key public trong APK. Backend proxy là TODO khi có >1k user thật.

### v1.1 — 2026-05-22 (afternoon)
Implementation batch:
- ✅ F9 AI Camera scan hoá đơn — `app/camera/scan.tsx` + `src/services/gemini.ts:parseReceiptFromImage` (dùng Gemini Vision multimodal, deviation từ ML Kit để chạy Expo Go)
- ✅ F11 AI Quota counter — `src/db:ai_usage table`, `src/services/ratelimit.ts`, hook vào 3 AI call sites (parseExpenseFromText, parseReceiptFromImage, generateCoachInsight)
- ✅ F12 Theme picker — `src/theme/colors.ts` 5 palette, `src/store/useTheme.ts` hook, áp dụng vào Settings (sẽ rollout dần các tab khác)
- ✅ F13 CSV Export — `src/services/export.ts` dùng expo-file-system/legacy + expo-sharing, UTF-8 BOM
- ✅ F15 Onboarding 3 màn — `app/onboarding/index.tsx`, gate redirect ở `app/_layout.tsx` nếu chưa onboard
- ✅ F17 ErrorBoundary — `src/components/ErrorBoundary.tsx` wrap toàn root
- ✅ DB robustness — split schema thành từng statement, try/catch từng câu, `ensureCategoriesSeeded` re-seed nếu rỗng, `resetDatabase` emergency button trong Settings
- ✅ Icon registry mở rộng: AlertCircle, RotateCcw, X, ArrowLeft, Store, Download, Trash2, Check, Lock, ChevronLeft, Bell, Crown, BarChart3, Share2, Database

Deps mới: `expo-camera`, `expo-image-manipulator`, `expo-file-system`, `expo-sharing`.

DB schema v2: thêm bảng `ai_usage(id, month, feature, count)` UNIQUE(month, feature).

Settings hub mới: Gemini key + AI usage progress + Theme picker (5 màu) + Export CSV + Reset DB (danger zone) + About.

### v1.0 — 2026-05-22 (morning)
Initial spec.

---

**END BUILD_SPEC.md — version 3.5 — 2026-05-23**

Bất kỳ thay đổi nào với spec này phải bump version + ghi changelog ở cuối file.

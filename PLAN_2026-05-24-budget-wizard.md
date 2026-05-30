# PLAN — Budget Wizard (Gợi ý chi tiêu thông minh)

**Ngày:** 2026-05-24
**Status:** Chờ duyệt, em chưa code

---

## 1. Concept

Wizard 4 bước → app TỰ gợi ý phân bổ ngân sách cho từng category dựa data thật + mục tiêu tiết kiệm. User không phải đoán mò.

**Pain point hiện tại:**
- Komorebi / Money Pro chỉ cho user SET budget thủ công cho từng category → user không biết phải set bao nhiêu là hợp lý
- Bux2 sẽ là app đầu tiên VN có **AI-style budget recommendation** (rule-based, không cần AI thật)

**USP**:
- Differentiator chính với mọi đối thủ
- Hợp với positioning "Sổ thu chi **thông minh**"

---

## 2. Wizard 4 bước

### Bước 1: Thu nhập tháng
- Auto-detect từ TX income tháng trước (vd 12.000.000đ)
- User có thể override nếu thu nhập đổi
- Có thể chia: lương cứng + thưởng (bonus) + thu khác

### Bước 2: Chi cố định
- App tự liệt kê từ **Recurring rules** + **Bills** đã có
  - Tiền nhà 3.000.000đ (recurring)
  - Internet 200.000đ (bill)
  - Gói data 200.000đ (bill)
- User có thể add/chỉnh thêm
- Tổng fixed cost = X

### Bước 3: Mục tiêu tiết kiệm
- User chọn: **% thu nhập** (mặc định 20%) HOẶC **số tiền cụ thể**
- Liên kết với savings goal nếu có (vd "tiết kiệm 2tr → đủ iPhone trong 15 tháng")
- App cảnh báo nếu unrealistic (vd thu 5tr fixed 4tr saving 2tr → âm)

### Bước 4: Phân bổ ngân sách còn lại
- App tự gợi ý cho mỗi **expense category** dựa quy tắc:
  - **50/30/20 rule** của Elizabeth Warren
  - 50% **NEEDS**: Tiền nhà / Tạp hoá / Tiền điện / Đi lại / Y tế / Phí liên lạc
  - 30% **WANTS**: Ăn uống / Giao lưu / Quần áo / Mỹ phẩm / Giáo dục
  - 20% **SAVINGS** (đã chọn ở bước 3)
- Phân chia tỷ lệ trong nhóm dựa data 3 tháng trước (nếu có) hoặc default
- User có thể slider chỉnh ±20% cho từng category
- App đảm bảo tổng = thu nhập

---

## 3. Engine logic (rule-based, không AI)

```ts
// src/services/budgetRecommender.ts

function recommendBudget(
  income: number,
  fixedExpenses: { categoryId: number; amount: number }[],
  savingsTarget: number,
  history: Transaction[] // 3 tháng trước nếu có
): { categoryId: number; recommended: number; ratio: number; reason: string }[]
```

**Logic:**
1. `availableForVariable = income - sum(fixed) - savings`
2. Nếu có history 3 tháng:
   - Tính avg spend mỗi category → tỷ lệ tương đối
   - Apply ratio đó vào `availableForVariable`
3. Nếu KHÔNG có history (user mới):
   - Apply 50/30/20 default cho từng category theo bảng:
     - Ăn uống: 35% của wants
     - Giao lưu: 25% của wants
     - Quần áo: 15% của wants
     - Mỹ phẩm: 10% của wants
     - Giáo dục: 15% của wants
4. Reason string giải thích vì sao mức đó:
   - "Dựa trên 3 tháng trước, anh thường chi 35% wants cho ăn uống"
   - "Theo quy tắc 50/30/20, Đi lại nên là 15% needs"

**Personalization theo persona (nếu user đã có):**
- Foodie Q1 → tăng Ăn uống budget +10%
- Couch Investor → tăng savings, giảm wants
- Shopaholic → cảnh báo "Quần áo gần limit"

---

## 4. UX flow

### Trigger:
- Tab Ngân sách → CTA mới **"✨ Gợi ý ngân sách"** đầu screen (luôn hiện)
- Onboarding lần đầu user vào tab Ngân sách → auto open wizard
- Settings → "Gợi ý phân bổ" để chạy lại bất kỳ lúc nào

### Screens:

```
┌──────────────────────────────┐
│ Bước 1/4 — Thu nhập tháng    │
│ ████░░░░░░░░░░░░ 25%          │
├──────────────────────────────┤
│ Thu nhập hàng tháng của bạn  │
│                              │
│ Lương cứng                   │
│ [ 12.000.000đ        ] (auto)│
│                              │
│ Thưởng / thu khác (tuỳ chọn) │
│ [ 0đ                 ]        │
│                              │
│         [ Tiếp tục → ]        │
└──────────────────────────────┘
```

```
┌──────────────────────────────┐
│ Bước 2/4 — Chi cố định        │
│ ████████░░░░░░░░ 50%          │
├──────────────────────────────┤
│ Em tự lấy từ giao dịch lặp:  │
│                              │
│ 🏠 Tiền nhà     3.000.000đ ✓ │
│ ⚡ Tiền điện      200.000đ ✓ │
│ 📱 Phí data       200.000đ ✓ │
│                              │
│ [+ Thêm khoản cố định]       │
│                              │
│ Tổng: 3.400.000đ              │
│         [ Tiếp tục → ]        │
└──────────────────────────────┘
```

```
┌──────────────────────────────┐
│ Bước 3/4 — Mục tiêu tiết kiệm │
│ ████████████░░ 75%            │
├──────────────────────────────┤
│ Mỗi tháng muốn để dành:      │
│                              │
│ ⦿ Theo % thu nhập             │
│   [ 10% ] [ 20% ✓ ] [ 30% ]  │
│                              │
│ ○ Số tiền cụ thể              │
│   [ ________ đ ]              │
│                              │
│ = 2.400.000đ/tháng            │
│ → Đủ iPhone 17 sau 13 tháng  │
│                              │
│         [ Tiếp tục → ]        │
└──────────────────────────────┘
```

```
┌──────────────────────────────┐
│ Bước 4/4 — Gợi ý phân bổ      │
│ ████████████████ 100%         │
├──────────────────────────────┤
│ Còn lại 6.200.000đ chia cho:  │
│                              │
│ NEEDS (40%)                   │
│ 🍜 Tạp hoá    1.500.000đ ────│
│ 🚖 Đi lại       800.000đ ────│
│ 💊 Y tế         300.000đ ───│
│                              │
│ WANTS (60%)                   │
│ 🍜 Ăn uống    1.700.000đ ────│
│ 🍻 Giao lưu     900.000đ ───│
│ 👕 Quần áo      500.000đ ──│
│ ✨ Mỹ phẩm      300.000đ ──│
│ 📚 Giáo dục     200.000đ ─│
│                              │
│ Tổng: 6.200.000đ ✓ Khớp       │
│                              │
│  [ Áp dụng vào ngân sách → ]  │
└──────────────────────────────┘
```

Tap "Áp dụng" → tự tạo `Budget` cho từng category với amount đã chọn → quay về tab Ngân sách thấy đã set sẵn.

---

## 5. Files cần build

| File | Mục đích |
|---|---|
| `src/services/budgetRecommender.ts` | Engine logic 50/30/20 + history-based |
| `app/budget-wizard/index.tsx` | Wizard 4 bước (1 file, render theo `step` state) |
| `app/_layout.tsx` | Register route |
| `app/(tabs)/budget.tsx` | CTA "Gợi ý ngân sách" mới |
| `src/i18n/{vi,en,zh}.ts` | Keys mới |

---

## 6. Effort estimate

| Việc | Effort |
|---|---|
| Engine `budgetRecommender.ts` + 50/30/20 logic | 2h |
| Wizard 4 bước + state | 3h |
| CTA + integrate vào tab Ngân sách | 30p |
| i18n + tinh chỉnh | 1h |
| Test smoke + edge cases (income=0, fixed>income) | 30p |
| Spec update | 15p |
| **Tổng** | **~7h** |

---

## 7. Câu hỏi đại ca

1. **Concept OK?** Hay anh muốn flow khác (ít bước hơn / chi tiết hơn)?
2. **Quy tắc 50/30/20** mặc định OK? Hay dùng tỷ lệ khác cho VN (vd 60/20/20 vì lương VN thấp hơn US)?
3. **Personalization theo persona** — em build luôn hay v2 sau?
4. **Wizard trigger ở đâu?**
   - (a) Tab Ngân sách → CTA top (em recommend)
   - (b) Onboarding bước cuối cho user mới
   - (c) Cả 2

---

**Em CHƯA code. Chờ anh confirm 4 câu là bắt đầu build.**

# PLAN — UI Polish & Design System

**Ngày:** 2026-05-23 23:42
**Đại ca feedback**: UI lủng củng, hơi tràn, màu sắc khó nhìn. Cần polish tổng thể.
**Status**: Chờ đại ca duyệt. Em CHƯA code.

---

## 1. Vấn đề em phát hiện qua audit

### A. Color hardcode rải rác
- Nhiều file dùng `#92400e`, `#fef3c7`, `#ecfdf5`, `#dc2626`, `#10b981` trực tiếp thay vì palette token
- Mỗi card warning/success/danger có set màu khác nhau → không nhất quán
- Khi đại ca đổi theme (Sunset/Ocean...) chỉ primary đổi, warning/danger giữ nguyên → trông lệch

### B. Spacing không thống nhất
- padding 14 / 16 / 18 / 20 lẫn lộn — chỗ thì 10, chỗ 12
- marginBottom 6/8/10/12/14/16/20 → không có scale rõ ràng

### C. Typography scale quá nhiều biến thể
- fontSize: 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 44, 56, 72 — **17 size khác nhau**
- Không có hệ thống → reader struggle quét

### D. Card style không đồng nhất
- borderRadius: 8 / 10 / 12 / 14 / 18 → 5 variant
- Card có shadow vs flat lẫn lộn
- Padding nội bộ 12 / 14 / 16 / 18 / 20

### E. Empty states không nhất quán
- Mỗi screen (Bills/Goals/Calendar/Report/Budget) có empty state riêng với icon size 42/56/64
- Wording khác nhau, layout khác nhau

### F. Icon background tint nhạt
- Hiện dùng `color + '20'` (12% opacity) — quá nhạt với một số màu (vàng/cam) → thấp contrast

### G. Tab Nhập quá nhiều element scroll
- Hero streak badge + safe-to-spend card + voice box + type tabs + wallet row + date + amount + note + photo + suggestion + category grid → **11 element** trên 1 màn
- User phải cuộn nhiều → cảm giác tràn

### H. Báo cáo cluttered
- View toggle + chi/thu toggle + summary cards 3 box + pie chart + week comparison + biggest tx + bar chart hết → 1 màn 7 component

---

## 2. Solution — Design System v1

### Tạo `src/theme/tokens.ts` chuẩn:

```ts
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const FONT_SIZE = {
  caption: 11,    // section header, tiny hint
  small: 12,      // sub, secondary
  body: 14,       // default body
  bodyLg: 15,     // primary list item
  title: 17,      // screen title
  titleLg: 20,    // header
  hero: 28,       // big amount safe-to-spend
  display: 44,    // huge number (streak hero)
};

export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

export const SEMANTIC = {
  success: { bg: '#dcfce7', fg: '#16a34a', text: '#065f46' },
  warning: { bg: '#fef3c7', fg: '#d97706', text: '#92400e' },
  danger:  { bg: '#fee2e2', fg: '#dc2626', text: '#991b1b' },
  info:    { bg: '#dbeafe', fg: '#2563eb', text: '#1e3a8a' },
  muted:   { bg: '#f3f4f6', fg: '#6b7280', text: '#374151' },
};
```

Sử dụng:
- `padding: SPACING.lg` thay vì `padding: 16`
- `borderRadius: RADIUS.lg`
- `fontSize: FONT_SIZE.body`
- `backgroundColor: SEMANTIC.success.bg`

→ Đổi theme 1 chỗ → toàn app update.

### Tạo components reusable:

1. **`<Card variant="flat|elevated">`** — wrap thay cho View custom
2. **`<EmptyState icon={...} title={...} desc={...} cta={...}>`** — chuẩn hoá empty
3. **`<SectionHeader>`** — uppercase title cho group
4. **`<StatBox label value icon>`** — replace summary cards trong report

---

## 3. Phase phân chia

### Phase 1 (~1.5h) — Tokens + Components core
- Create `src/theme/tokens.ts` + `src/theme/semantic.ts`
- Create `Card`, `EmptyState`, `SectionHeader`, `StatBox` components
- Migrate Settings + More tab (đã iOS-style) sang tokens
- Migrate SafeToSpendCard, StreakBadge sang tokens

### Phase 2 (~1.5h) — Refactor screens lủng củng
- **Tab Nhập**: gộp wallet+date thành 1 row, group category trong card riêng. Bỏ photo attachment khỏi default view (chỉ hiện nút "thêm ảnh" → tap để expand).
- **Tab Báo cáo**: chia 2 view mode "Tổng quan" (pie + 3 stat) vs "Chi tiết" (drill, trend, biggest). User toggle.
- **Tab Lịch**: empty state dùng EmptyState component.

### Phase 3 (~1h) — Polish details
- Icon background opacity `'20'` → `'25'` (rõ hơn nhưng vẫn tint)
- Audit toàn app, fix hardcode color còn sót
- Test 5 theme khác nhau (Mint/Grape/Sunset/Ocean/Mono) — đảm bảo all theme đẹp

---

## 4. Mock thay đổi mẫu

### TRƯỚC — Settings screen (mỗi card có shadow, radius khác)
```
┌── card radius 14 ──┐  margin 16
│ 🛍 Quản lý danh mục │
│  Thêm/sửa/xoá...   │
└────────────────────┘
┌── card radius 14 ──┐
│ 🔒 Bảo mật          │
└────────────────────┘
```

### SAU — Settings với tokens
```
TÀI KHOẢN
┌── card radius lg ──┐  marginV SPACING.md
│ 🛍 Quản lý danh mục │  padding SPACING.lg
└────────────────────┘
```

### TRƯỚC — Tab Báo cáo (7 component)
- Title + AI CTA + Month + Wallet + View toggle + Type tabs + Summary (3 boxes) + Pie + Week compare + Biggest + Empty

### SAU — Tab Báo cáo (gom 2 view)
- Title + AI CTA + Month + Wallet
- Tab "Tổng quan" / "Chi tiết"
- Trong tab Tổng quan: Pie + 3 StatBox + Biggest
- Trong tab Chi tiết: Trend bar + Heatmap + Drill list

→ Giảm ~30% noise.

---

## 5. Risk & trade-off

**Pros:**
- UI consistent, professional, dễ scale
- Refactor 1 token → toàn app update
- User feedback tích cực hơn (less clutter)

**Cons:**
- Phase 1+2+3 cần ~4h
- Refactor lớn → risk bug nhẹ ở component đã ổn
- TS strict cần update type prop cho components mới

**Cách giảm risk:**
- Migrate từng screen 1 → test → merge
- Giữ palette colors hiện có (Mint/Grape/etc) — chỉ chuẩn hoá spacing/typography/radius
- Tạo branch nháp test trước

---

## 6. Câu hỏi anh Bux2 chọn

1. **Có muốn em build Phase 1 ngay không?** (~1.5h — tokens + 4 component core + migrate Settings/SafeToSpend/Streak)
2. **Phase 2 sau khi anh xem Phase 1?** (~1.5h — refactor Tab Nhập + Báo cáo)
3. **Phase 3 cuối ngày?** (~1h — polish details)

Hoặc gộp 1 phát ~4h?

Em chia Phase để anh duyệt từng cái cho an toàn — nhỡ Phase 1 anh không ưng thì còn xoay.

---

**EM CHƯA CODE GÌ. Chờ anh trả lời 3 câu trên.**

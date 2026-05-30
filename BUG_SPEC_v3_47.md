# Bug Spec v3.47 — Ghi nhanh sót case + Persona dời chỗ + Huỷ danh mục

**Date**: 2026-05-24 09:10
**Trigger**: Đại ca test trên iPhone, báo 4 lỗi cùng lúc.

---

## Bug 1 — Ghi nhanh: "30 ăn sáng" → note dính số

### Hiện trạng
User gõ `"30 ăn sáng"` trong ô GHI NHANH → bấm Tự động điền:
- Số tiền: 30.000đ ✅ (parseAmountLocal đoán đúng: số rời 1-3 chữ số × 1000)
- Ghi chú: `"30 ăn sáng"` ❌ (lẽ ra phải là `"Ăn sáng"`)
- Danh mục: trống ❌ (suggest từ "30 ăn sáng" miss)

### Root cause
`src/utils/localParse.ts:57-68` — function `extractNoteLocal` chỉ strip số khi có suffix đơn vị:
```ts
s.replace(/\d+(?:[.,]\d+)?\s*(?:tr|triệu|k|nghìn|...)\b/gi, '');  // có suffix
s.replace(/\d{4,}\s*đ?/g, '');  // số ≥ 4 chữ số
```
→ Số "30" không có suffix `k` + không đủ 4 chữ số → giữ nguyên trong note.

### Fix
Thêm 1 rule strip cuối: số nguyên rời (1-3 chữ số) đứng đầu hoặc cuối câu, có space ngăn cách → cũng strip.

**Logic mới** (sau các rule hiện có):
```ts
// "30 ăn sáng" → "ăn sáng" / "ăn sáng 30" → "ăn sáng"
s = s.replace(/\b\d{1,3}\b/g, '');
```
Đặt SAU các rule có suffix (để không strip "1tr" trước khi rule "tr" chạy).

### Test cases
| Input | Expected note |
|---|---|
| `30 ăn sáng` | `Ăn sáng` |
| `ăn trưa 60k` | `Ăn trưa` |
| `lương 10tr` | `Lương` |
| `cafe 30k buổi sáng` | `Cafe buổi sáng` |
| `60 cafe` | `Cafe` |

---

## Bug 2 — "Lương 10tr" có khi không auto-fill danh mục

### Hiện trạng
Cùng 1 câu `"Lương 10tr"`, có khi danh mục "Lương" tự chọn, có khi để trống.

### Root cause (giả thuyết, cần verify)
1. `extractNoteLocal("Lương 10tr")` → `"Lương"`
2. `suggestCategoryFromNote("Lương", "income")` chạy fuzzy match qua TF-IDF + keyword list
3. Confidence có thể < 0.4 (threshold) → reject → danh mục trống

Cần đọc `suggestCategoryFromNote` để verify lý do confidence biến động (có thể phụ thuộc lịch sử user — chưa có TX nào → fallback heuristic yếu).

### Fix (đề xuất)
- Lower threshold xuống 0.3 cho TH note rất ngắn (1-2 từ) — high precision keyword match
- HOẶC: thêm hardcoded keyword map cho income: `lương|salary` → "Lương", `thưởng|bonus` → "Thưởng", `tip` → "Tip"
- Default behavior: nếu type = income + note chứa từ khoá "lương/thưởng/tip" → ép match danh mục cùng tên

**Khuyến nghị**: dùng hardcoded map (đơn giản, deterministic, 100% reproducible) cho 3 keyword income chính. Fallback về suggest engine cho các case khác.

---

## Bug 3 — Set danh mục: không huỷ chọn được

### Hiện trạng
User tap chọn "Ăn uống" → muốn đổi sang "Cafe" thì chỉ tap đè được. Muốn BỎ chọn hoàn toàn (categoryId = null) thì không có cách.

### Root cause
`app/(tabs)/index.tsx` category grid hiện chỉ `onPress={() => setCategoryId(c.id)}`.
Không có logic toggle.

### Fix
Tap lại danh mục đang active → deselect:
```tsx
onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
```

Visual feedback: danh mục active vẫn có border + nền primary (như hiện tại). Tap lại = bỏ về trạng thái không chọn.

---

## Bug 4 — Persona card ở tab Báo cáo trông kỳ

### Hiện trạng
Tab Báo cáo có 2 card ở top:
1. "Phân tích chi tiêu tháng này" (xanh đậm)
2. "Persona tháng này — Foodie · Latte Sensei... share lên TikTok" (tím)

→ Đại ca thấy 2 card này hơi nhiều, muốn dời Persona đi nơi khác.

### Đề xuất chỗ dời (3 options)
**Option A — Dời vào tab Khác (Settings hub)**
- Thêm row "🎭 Persona tháng này" ở Settings list
- Tap → mở `/persona/[currentMonth]`
- ✅ Gọn, đại ca yêu cầu thẳng "trong cài đặt"

**Option B — Dời vào màn Summary Today**
- Persona pill nhỏ ở dưới Streak / Bills summary
- ✅ Gắn với daily routine hơn
- ❌ Persona là metric THÁNG, không phải day

**Option C — Floating share button ở góc tab Báo cáo**
- Icon share ở header → tap mở persona modal
- ✅ Giữ context (đang xem report tháng)
- ❌ Discoverability kém

**Khuyến nghị**: Option A. Đại ca đã nói "trong cài đặt hoặc đâu khác" → đi thẳng Settings.

---

## Plan triển khai

### Files thay đổi (5 file)
1. `src/utils/localParse.ts` — fix `extractNoteLocal` strip số rời
2. `src/services/categorySuggest.ts` (hoặc tương đương) — hardcoded map cho income keywords
3. `app/(tabs)/index.tsx` — toggle deselect category
4. `app/(tabs)/insights.tsx` (hoặc file tab Báo cáo) — XOÁ Persona card
5. `app/(tabs)/more.tsx` (hoặc Settings/index) — THÊM row "Persona tháng này"

### TSC strict + i18n vi/en/zh
- i18n key mới: `settings.persona.title` = "Persona tháng này", `settings.persona.subtitle` = "Khám phá tính cách chi tiêu"

### Risk
- Bug 1 fix có thể strip nhầm năm/tuổi trong note (vd "mua áo 25" → "Mua áo"). Acceptable vì context app finance — số rời thường là amount.
- Bug 2 hardcoded map: chỉ cover VI keyword. Locale `en` cần thêm map riêng (sau).

### Definition of Done
- [ ] `30 ăn sáng` → amount 30k + note "Ăn sáng" + cat "Ăn uống"
- [ ] `lương 10tr` → amount 10tr + note "Lương" + cat "Lương" (income) 100% reproducible
- [ ] Tap "Ăn uống" rồi tap lại → categoryId = null
- [ ] Tab Báo cáo chỉ còn card "Phân tích" + filter
- [ ] Settings hub có row "Persona" → tap mở modal persona đúng
- [ ] tsc strict pass

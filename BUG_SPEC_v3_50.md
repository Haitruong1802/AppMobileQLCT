# Bug Spec v3.50 — UI whitespace tab Nhập + Wizard logic savings

**Date**: 2026-05-24 09:42
**Trigger**: Đại ca test trên iPhone (ảnh 9:37 tab Nhập + ảnh 9:39 tab Ngân sách)

---

## Bug 1 — Tab Nhập có whitespace thừa

### Hiện trạng (ảnh 9:37)
- SafeToSpend → GHI NHANH box: ~16-20px gap (ok)
- Bên trong box GHI NHANH: TextInput → button "Tự động điền": gap thừa
- "Tự động điền" → tabs "Chi tiêu/Thu nhập": gap lớn (~20px)
- Tabs → "Ngày": gap (~16px)
- "Ngày" → "Số tiền": gap (~24px)
- "Số tiền" input → "Ghi chú": gap (~16-20px)
- Tổng cộng cảm giác trải dài, phải scroll

### Đại ca muốn
"giao diện chính khoảng thống thừa nhiều ở ghi nhanh và số chi tiêu hôm nay"
→ Compact lại margin/padding giữa các section để xem được nhiều info hơn ở 1 màn.

### Fix
- `voiceBox`: giảm padding 16→12, marginBottom 20→12
- `voiceInput`: marginBottom 8→6
- `voiceBtn`: marginTop 6→4
- `typeTabs`: marginVertical 16→10
- Label "SỐ TIỀN"/"GHI CHÚ"/"DANH MỤC": marginTop 16→10, marginBottom 8→6
- Date field: marginBottom 12→8
- Amount input padding: 16→12
- Note input padding: 14→12

### File
`app/(tabs)/index.tsx` — styles + container paddingBottom

---

## Bug 2 — Budget Wizard dồn extra vào needs/wants, savings bị shrink

### Hiện trạng (ảnh 9:39)
- Đại ca: lương 9tr, chọn savings 20% (=1tr8)
- Recurring có Tiền nhà 3tr → auto-load fixed
- App apply budgets tổng = 8.515.000đ → savings còn 9tr - 8.515tr = 485k (≈ 500k)
- Đại ca tưởng app set savings = 500k → confusion + sai

### Root cause (`src/services/budgetRecommender.ts:191-196`)
```ts
} else if (totalIdeal < availableAfterFixedSavings) {
  // Có dư → bổ sung vào needs trước (50%), wants 50%
  const extra = availableAfterFixedSavings - totalIdeal;
  needsBudget += extra * 0.5;
  wantsBudget += extra * 0.5;
}
```

**Trace** với income=9tr, savings=1.8tr (20%), fixed=[Tiền nhà 3tr]:
- availableAfterFixedSavings = 9tr - 3tr - 1.8tr = 4.2tr
- idealNeeds = 4.5tr, idealWants = 2.7tr
- fixedAsNeeds = 3tr (Tiền nhà ∈ NEEDS) → needsBudget = 1.5tr
- wantsBudget = 2.7tr → totalIdeal = 4.2tr = available → no extra

Hmm CASE NÀY ĐÚNG. Vậy SAO app trả tổng 8.515tr?

**Trace lại** với savings=500k (thay vì 1.8tr):
- availableAfterFixedSavings = 9tr - 3tr - 500k = 5.5tr
- needsBudget = 1.5tr, wantsBudget = 2.7tr, totalIdeal = 4.2tr
- 4.2tr < 5.5tr → extra = 1.3tr → needsBudget += 650k → 2.15tr, wantsBudget += 650k → 3.35tr
- Tổng budget = 3tr fixed + 2.15tr needs + 3.35tr wants = **8.5tr ✓ KHỚP với ảnh**

→ Tức là savings thực tế khi apply là 500k chứ không phải 1.8tr.

### Có 2 lý do có thể:
1. UI Step 3 đại ca chọn nhầm mode custom 500k mà không biết
2. Đại ca chọn pct 20% nhưng đã chỉnh đâu đó khiến savingsPct ≠ 20

**KHÔNG QUAN TRỌNG nguyên nhân** — vì kể cả khi user chọn savings cao, behavior "dồn dư vào needs/wants" là **sai design**:
- Quy tắc 50/30/20 nguyên gốc: **giữ 20% savings cứng**. Nếu dư → cộng vào savings (tăng), không tăng spending.
- Đại ca expect: "tôi nói 20% thì cứ 20%, đừng dồn về chi tiêu".

### Fix
**1. Engine `recommendBudget`**: Bỏ logic dồn extra vào needs/wants. Nếu totalIdeal < availableAfterFixedSavings:
```ts
// v3.50 — Dư → CỘNG VÀO SAVINGS (không tăng spending tự ý)
const extra = availableAfterFixedSavings - totalIdeal;
finalSavings = savingsTarget + extra;
// Giữ needsBudget + wantsBudget ở idealNeeds + idealWants
```

Output `result.savingsTarget` đổi thành `finalSavings` để UI hiển thị đúng.

**2. UI tab Ngân sách**: thêm 1 row "Tiết kiệm/tháng" hiển thị savings từ wizard.
- Lưu savingsTarget vào settings (key: `budget_savings_${month}`) khi apply.
- Tab Ngân sách đọc + hiển thị.

**3. UI Step 3 Wizard**: Khi user TAP preset 20/10/30%, defensive `setSavingsMode('pct')` để chắc chắn mode đồng bộ.

### Files
- `src/services/budgetRecommender.ts` — fix logic extra
- `app/budget-wizard/index.tsx` — defensive set mode + save savings to settings
- `app/(tabs)/budget.tsx` — hiển thị savings row

### Test cases
| Input | savings | needs | wants | tổng |
|---|---|---|---|---|
| 9tr, savings 20%, no fixed | 1.8tr | 4.5tr | 2.7tr | 7.2tr + 1.8tr = 9tr ✓ |
| 9tr, savings 20%, Tiền nhà 3tr | 1.8tr | 1.5tr (+3tr fixed) | 2.7tr | 4.5tr + 2.7tr + 1.8tr = 9tr ✓ |
| 9tr, savings 500k, no fixed | 500k + dư (~1.3tr → 1.8tr) | 4.5tr | 2.7tr | 7.2tr + 1.8tr ≈ 9tr |

### DoD
- [ ] Lương 9tr + savings 20% + Tiền nhà 3tr fixed → savings hiển thị 1.8tr, NOT 500k
- [ ] Tab Ngân sách có row "Tiết kiệm" rõ ràng
- [ ] tsc strict pass

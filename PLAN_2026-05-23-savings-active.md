# PLAN — Mục tiêu tiết kiệm chủ động (Active Savings)

**Ngày:** 2026-05-23 22:15
**Status:** Chờ anh Bux2 duyệt. Em CHƯA code.

---

## 1. Vấn đề anh Bux2 nêu

> "Phát triển thêm cái mục tiêu tiết kiệm. Khi người dùng có mục tiêu tiết kiệm thì thay vì em chỉ làm chẵn số tiền cho người dùng xài chứ đừng 333,333 với lại em sẽ chích 1 khoản nhỏ ra. Hoặc mỗi ngày mà xài không hết em sẽ gợi ý cho người dùng + vô khoản mục đích tiết kiệm luôn chứ đừng để người dùng thụ động nhập."

**3 yêu cầu**:
1. **Làm tròn safe-to-spend** — bỏ số lẻ 333,333 → 330k hoặc 300k
2. **App tự "chích" 1 khoản nhỏ** vào saving goal mỗi ngày (chủ động, không thụ động)
3. **Cuối ngày xài không hết → gợi ý cộng phần dư** vào goal (1 tap accept)

---

## 2. Logic chi tiết

### A. Làm tròn safe-to-spend

**Hiện tại** (`computeSafeToSpend`):
```ts
const safeAmount = Math.max(0, Math.floor(remainingBudget / daysRemaining));
// 8.000.000 / 18 = 444.444đ → user thấy 444.444 (xấu)
```

**Sửa** — làm tròn xuống về bội số 5,000đ (granularity nhỏ) hoặc 10,000đ (đẹp hơn):

```ts
function roundSafe(n: number): number {
  if (n >= 100_000) return Math.floor(n / 10_000) * 10_000; // ≥100k → bội 10k
  if (n >= 10_000) return Math.floor(n / 5_000) * 5_000;    // 10k-100k → bội 5k
  return Math.floor(n / 1_000) * 1_000;                      // < 10k → bội 1k
}
```

Ví dụ:
- 444.444 → **440.000**
- 33.333 → **30.000**
- 7.555 → **7.000**

Phần "dôi ra" (444,444 - 440,000 = 4,444) chuyển thẳng vào **buffer chủ động** ở Bước B.

### B. Auto-allocate sang saving goal mỗi ngày

**Trigger**: khi user mở app mỗi ngày mới (check trong `_layout.tsx` boot, hoặc khi `currentDate` đổi).

**Logic**:
1. Đọc danh sách goals active (`getSavingsGoals().filter(g => !g.completed_at)`)
2. Nếu KHÔNG có goal nào → skip (giữ logic cũ)
3. Nếu có ≥1 goal → tính `dailyAllocation`:
   - **Rounding remainder**: chênh lệch giữa raw safe-to-spend và rounded (vd 4,444)
   - **Daily auto-save**: 5% của safe-to-spend (rounded xuống 1k). Vd: 440k × 5% = 22k → round = 22k
4. Mỗi ngày mới, app TỰ động cộng `(remainder + autoSave)` vào goal gần nhất hoàn thành (hoặc goal user pin) qua `addToSavingsGoal()`
5. Lưu ngày allocation gần nhất vào setting `savings_last_allocation_date` để không double-charge nếu user mở app nhiều lần

**Hiển thị**: trong SafeToSpendCard hoặc subtext nhỏ:
> *"Hôm nay xài thoải mái khoảng 440.000đ"*
> *💰 Đã chích 22.000đ vào mục tiêu **iPhone 17** sáng nay"* (chỉ hiện nếu có goal)

### C. Gợi ý "cộng dư cuối ngày"

**Trigger**: cuối ngày (22:00 push notif local) HOẶC khi user mở app sang ngày mới và hôm qua chi < safe.

**Logic**:
1. Sau khi sang ngày mới, đọc ngày hôm qua:
   - `yesterdayExpense` = sum chi tx ngày hôm qua
   - `yesterdaySafe` = safe-to-spend của hôm qua (lưu snapshot khi tính lần đầu)
   - `unused = yesterdaySafe - yesterdayExpense`
2. Nếu `unused > 10.000đ` → hiện banner trong app HOẶC tab Nhập:
   > *"Hôm qua bạn xài tiết kiệm hơn dự kiến — dư **35.000đ**. Cho vào mục tiêu **iPhone 17** nhé?"*
   > **[ Đồng ý ]** **[ Để dành mai ]**
3. Tap "Đồng ý" → `addToSavingsGoal(goalId, unused)` + notify thành công
4. Tap "Để dành mai" → ẩn banner, không lưu

**Lưu snapshot**:
- Cần lưu `daily_safe_snapshot` mỗi ngày để biết hôm qua safe là bao nhiêu
- Có thể lưu trong table mới `daily_snapshots(date, safe_amount, allocated, used)`

### D. Settings cho user kiểm soát

User cần option để bật/tắt auto-allocate:

**Settings → Mục tiêu tiết kiệm**:
- Toggle: **"Tự chích vào mục tiêu mỗi ngày"** (default ON nếu có goal)
- Slider: **Tỷ lệ tự chích** (3% / 5% / 10% / Tuỳ chỉnh)
- Goal nào nhận: **Goal đang chạy** (chọn 1 goal mặc định nếu có nhiều)
- Toggle: **"Gợi ý cộng dư cuối ngày"** (default ON)

---

## 3. DB schema cần thay đổi

### Bảng mới: `daily_snapshots`
```sql
CREATE TABLE IF NOT EXISTS daily_snapshots (
  date TEXT PRIMARY KEY,         -- YYYY-MM-DD
  safe_amount INTEGER NOT NULL,
  expense_amount INTEGER NOT NULL DEFAULT 0,
  auto_allocated INTEGER NOT NULL DEFAULT 0,
  manual_added INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Settings keys mới:
- `savings_auto_enabled` = '1' | '0' (default '1')
- `savings_auto_pct` = '5' (3/5/10 hoặc custom 1-20)
- `savings_default_goal_id` = ID của goal nhận tự chích
- `savings_suggest_enabled` = '1' | '0' (default '1')
- `savings_last_allocation_date` = YYYY-MM-DD

---

## 4. Files sẽ sửa

| File | Sửa gì |
|---|---|
| `src/db/index.ts` | Thêm migration tạo `daily_snapshots` (v13) |
| `src/services/safeToSpend.ts` | Thêm `roundSafe()` helper + apply trong `computeSafeToSpend` |
| `src/services/activeSavings.ts` (mới) | Logic auto-allocate + suggest unused |
| `app/_layout.tsx` | Boot hook: check ngày mới → call activeSavings.runDailyAllocation() |
| `src/components/SafeToSpendCard.tsx` | Hiện dòng "💰 Đã chích Xđ vào goal Y" nếu có |
| `src/components/UnusedSuggestionBanner.tsx` (mới) | Banner gợi ý cộng dư cuối ngày |
| `app/(tabs)/index.tsx` | Render banner nếu có suggestion |
| `app/settings/savings.tsx` (mới) | Settings page cho active savings |
| `app/settings/index.tsx` | Add entry "Mục tiêu tiết kiệm" |
| `src/i18n/{vi,en,zh}.ts` | Thêm keys: `savings.autoAllocated`, `savings.unusedSuggest`, etc. |

---

## 5. UX Mock

### Tab Nhập với active savings:

```
┌─────────────────────────────────┐
│ Ghi chi                  🔥 12 │
├─────────────────────────────────┤
│ Chiều nay xài thoải mái          │
│     440.000đ                     │
│ Bạn iu yên tâm, còn 18 ngày      │
│ 💰 Đã chích 22k vào "iPhone 17"  │
└─────────────────────────────────┘

(Nếu có gợi ý cộng dư hôm qua:)
┌─────────────────────────────────┐
│ 💛 Hôm qua bạn dư 35.000đ        │
│ Cho vào mục tiêu "iPhone 17" nhé?│
│ [ Đồng ý ] [ Để dành mai ]       │
└─────────────────────────────────┘
```

### Settings → Mục tiêu tiết kiệm:

```
☑ Tự chích vào mục tiêu mỗi ngày
   Tỷ lệ:  ○ 3%  ⦿ 5%  ○ 10%  ○ Tuỳ chỉnh
   Goal nhận: [▼ iPhone 17 — 30%]

☑ Gợi ý cộng dư cuối ngày
   Khi xài ít hơn dự kiến, app sẽ gợi ý cộng phần
   dư vào mục tiêu — 1 tap để chấp nhận
```

---

## 6. Effort estimate

| Task | Effort |
|---|---|
| Bảng `daily_snapshots` + migration | 15p |
| `roundSafe()` helper + apply | 15p |
| `activeSavings.ts` service (auto-allocate logic) | 1h |
| Hook boot run daily allocation | 30p |
| Banner gợi ý cộng dư | 45p |
| Settings savings screen | 1h |
| i18n keys (vi/en/zh) | 30p |
| Test smoke + stress simulation 30 ngày | 30p |
| Update BUILD_SPEC | 15p |
| **Tổng** | **~5h** |

---

## 7. Câu hỏi anh Bux2 trả lời em mới build

1. **Tỷ lệ auto-chích mặc định** — 5% OK chứ? Hay 3% an toàn hơn cho user mới?
2. **Khi có nhiều goal active**, app chọn goal nào để chích?
   - (a) Goal gần hoàn thành nhất (sắp về đích)
   - (b) Goal user pin/đánh dấu mặc định trong settings
   - (c) Chia đều cho tất cả goal active
3. **Granularity làm tròn safe-to-spend**:
   - (a) 440.000 (bội 10k) — đẹp
   - (b) 445.000 (bội 5k) — gần với raw hơn
   - (c) 444.000 (bội 1k) — gần nhất
4. **Banner gợi ý cộng dư cuối ngày** hiện ở đâu:
   - (a) Tab Nhập trên cùng (đập vào mắt user)
   - (b) Notification 22h tối → tap vào → mở app
   - (c) Cả hai

---

**EM CHƯA CODE GÌ. Chờ anh Bux2 trả lời 4 câu rồi em build.**

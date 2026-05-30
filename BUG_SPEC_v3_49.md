# Bug Spec v3.49 — Streak phải tính theo `created_at`, không phải `date`

**Date**: 2026-05-24 09:30
**Trigger**: Đại ca test trên iPhone (ảnh 9:26).

---

## Hiện trạng (sai)

`src/services/streak.ts` recomputeStreak query:
```sql
SELECT DISTINCT date FROM transactions ORDER BY date DESC
```
→ Streak đếm theo **TX.date** (ngày của giao dịch, user chọn).

`src/components/StreakBadge.tsx` line 56:
```ts
const txDateList = useMemo(() => transactions.map((t) => t.date), [transactions]);
```
→ Lịch tô ngày theo **TX.date**.

### Hậu quả (đại ca test)
- Hôm nay 24/5, anh nhập TX với date = 12/5 (đổi date về quá khứ)
- Lịch streak tô **ngày 12** cam → đại ca không muốn
- Sau đó xoá TX hôm nay → lastActive = 12/5 → today 24/5, gap = 12 ngày → display = 0 "Chuỗi đã gãy"
- Vẫn còn dot vàng ở ngày 24 (today indicator) → confusing

### Đại ca muốn
> "lịch đó dành cho đúng ngày nhập chi tiêu chứ"

→ Streak là **commitment habit metric** = số ngày user thực sự MỞ APP + GHI SỔ liên tiếp.
→ Phải dùng `created_at` (timestamp DB tự sinh), không phải `date` (TX date có thể là quá khứ).

---

## Fix plan

### File 1 — `src/services/streak.ts`
Thay query trong `recomputeStreak`:
```ts
const dateRows = await db.getAllAsync<{ date: string }>(
  "SELECT DISTINCT DATE(created_at, 'localtime') AS date FROM transactions ORDER BY date DESC"
);
```
SQLite `'localtime'` modifier convert UTC → device timezone.

Thêm helper export `createdAtLocalDate(createdAt: string)` để StreakBadge dùng (cùng logic, đảm bảo nhất quán).

### File 2 — `src/components/StreakBadge.tsx`
Thay line 56:
```ts
const txDateList = useMemo(
  () => transactions.map((t) => createdAtLocalDate(t.created_at)),
  [transactions]
);
```
→ Lịch tô theo created_at, không phải date.

### Test cases (sau fix)
| Action | activeDates | streak | Lịch tô |
|---|---|---|---|
| Nhập 1 TX hôm nay 24, date=24 | {24} | 1 | 24 |
| Nhập 1 TX hôm nay 24, date=12 (lùi) | {24} | 1 | 24 |
| Xoá TX trên, không còn TX | {} | 0 | (không) |
| Ngày mai 25 nhập, date=10 | {24, 25} | 2 | 24, 25 |

### Risk
- `created_at` có format `"YYYY-MM-DD HH:MM:SS"` (UTC). SQLite `DATE(.., 'localtime')` chuẩn cho expo-sqlite.
- StreakBadge dùng `t.created_at` từ Zustand → đã có sẵn trong type Transaction.
- Backward compat: data cũ vẫn có created_at (default datetime('now')) → không cần migration.

### DoD
- [ ] Nhập TX date quá khứ → lịch CHỈ tô today (created_at)
- [ ] Streak = số ngày KHÁC NHAU user mở app + ghi (theo created_at local)
- [ ] tsc strict pass

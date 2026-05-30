# WORKLIST đêm 2026-05-24 — Tối ưu Bux2 khi đại ca ngủ

**Quy tắc tự work:**
- Mỗi iteration làm 1 việc ✓ check vào list này
- LOW-RISK only: KHÔNG sửa logic core (DB schema, payment, security)
- Sau mỗi việc: tsc strict pass + ghi changelog vào BUILD_SPEC v3.37+
- Skip việc nào risky hoặc cần đại ca quyết
- Tránh feature mới — chỉ POLISH + REFACTOR + BUG FIX

---

## A — Polish UI nhẹ (~1h tổng)

- [ ] **A1**: Migrate `app/(tabs)/more.tsx` sang dùng `tokens` + `SectionHeader` cho dashboard card. Loại bỏ hardcode `#10b981` còn sót.
- [ ] **A2**: Migrate `app/(tabs)/index.tsx` (tab Nhập) — replace hardcode padding/font/radius bằng tokens. Visual KHÔNG đổi.
- [ ] **A3**: Migrate `app/(tabs)/report.tsx` (tab Báo cáo) — 3 summary card dùng `<StatBox>` component thay inline.
- [ ] **A4**: Migrate `app/(tabs)/budget.tsx` — overview 3 box dùng `<StatBox>`.
- [ ] **A5**: Migrate `app/summary/today.tsx` — 3 mini stat dùng `<StatBox>`.

## B — Cleanup code (~30p)

- [ ] **B1**: Tìm + xoá unused imports trong các file đã refactor (Settings, notifications, calendar).
- [ ] **B2**: Move common `notify(msg)` helper trong nhiều file → 1 helper chung `src/utils/notify.ts`.
- [ ] **B3**: Verify mọi screen empty state có thể migrate sang `<EmptyState>` component → áp dụng cho calendar (đã có), bills, goals.

## C — Bug fix nhỏ (~30p)

- [ ] **C1**: Verify tab Lịch — kéo lên trên cùng `RectButton` có hoạt động đúng không. Test edge case scroll.
- [ ] **C2**: Audit toàn bộ Modal: kiểm 3-4 modal (reset DB, savings cộng tiền, goal create) — đảm bảo pattern `<View>[<Pressable absoluteFill close />, <View sheet>]` đã áp dụng đồng bộ.
- [ ] **C3**: Check `displayCategoryName()` được dùng nhất quán — tìm các chỗ còn render `c.name` raw thay vì qua helper.

## D — Test infrastructure (~30p)

- [ ] **D1**: Mở rộng `scripts/smoke-test.ts` thêm test cho `activeSavings.splitByTargetRatio` (3 case: 1 goal, multi goal đều, multi goal lệch ratio).
- [ ] **D2**: Mở rộng `scripts/stress-test.ts` simulate user dùng app với active savings: tạo 2 goal khác target → 30 ngày dùng → verify goal.current chia đúng tỷ lệ + tổng cộng đúng.

## E — Docs (~30p)

- [ ] **E1**: Update `BUILD_SPEC.md` section TL;DR — viết lại tóm tắt v3.x cho clean.
- [ ] **E2**: Tạo `CHANGELOG.md` ngắn gọn (separate khỏi BUILD_SPEC) chỉ list version + 1 dòng mỗi version. Tổng 36 version.

---

## Mục tiêu sáng anh dậy

- Tab Nhập + Báo cáo + Ngân sách + Tab Khác + Summary screen: TOÀN BỘ migrate sang tokens (Phase 1 polish hoàn chỉnh)
- Số file dùng tokens: từ 3 (hiện) → ~12
- Common helper notify → 1 chỗ duy nhất
- 2-3 test mới (smoke + stress)
- CHANGELOG.md sạch sẽ
- tsc strict pass mọi version
- KHÔNG breaking change UI — anh test sẽ thấy giống y v3.36

## Nếu em gặp vấn đề

- Skip việc đó, đánh dấu `[blocked]` + lý do trong WORKLIST này
- Tiếp việc kế
- Sáng anh dậy review file này để biết em đã làm gì + skip gì

---

**Cách trigger:**

Anh chạy lệnh sau trước khi đi ngủ:

```
/loop tiếp tục tối ưu Bux2 — đọc D:/CLAUDE/BopAI/WORKLIST_TONIGHT.md, pick 1 việc CHƯA CHECK, làm xong tsc pass, commit changelog vào BUILD_SPEC, check ✓ vào WORKLIST. Lặp tới khi hết list hoặc gặp việc blocked. KHÔNG breaking change UI.
```

→ Claude sẽ tự loop, mỗi vòng ScheduleWakeup tự pace tới khi hết list. Sáng anh dậy mở app + đọc BUILD_SPEC để xem em đã làm gì.

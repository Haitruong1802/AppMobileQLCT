# Refactor defer sang session sau (v3.124+)

Hai file lớn còn lại — em đề nghị làm trong session **riêng biệt** vì risk break import chuỗi cao.

## 1. `src/db/index.ts` (1421 dòng)

**Hiện tại**: 1 file monolithic chứa schema setup, migrations, types, và CRUD cho 8 table.

**Plan tách**:
```
src/db/
├── index.ts              # Barrel re-export (giữ backward compat 16+ imports)
├── client.ts             # getDb() + initialization + PRAGMA + migrations
├── schema.ts             # SCHEMA SQL (đã có)
├── types.ts              # Category, Transaction, Wallet, Book, Bill, etc.
├── migrations/
│   ├── runAll.ts         # Orchestrator
│   ├── catRename.ts      # v3.94 cat_invest_rename_v1
│   ├── savingsNs.ts      # v3.108 savings_book_ns_v2
│   ├── isImpulse.ts      # v3.120 is_impulse seed
│   └── patternSeed.ts    # pattern_seed_version
└── queries/
    ├── categories.ts     # getCategories, addCategory, updateCategory, deleteCategory, etc.
    ├── transactions.ts   # getTransactions, addTransaction, transferBetweenWallets, etc.
    ├── budgets.ts        # getBudgets, setBudget, clearBudgetsForMonth, etc.
    ├── wallets.ts        # getWallets, addWallet, getWalletBalance, etc.
    ├── books.ts          # getBooks, addBook, deleteBook, etc.
    ├── bills.ts          # getBills, addBill, payBill, etc.
    ├── goals.ts          # getSavingsGoals, addSavingsGoal, addToSavingsGoal, etc.
    ├── recurring.ts      # getRecurringRules, addRecurringRule, etc.
    ├── snapshots.ts      # getSnapshot, saveSnapshot, etc.
    └── patterns.ts       # suggestCategoryFromNote, learnCategoryPattern, seedDefaultPatterns
```

**Risk**: 16+ file import từ `'../../src/db'`. Barrel re-export đúng cấu trúc cũ.

**Steps**:
1. Tạo cấu trúc folder + file mới
2. Move code từng entity từ `db/index.ts` sang file riêng
3. Sửa `db/index.ts` thành barrel re-export
4. Run `tsc --noEmit` sau mỗi entity move
5. Run app thật trên Expo Go verify boot OK (migrations chạy đúng)

**Ước tính**: 2-3 giờ work, 1 session riêng.

---

## 2. `app/(tabs)/index.tsx` (883 dòng)

**Hiện tại**: 1 file chứa form input, voice parse, photo picker, cool-down, month review, safe-to-spend rendering.

**Plan tách**:
```
app/(tabs)/index.tsx                       # Giữ shell + composition
src/components/TransactionForm.tsx         # Form chính (amount/category/wallet/date/note)
src/components/QuickInputBox.tsx           # Voice/text quick parse
src/components/PhotoSection.tsx            # Camera/gallery picker + preview + remove
src/hooks/useVoiceParse.ts                 # tryVoiceParse logic
src/hooks/usePhotoPicker.ts                # pickPhoto/takePhoto + resize
src/hooks/useTransactionSubmit.ts          # submit + doSubmit + cooldown trigger
src/hooks/useMonthReview.ts                # detect + show month review modal
```

**Risk**: Trung bình. Tab index không bị import từ file khác (chỉ là screen). Risk là logic dependency giữa state/handler.

**Steps**:
1. Extract `useVoiceParse` hook (state isolation tốt)
2. Extract `usePhotoPicker` hook
3. Extract `TransactionForm` component (props down)
4. Test focus state, keyboard behavior, đặc biệt double-tap submit

**Ước tính**: 2-3 giờ work, 1 session riêng.

---

## Tại sao defer (không làm trong cùng session)?

1. **Risk reset**: 1 sai sót break compile = 30+ phút debug, có thể leak vào commit
2. **Test path**: Cần manual test E2E trên Expo Go sau mỗi entity move (boot, ghi TX, lock app, multi-book switch)
3. **Context budget**: Mỗi file split tốn ~5k token, session hiện đã làm rất nhiều
4. **Maintainability ≠ urgent**: User không thấy benefit; chỉ developer/AI agent thấy

## Khi nào làm

Sau khi:
- App ship Play Store closed beta
- User feedback ổn định
- Có nguyên 1 session 2-3 giờ rảnh để dedicate

Cứ giữ stable v3.123 cho production-ready trước, refactor sau.

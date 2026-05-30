# Plan fix Settings + tab Khác (v3.115)

Audit ngày 2026-05-27. Anh Bu Bu phàn nàn: "tab khác với tất cả cài đặt loạn, chức năng thiếu, logic lỗi, kích thước tùm lum".

Chuẩn UI từ `app/(tabs)/more.tsx`:
- topbar padding 16, border-bottom `#f3f4f6`
- backBtn 32×32
- title `fontSize: 18, fontWeight: 700, color: #111827`
- iconBox 40×40 borderRadius 20
- item padding 14, gap 12, marginBottom 8, backgroundColor `#f9fafb`, borderRadius 12
- sectionTitle fontSize 11 uppercase
- itemName fontSize 14, itemSub fontSize 11

---

## Round 1: Visual + em-dash (nhanh)

### 1A. Title fontSize 17 → 18
| File | Line | Fix |
|---|---|---|
| `app/settings/language.tsx` | 112 | `fontSize: 17 → 18` |
| `app/settings/savings.tsx` | 255 | `fontSize: 17 → 18` |

### 1B. iconBox/sectionIcon → 40×40
| File | Line | Hiện tại | Fix |
|---|---|---|---|
| `app/settings/categories.tsx` | 363 | `iconBox: 36×36 r18` | `40×40 r20` |
| `app/settings/books.tsx` | 281 | `bookIcon: 48×48 r24` | `40×40 r20` |
| `app/settings/savings.tsx` | 285 | `sectionIcon: 36×36 r18` | `40×40 r20` |
| `app/settings/notifications.tsx` | 414 | `sectionIcon: 36×36 r18` | `40×40 r20` |
| `app/settings/security.tsx` | 286 | `sectionIcon: 36×36 r18` | `40×40 r20` |
| `app/settings/salary.tsx` | 276 | `sectionIcon: 36×36 r18` | `40×40 r20` |
| `app/settings/advanced.tsx` | 105 | `sectionIcon: 36×36 r18` | `40×40 r20` |

### 1D. Em-dash trong UI strings → dấu phẩy hoặc bỏ
- `savings.tsx:139` "bị động — gồm" → "bị động, gồm"
- `savings.tsx:201` "mục tiêu — 1 tap" → "mục tiêu, 1 tap"
- `savings.tsx:236` "thực — bạn vẫn xài" → "thực, bạn vẫn xài"
- `notifications.tsx:189` "9h sáng — nhắc" → "9h sáng, nhắc"
- `notifications.tsx:255` "streak — 1 phút" → "streak, 1 phút"
- `notifications.tsx:322` "10:00 sáng — nhận xét" → "10:00 sáng, nhận xét"

---

## Round 2: Modal style → pageSheet (UX lớn)

Chuyển 3 file từ `transparent + Pressable bottomsheet` sang `presentationStyle="pageSheet"` giống wallets/goals — kéo xuống mượt native iOS.

### Files
- `app/settings/books.tsx:182` modal edit/create book
- `app/settings/recurring.tsx:220` modal edit/create rule
- `app/settings/categories.tsx:222` modal edit/create category

### Pattern thay thế
```tsx
// CŨ
<Modal visible={!!editing} transparent animationType="slide" onRequestClose={...}>
  {editing ? (
    <Pressable style={styles.modalBg} onPress={() => setEditing(null)}>
      <Pressable style={styles.modalCard} onPress={() => {}}>
        <ScrollView>...</ScrollView>
      </Pressable>
    </Pressable>
  ) : <View />}
</Modal>

// MỚI
<Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={...}>
  {editing ? (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.modalCard}>
        <ScrollView keyboardShouldPersistTaps="handled">...</ScrollView>
      </View>
    </SafeAreaView>
  ) : <View />}
</Modal>
```

### Style update
- `modalCard`: bỏ `borderTopLeftRadius/borderTopRightRadius/maxHeight`, thêm `flex: 1, padding: 20`
- Bỏ `modalBg` style (không dùng)
- Bỏ import `Pressable` nếu hết dùng

---

## Round 3: Thêm i18n cho 6 màn (lớn nhất)

### Tình trạng hiện tại
| File | useT? | Notes |
|---|---|---|
| `security.tsx` | ❌ | `security.*` keys đã có trong `vi.ts`, chỉ thiếu import + replace |
| `notifications.tsx` | ❌ | `notif.*` keys đã có, thiếu import + replace |
| `wallets.tsx` | ❌ | Chưa có `wallets.*` keys, phải add mới |
| `savings.tsx` | ❌ | Chưa có `savings.*` keys, phải add mới |
| `books.tsx` | ❌ | Chưa có `books.*` keys, phải add mới |
| `advanced.tsx` | ❌ | DEV-only, skip i18n (chỉ 5 strings) |

### Thêm keys vào `src/i18n/vi.ts` (và en/zh fallback tiếng Việt khi thiếu)
- `wallets.*`: title, total, default, addBtn, transferBtn, editTitle, createTitle, nameLabel, namePlaceholder, balanceLabel, iconLabel, colorLabel, transferTitle, fromWallet, toWallet, amount, date, note, ...
- `savings.*`: title (đổi sang "Tự động tiết kiệm"!), warnNoGoals, infoGoals, autoSave, autoSaveDesc, pctLabel, suggest, suggestDesc, notif22, notif22Desc, foot
- `books.*`: title, intro, switchHint, defaultTag, currentUsing, addBtn, editTitle, createTitle, nameLabel, namePlaceholder, deleteMsg

### Approach
Vì thời gian + scope lớn, em chỉ:
1. Add `useT` import + `useT()` call vào 5 files (security/notifications/wallets/savings/books)
2. Replace TẤT CẢ hardcoded VN strings ở user-visible text (Text, placeholder, notify msg) bằng `t('key')`
3. Add tất cả key mới vào `vi.ts` 
4. `en.ts` + `zh.ts`: fallback `vi.ts` qua cơ chế đã có sẵn (i18n.ts:37 `?? vi[key]`). KHÔNG cần dịch ngay, để sau hoàn thiện dần như `language.note` đã ghi.

---

## Round 4: Logic fix

### 4E.1 — `savings.tsx:106` title trùng tên với `/goals`
- Hiện: title = "Mục tiêu tiết kiệm"
- Fix: title = "Tự động tiết kiệm" (khớp menu key `more.activeSavings`)

### 4E.2 — `savings.tsx:54-63` notifEnabled chỉ load 1 lần
- Hiện: `useEffect([])` chỉ chạy mount
- Fix: Thêm `useFocusEffect` để re-sync khi quay lại screen từ Settings hệ thống

---

## Round 5 (cleanup): Bump version

- `BUILD_SPEC.md`: v3.114 → v3.115
- Note: visual cleanup + modal pageSheet + i18n 5 màn + logic savings

---

## Acceptance

- [ ] TypeScript compile sạch (`npx tsc --noEmit`)
- [ ] Tất cả title fontSize = 18
- [ ] Tất cả iconBox/sectionIcon = 40×40
- [ ] Books/Recurring/Categories modals kéo xuống mượt
- [ ] Không còn em-dash trong UI text
- [ ] Switch sang EN/ZH, 5 màn settings vẫn render (có fallback vi)
- [ ] Tab Khác → Tự động tiết kiệm → title đúng "Tự động tiết kiệm"

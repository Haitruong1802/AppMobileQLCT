# Plan: Smart Notifications + Reset DB UX 2026-05-23 11:50

> Anh Bux2 yêu cầu 2 việc. Em viết plan trước theo process mới.

---

## 1. Smart Notifications dựa data

### 1.1 Hiện trạng

App có 1 daily reminder generic: "Bux2 nhắc bạn — Hôm nay đã chi gì? Mở app ghi 5 giây."

→ Khô khan, không cá nhân hoá. User dễ tắt vì repetitive.

### 1.2 Mục tiêu

Thông báo "ghẹo" dựa data user:
- "Tháng này uống trà sữa 1.2tr rồi, đủ mua tai nghe Sony sau 5 tháng nha 🎧"
- "Cafe Highlands tuần này 500k, dắt bạn iu đi ăn buffet 1 bữa được rồi đó"
- "Chi tiêu tăng 40% so tháng trước, có gì xảy ra hông bạn iu?"

### 1.3 Loại trigger

| Trigger | Tần suất | Nội dung |
|---------|---------|---------|
| **Daily reminder** (đã có) | 21:00 mỗi ngày | Generic nhắc ghi |
| **Weekly nudge mới** | Chủ nhật 10:00 | Cá nhân hoá từ data tuần |
| **Over-budget** (đã có) | Realtime khi vượt | Cảnh báo ngân sách |
| **Smart insight nudge mới** | 1 lần/tuần random | Top category sass message |

### 1.4 Cài đặt → Nhắc nhở (UI mới)

Page `app/settings/notifications.tsx` nâng cấp:
- ✅ Nhắc ghi chi tiêu hàng ngày (đã có) — toggle + giờ
- ✅ Thử gửi ngay (đã có)
- 🆕 **Tóm tắt tuần** (Chủ nhật 10:00) — toggle
- 🆕 **Nhận xét ghẹo cá nhân hoá** (1 lần/tuần) — toggle
- ✅ Notification vượt ngân sách (đã có, không hiện toggle vì luôn bật khi user set budget)

### 1.5 Implementation

**File mới**: `src/services/smartNudge.ts`
```ts
// Sinh nội dung nudge từ data tuần/tháng
generateWeeklyNudge(transactions, categories): string
generateSassyMessage(topCat, amount): string
```

**Templates ghẹo** (chỉ random với data thật, KHÔNG sinh AI):
- "{Cafe} tháng này {1.2tr}đ, đủ mua AirPods sau {3} tháng nha 🎧"
- "Tuần này {ăn uống} {500k}đ, gấp đôi tuần trước rồi á 😅"
- "Chi {35%} thu nhập rồi mà mới qua {15} ngày, hơi sớm đại ca ơi 💸"
- "Tháng này tiết kiệm {2tr}, Stanford gọi đây 📞"
- "{Quần áo} mua nhiều rồi đó, tủ đồ chật chưa? 👗"
- "Cuối tuần {50k} chi tiêu thôi à? Có ổn không bạn 😶"

**Schedule mới**:
- `scheduleWeeklyNudge()` — fire Sunday 10:00 với content sinh từ data tuần
- `scheduleWeeklyNudgeFresh()` — re-compute mỗi tuần (vì notification content fixed lúc schedule, cần refresh)

Cách workaround content fixed: dùng `Notifications.AndroidImportance.HIGH` + reschedule mỗi lần mở app nếu nudge chưa fire trong tuần.

### 1.6 Privacy

- Sinh local từ data — KHÔNG gửi server
- KHÔNG include tên user / email
- Notification text generated từ pattern + amount, không có PII

---

## 2. Reset DB UX cải thiện

### 2.1 Hiện trạng

Settings → Khu vực nguy hiểm → "Reset DB (xoá hết)" → confirm dialog "Xoá hết?" → execute.

→ Wording technical, dễ user accidental tap.

### 2.2 Mục tiêu

- Đổi text "Reset DB" → **"Reset dữ liệu"**
- Mô tả: "Dữ liệu sẽ bị xoá hoàn toàn, không phục hồi"
- Confirmation 2 bước:
  1. Tap button → modal hiện
  2. User phải gõ "XOÁ" vào TextInput
  3. Submit chỉ enable khi đúng text
  4. Mới execute reset

### 2.3 Implementation

`app/settings/index.tsx` → đổi:
1. Wording
2. Logic: tap button → state `showResetModal = true`
3. Modal mới: TextInput + check value === "XOÁ" → enable submit

---

## 3. Plan thực hiện

| # | Việc | File | Time |
|---|------|------|------|
| 1 | Service smartNudge.ts với 6+ templates | `src/services/smartNudge.ts` mới | 15 phút |
| 2 | Schedule weekly nudge với recompute | `src/services/notifications.ts` extend | 10 phút |
| 3 | Settings → Nhắc nhở nâng cấp với 2 toggle mới | `app/settings/notifications.tsx` | 15 phút |
| 4 | Reset DB UX: wording + confirmation modal | `app/settings/index.tsx` | 10 phút |
| 5 | Update spec + tsc check | | 5 phút |

Tổng: ~55 phút.

---

## 4. Mock UI

### Settings → Nhắc nhở (sau):

```
┌─────────────────────────────────────┐
│  🔔 Nhắc ghi chi tiêu hàng ngày    │
│  App nhắc đại ca ghi 5 giây trước  │
│  khi quên                           │ [Toggle ON]
└─────────────────────────────────────┘

Giờ nhắc: [06:00] [08:00] [10:00] ... [22:00]

┌─────────────────────────────────────┐
│  ✨ Tóm tắt tuần                    │
│  Chủ nhật 10:00 sáng — gửi nhận xét│
│  ngắn về chi tiêu tuần qua          │ [Toggle ON]
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🎁 Nhận xét cá nhân hoá            │
│  Lâu lâu 1 thông báo ghẹo dựa       │
│  pattern chi tiêu của bạn           │ [Toggle ON]
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ✨ Gửi thông báo thử               │
│  Bấm để máy đẩy 1 thông báo demo... │
│  [Gửi thử ngay (3 giây)]            │
└─────────────────────────────────────┘
```

### Reset dữ liệu modal:

```
┌─────────────────────────────────────┐
│            ⚠️                        │
│      Reset dữ liệu                  │
│                                     │
│  Toàn bộ dữ liệu (giao dịch, ví,    │
│  ngân sách, mục tiêu, hoá đơn,      │
│  recurring, PIN, theme) sẽ bị xoá   │
│  hoàn toàn. Không thể phục hồi.     │
│                                     │
│  Để xác nhận, nhập "XOÁ" bên dưới: │
│  ┌─────────────────────────────┐    │
│  │ XOÁ                         │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Huỷ]              [Xoá dữ liệu]   │
│                     (đỏ, enable khi │
│                      đúng text)     │
└─────────────────────────────────────┘
```

---

## 5. Em thực hiện ngay session này

(Anh đã yêu cầu rõ → em build theo plan)

---

**END PLAN — 2026-05-23 11:50**

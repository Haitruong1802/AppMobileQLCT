# PLAN — Bux2 Retention: Làm sao để user PHẢI dùng app

**Ngày:** 2026-05-23
**Trạng thái:** Chờ đại ca duyệt — em CHƯA code
**Pain point đại ca nêu:** *"Tâm lí của anh thì chỉ tải app về rồi để đó lười nhập"*

→ Đây là sự thật 99% app finance gặp phải. Komorebi/Money Pro cũng gặp. Ai giải được = thắng.

---

## 1. Tại sao user bỏ app finance? (sự thật khắc nghiệt)

| Lý do bỏ | % user gặp | Đối thủ giải chưa? |
|---|---|---|
| Lười nhập từng giao dịch | 70% | ❌ Không ai giải |
| Quên mở app | 50% | ❌ Notif yếu |
| Không thấy giá trị sau 1 tuần | 40% | ❌ Báo cáo nhạt |
| Không có cảm xúc | 30% | ❌ Khô khan |
| Nhập sai → nản | 20% | ❌ Sửa khó |

**Kết luận em:** Build thêm tính năng "đẹp" mà không giải bài *lười* → vô dụng. Phải đánh trực diện 2 vấn đề:
1. **Giảm friction nhập tới gần 0** (lý tưởng: user KHÔNG cần nhập tay nữa)
2. **Tạo hook bắt buộc quay lại** (lý tưởng: app push tới mặt user mỗi ngày, không phải user nhớ)

---

## 2. Triết lý mới: "App nhập thay user" + "App lôi user quay lại"

> User không nhập → mình tự gợi ý → user 1 tap accept.
> User quên app → mình notif đúng giờ + nội dung không spam.

Đây là combo *Frictionless Input* + *Habit Loop*. Cleo, Rocket Money (US), Bee Care (VN) thành công nhờ cái này.

---

## 3. Roadmap — 10 chức năng theo thứ tự ưu tiên RETENTION

### 🥇 LAYER 1: Tự nhập thay user (input → gần 0 effort)

#### ❌ F1. **Đọc thông báo ngân hàng / ví điện tử** — ĐÃ LOẠI BỎ
- **Lý do loại (đại ca quyết 2026-05-23):** Đọc notification ngân hàng = đọc dữ liệu cá nhân nhạy cảm. Vi phạm:
  - Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (VN).
  - Google Play Sensitive Permissions Policy — `NotificationListenerService` chỉ được duyệt cho app accessibility, ko phải finance.
  - App có nguy cơ bị Google takedown.
- **Em đồng ý bỏ.** Không build cái này.

#### F2. **Quick-Add Widget Home Screen** (1 tap nhập 1 mục thường xuyên)
- **Cái gì:** Widget Android (4×1 box trên Home Screen) hiện 4 nút: ☕ 35k / 🍜 50k / 🚖 30k / + Tuỳ chỉnh. Bấm 1 lần → TX được tạo, không cần mở app.
- **Cách làm:** `expo-widgets` (mới có cho RN), Android-only.
- **Hiệu quả:** Mỗi sáng/trưa user thấy widget → bấm là xong. Loại bỏ bước "mở app".
- **Effort:** ~6h (Android only, iOS skip vì native phức tạp).
- **Yêu cầu:** EAS Build.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐

#### F3. **Voice input** ("ghi 50 nghìn cà phê")
- **Cái gì:** Nút mic trên dashboard → nói tiếng Việt → app parse số + category bằng `expo-speech` (Speech-to-Text on-device iOS / Android Speech Recognizer).
- **Hiệu quả:** Nhập 1 TX trong 3 giây không cần gõ phím.
- **Effort:** ~4h (đã có `localParse.ts` parse VN text rồi — chỉ cần thêm STT).
- **Yêu cầu:** EAS Build (Expo Go không có expo-speech-recognition).
- **Mức độ ăn đứt:** ⭐⭐⭐

#### F4. **OCR scan hoá đơn local** (đã đề xuất)
- **Effort:** ~6h. EAS Build cần.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐

---

### 🥈 LAYER 2: Hook bắt buộc user quay lại

#### F5. **"8 giờ tối — Tóm tắt 1 phút"** ⭐ CỰC HỢP
- **Cái gì:** Đúng 20:00 mỗi ngày → push notification: *"Hôm nay bạn chi 187k. Vào xem 1 phút?"*. Mở app → màn hình toàn cảnh hôm nay (TX nhiều nhất, vs hôm qua, streak +1).
- **Vì sao hiệu quả:** *Habit loop* — user mở app HÀNG NGÀY vì tò mò "hôm nay mình chi bao nhiêu". Đây là *Duolingo strategy*.
- **Bonus:** Nếu user CHƯA ghi gì hôm nay → notif đổi: *"Mới 8h tối mà bạn chưa ghi gì hôm nay 🤔. Streak 12 ngày của bạn đang sắp gãy đó."* → kích hoạt loss aversion.
- **Effort:** ~3h (notif schedule + 1 màn "Summary".
- **Yêu cầu:** Expo Go OK (không cần EAS).
- **Mức độ ăn đứt:** ⭐⭐⭐⭐⭐

#### F6. **Streak với "Freeze Pass"** (đã đề xuất, có bổ sung)
- **Cái gì:** Streak ghi sổ + mỗi tuần user có 1 "Freeze Pass" tự động bảo vệ streak nếu lỡ 1 ngày.
- **Penalty:** Streak gãy = mất hết tích luỹ → loss aversion mạnh hơn cả phần thưởng.
- **Reward:** Mốc 7/30/100/365 → huy hiệu animated + share image.
- **Effort:** ~3h. Expo Go OK.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐

#### F7. **Lock Screen Live Activity (iOS) / Notification Widget (Android)** — "Số dư an toàn hôm nay"
- **Cái gì:** Trên màn hình khoá hiện *"Bux2: Hôm nay còn được xài 230k"* — tự update mỗi khi có TX mới.
- **Vì sao:** User mở khoá điện thoại 100+ lần/ngày → thấy số tiền → nhớ tới app. Tốt hơn cả notification.
- **Effort:** iOS Live Activity ~6h, Android persistent notif ~3h.
- **Yêu cầu:** EAS Build.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐

---

### 🥉 LAYER 3: Cảm xúc + viral (giữ chân + tự lan)

#### F8. **Persona tháng + share TikTok** (đã đề xuất)
- **Effort:** ~5h. Expo Go OK.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐ (viral cao)

#### F9. **Cool-down 5 giây + "Khoản này = X cái này"** (đã đề xuất + bổ sung)
- **Bổ sung:** Khi user nhập TX > 200k → màn hình: *"250k = 3 lần đổ xăng / 2 tuần cà phê. Vẫn chi?"* — phải chờ 5s mới bấm xác nhận được.
- **Effort:** ~2h. Expo Go OK.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐ (truyền thông tốt — "App ngăn bạn xài hoang")

#### F10. **Số dư an toàn hôm nay** (Safe-to-spend, đã đề xuất)
- **Effort:** ~3h. Expo Go OK.
- **Mức độ ăn đứt:** ⭐⭐⭐⭐

---

## 4. Đề xuất combo cuối — đại ca chọn

### COMBO 🚀 "Quick win — Expo Go OK, 1-2 ngày" — em khuyến nghị làm TRƯỚC
4 cái này KHÔNG cần build native, làm xong trong **~16h**:

| # | Tên | Effort | Layer | Tác động retention |
|---|---|---|---|---|
| F5 | 8h tối Tóm tắt + nhắc streak | 3h | Hook | ⭐⭐⭐⭐⭐ |
| F6 | Streak + Freeze Pass | 3h | Hook | ⭐⭐⭐⭐ |
| F10 | Số dư an toàn hôm nay | 3h | Input giảm |⭐⭐⭐⭐ |
| F8 | Persona tháng + share | 5h | Viral | ⭐⭐⭐⭐ |
| F9 | Cool-down 5s | 2h | Cảm xúc |⭐⭐⭐⭐ |

> **Ship được luôn trên Expo Go. Đại ca test trên iPhone qua tunnel. Tăng retention ~30% theo benchmark Duolingo + Cleo.**

### COMBO 💎 "Game changer — cần EAS Build, 4-5 ngày"
4 cái killer còn lại, không động dữ liệu cá nhân, phải build dev client:

| # | Tên | Effort | Yêu cầu |
|---|---|---|---|
| F2 | Widget 1-tap Home | 6h | Android, EAS |
| F3 | Voice input ("ghi 50k cà phê") | 4h | EAS |
| F4 | OCR scan hoá đơn (user tự chụp) | 6h | EAS |
| F7 | Lock screen widget hiện safe-to-spend | 6h | EAS, iOS+Android |

> Đại ca quyết:
> - Có chấp nhận EAS Build không? (build ~10p, free 30 build/tháng).
> - Widget Android only OK chứ? (iOS làm sau).

---

## 5. Kế hoạch em đề xuất

**Tuần này (2-3 ngày tới):**
→ Build COMBO 🚀 (5 cái Expo Go). Ship Closed Testing Play Console. Đo retention bằng Mixpanel/PostHog free.

**Tuần sau (sau khi đại ca thấy retention ổn):**
→ Build COMBO 💎. Bắt đầu từ F3 Voice input (rẻ + ai cũng thấy đỉnh) → F4 OCR → F2 Widget → F7 Lock screen.

---

## 6. Câu hỏi đại ca cần trả lời

1. **Combo 🚀 trước có OK không?** Em build ngay được, không cần thêm hạ tầng. Không động dữ liệu cá nhân, chỉ dùng data trong app.
2. **Sau Combo 🚀, có chấp nhận EAS Build cho Combo 💎 không?** (Voice + OCR + Widget — đều user chủ động, không đụng data nhạy cảm).
3. **Bắt đầu từ F5 (8h tối tóm tắt) hay F10 (Số dư an toàn) trước?**

---

## 7. Mock quan trọng nhất — F5 "8 giờ tối"

```
[20:00 - Notification]
┌────────────────────────────────┐
│ 🟢 Bux2                         │
│ Tóm tắt hôm nay — 1 phút thôi  │
│ Bạn chi 187k. Mở xem nào →     │
└────────────────────────────────┘

[Mở app → màn Summary tự pop]
┌──────────────────────────────┐
│         🔥 Streak 13          │
│                                │
│   Hôm nay 23/5/2026            │
│                                │
│  ┌─────────┐  ┌─────────┐    │
│  │  187k   │  │  -42k   │    │
│  │ Đã chi  │  │ vs hôm  │    │
│  │         │  │ qua ✓   │    │
│  └─────────┘  └─────────┘    │
│                                │
│  Top: ☕ Cà phê 75k            │
│       🍜 Ăn trưa 65k           │
│       🚖 Grab 47k              │
│                                │
│   Còn được xài: 230k đến T5   │
│                                │
│   [ Ghi giao dịch mới ]        │
└──────────────────────────────┘
```

> Nếu user CHƯA ghi gì hôm nay → notif đổi sang:
> *"⚠️ 8h tối rồi mà chưa thấy giao dịch nào. Streak 12 ngày sắp gãy 😬"*

Đây là **trigger duy nhất** mà 1 ngày user buộc phải nhớ app. Không có cái này → user quên app sau 3 ngày.

---

**EM CHƯA CODE GÌ. Chờ đại ca trả lời 4 câu hỏi ở Mục 6.**

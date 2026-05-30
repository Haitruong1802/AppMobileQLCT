# Ship Play Store / TestFlight — Bux2 v3.123

App đã production-ready. EAS config sẵn ở `eas.json`. Project ID `15eab26f-b108-4f8c-8f62-2afa1a284a1c` đã có trong `app.json`.

## Bước 1: Cài EAS CLI + login (chỉ 1 lần)

```powershell
npm install -g eas-cli
eas login
```

Login bằng Expo account của anh (đã có vì `projectId` đã setup).

## Bước 2: Chọn lộ trình

### A. Dev build cho iPhone test push notif (KHUYẾN NGHỊ TRƯỚC)

Push notifications không hoạt động đầy đủ trong Expo Go (SDK 53+). Để test thật cần dev build.

```powershell
cd D:\CLAUDE\BopAI
eas build --profile development --platform ios
```

- Cần Apple Developer account ($99/năm) hoặc anh đăng ký free dev cert
- Build mất ~20-30 phút (cloud build)
- Khi xong, EAS gửi link cài đặt qua TestFlight hoặc QR
- Cài lên iPhone → Expo Go thay thế bằng dev build, test push notif thật

### B. Preview build (APK Android share nội bộ)

Nếu anh muốn share APK cho bạn bè/người test trước Play Store:

```powershell
eas build --profile preview --platform android
```

- Không cần Apple Dev
- Build mất ~15-25 phút
- Output: file `.apk` (~30-50MB) anh tải về share link

### C. Production build (lên Play Store)

```powershell
eas build --profile production --platform android
```

- Output: file `.aab` (Android App Bundle) chuẩn Play Store
- `autoIncrement: true` trong `eas.json` → versionCode tăng tự động
- Sau khi build xong, anh có 2 cách upload:
  1. Tự download AAB → Play Console → Internal/Closed/Production testing
  2. `eas submit --platform android` — EAS tự upload qua Service Account JSON (cần setup riêng)

## Bước 3: Checklist trước build production

Em đã verify sẵn, anh chỉ review:

- [x] `app.json` name="Bux2", bundleIdentifier ổn, version 1.0.0
- [x] App icon + splash đã có (`assets/icon.png`, `assets/splash-icon.png`)
- [x] Android permission chỉ còn CAMERA (đã xoá RECORD_AUDIO thừa)
- [x] iOS NS*UsageDescription đầy đủ (Camera, PhotoLibrary, FaceID, Notifications)
- [x] 100% offline — không cần `google-services.json` / Firebase
- [x] PIN/Secure store cho lock app
- [x] Notification PII đã xoá (không hiện số tiền lock screen)
- [ ] **Anh cần làm**: Tạo Play Console listing (mô tả app, screenshot, content rating)
- [ ] **Anh cần làm**: Privacy Policy URL (Play Store yêu cầu cho app có Notifications + Camera)

## Bước 4: Sau khi có AAB

1. Vào https://play.google.com/console
2. Create app → upload AAB qua "Internal testing" trước
3. Mời tester (email) → cài qua Play Store link
4. Nếu ổn → promote lên "Closed testing" → "Production"

## Gợi ý version bump cho lần build

Hiện `app.json` version `1.0.0`. Trước khi build production:
- iOS `buildNumber` (Play Store tự manage `versionCode` qua `autoIncrement`)
- Android không cần đổi vì eas.json đã `autoIncrement: true`

## Lưu ý

- **Test ngay sau cài**: scan lại 5 case trong báo cáo GD1 (multi-book leak, atomic transfer, notif PII)
- **Khi cập nhật code**: chạy `eas build` lần 2, Play Console sẽ thấy bản mới
- **EAS free tier**: 30 builds/tháng đủ cho hobby app

---

Anh chốt **A**, **B**, hay **C** trước? Em recommend **A (dev build iOS)** để test push notif chuẩn rồi mới chuyển sang **C (production)** sau.

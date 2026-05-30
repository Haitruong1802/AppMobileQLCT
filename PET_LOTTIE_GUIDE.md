# Hướng dẫn tải 5 Lottie cho Pet "Bú Bú" (hoặc tên anh đặt)

## ⭐ CÁCH MỚI — Tạo bằng AI (Lottie Creator)

Lottie Creator có **4 AI tools** miễn phí trong Starter Plan: Motion Copilot, Prompt to Vector, Prompt to Theming, Prompt to State Machine.

### Workflow tạo 5 pet stages:

1. Vào **https://app.lottiefiles.com/creator**
2. **Create animation** → Untitled file
3. **AI Tools sidebar** → **Prompt to Vector** → gõ prompt vector → Apply
4. Select object trên canvas → **Motion Copilot** → gõ prompt animation → Apply
5. **Export** (góc trên phải) → format **Lottie JSON** → tải về

### 5 prompts copy-paste cho 5 stages:

#### Stage 1 — Hạt giống (0-6 ngày)
- Vector: `cute small green seed character with happy face, kawaii style, simple round body, big sparkly eyes`
- Motion: `bounce gently up and down like breathing, very subtle and calm`

#### Stage 2 — Bé con (7-29 ngày)
- Vector: `cute yellow baby blob character, big shiny eyes, small arms, kawaii pastel style`
- Motion: `wiggle side to side excitedly, happy bouncing rhythm`

#### Stage 3 — Teen (30-99 ngày)
- Vector: `happy orange monster character with flame-like body shape, simple cute design, kawaii vibrant`
- Motion: `dance energetically with arms up, fun and lively`

#### Stage 4 — Trưởng thành (100-364 ngày)
- Vector: `confident purple kawaii character wearing small gold crown, regal but cute, simple shapes`
- Motion: `stand proud with gentle sway, crown sparkles softly`

#### Stage 5 — Huyền thoại (365+ ngày)
- Vector: `legendary golden dragon creature with glowing aura, majestic but cute, kawaii style, sparkle effects`
- Motion: `float in air with energy aura pulsing, sparkles orbit around, idle hover`

### Tips cho AI output đẹp hơn:
- Thêm `simple flat design` để vector gọn (tránh quá chi tiết)
- Thêm `single color palette` để consistent với theme app
- Thêm `512x512 square` để fit canvas
- Nếu kết quả xấu → click **Reset** trong Motion Copilot rồi prompt lại

### Free limit:
- LottieFiles Starter Plan free: ~5 animations/month
- Đủ cho 5 pet stages (vừa khít)
- Hết tháng renew

---

## Cách tải free từ LottieFiles

### Bước 1 — Mở LottieFiles free animations

Vào browser: **https://lottiefiles.com/free-animations**

Hoặc dùng search trực tiếp với filter free:

| Stage | URL search gợi ý |
|---|---|
| 1. Hạt giống (0-6 ngày) | https://lottiefiles.com/search?q=egg+cute&filter=free |
| 2. Bé con (7-29 ngày) | https://lottiefiles.com/search?q=baby+monster&filter=free |
| 3. Teen (30-99 ngày) | https://lottiefiles.com/search?q=happy+blob+character&filter=free |
| 4. Trưởng thành (100-364) | https://lottiefiles.com/search?q=monster+king&filter=free |
| 5. Huyền thoại (365+) | https://lottiefiles.com/search?q=dragon+cute+legendary&filter=free |

### Bước 2 — Filter đúng free + tải

Mỗi lần search:
1. Bấm vào animation muốn tải
2. Bấm nút **"Download"** (xanh, góc trên phải)
3. Chọn định dạng **"Lottie JSON"** (file `.json` ~10-50KB mỗi cái)
4. KHÔNG chọn dotLottie/MP4/GIF (chỉ JSON dùng được)

### Bước 3 — Đặt vào đúng folder + đúng tên

Tạo folder mới: `D:\CLAUDE\BopAI\src\assets\lottie\pet\`

Đổi tên 5 file đã tải về thành:
- `pet_seed.json`
- `pet_baby.json`
- `pet_teen.json`
- `pet_adult.json`
- `pet_legendary.json`

### Bước 4 — Uncomment 2 block trong `PetView.tsx`

Mở `D:\CLAUDE\BopAI\src\components\PetView.tsx`:

**Block 1** — uncomment dòng `import LottieView` + `LOTTIE_MAP` (line 8-14):
```ts
import LottieView from 'lottie-react-native';
const LOTTIE_MAP: Record<number, any> = {
  1: require('../assets/lottie/pet/pet_seed.json'),
  2: require('../assets/lottie/pet/pet_baby.json'),
  3: require('../assets/lottie/pet/pet_teen.json'),
  4: require('../assets/lottie/pet/pet_adult.json'),
  5: require('../assets/lottie/pet/pet_legendary.json'),
};
```

**Block 2** — uncomment block render Lottie (line ~73-82):
```ts
const lottieSource = LOTTIE_MAP[stage.level];
if (lottieSource) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <LottieView source={lottieSource} autoPlay loop style={{ width: size, height: size }} />
    </View>
  );
}
```

### Bước 5 — Reload app

Trong Expo dev: bấm `r` trong terminal hoặc shake device → Reload.

Pet thật sẽ chạy. Nếu file JSON hỏng → fallback về Lucide icon (an toàn, không crash).

---

## Gợi ý animation cụ thể (search cụm từ này trên LottieFiles)

| Pet stage | Search keyword | Vibe muốn |
|---|---|---|
| Seed | `egg shaking`, `egg cute small` | Trứng nhỏ rung rung |
| Baby | `egg hatching`, `chick happy` | Trứng nứt, gà con vui |
| Teen | `blob happy bouncing`, `slime cute` | Slime / blob nhún nhảy |
| Adult | `monster king`, `creature dance` | Có vẻ ngoài "lớn", có vương miện hoặc dáng đứng |
| Legendary | `dragon cute`, `legendary creature`, `phoenix` | Lung linh, có hiệu ứng sparkles |

## License lưu ý

LottieFiles free section thường là **CC BY 4.0** hoặc **Lottie Simple License** — cho phép dùng commercial nếu credit tác giả trong app.

Để credit, anh có thể thêm dòng nhỏ trong Settings → "Về Bux2" → "Pet animations by [author names], CC BY 4.0 via LottieFiles".

Hoặc dùng **CC0** (public domain) — không cần credit. Tìm bằng filter "CC0" hoặc "Public Domain" trong LottieFiles.

## Nếu muốn đẹp hơn → thuê designer

- Fiverr: search "Lottie animation pet character" — $30-100 cho 5 stages
- Hoặc dùng AI: `Adobe Express` → After Effects → Bodymovin plugin export Lottie JSON

Em chỉ làm được Lucide icon placeholder (đang chạy). Lottie thật cần asset từ designer hoặc LottieFiles free.

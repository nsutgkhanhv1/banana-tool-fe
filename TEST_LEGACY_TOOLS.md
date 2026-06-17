# MEKO Legacy Tools - Test Checklist

Tài liệu này dùng để gửi client test các feature đã port/nâng cấp từ:

```text
MEKO JSX CEP CHUYỂN UXP/bổ sung/
```

Phạm vi hiện tại: static port sang UXP, chưa đảm bảo giống 100% cảm giác JSX cũ cho mọi Photoshop version. Client test giúp xác nhận feature nào đủ dùng, feature nào cần refine.

---

## 0. Chuẩn bị test

1. Mở Photoshop.
2. Load/reload UXP plugin.
3. Mở panel:

```text
Open Meko Retouch Tools
```

4. Mở một file ảnh test có layer pixel bình thường.
5. Nên duplicate file hoặc dùng ảnh copy vì một số tool tạo nhiều layer/group hoặc resize document.

---

## 1. Nhóm A - Dodge & Burn / Color Correction

### 1.1 D&B 50% Gray

Vị trí:

```text
Dodge & Burn > D&B 50% Gray
```

Default nên tạo:

```text
Layer name: D&B 50% Gray | Mekomedia.vn
Blend mode: Overlay
Fill: 50% Gray
Opacity: theo UI
```

Checklist:

- [ ] Tool chạy không báo lỗi.
- [ ] Layer mới đúng tên.
- [ ] Layer fill xám 50%.
- [ ] Blend default là Overlay.
- [ ] Chuyển sang Soft Light vẫn hoạt động.
- [ ] Brush dodge/burn trên layer cho cảm giác đúng workflow cũ.

Ghi chú client:

```text

```

---

### 1.2 D&B Curves

Vị trí:

```text
Dodge & Burn > D&B Curves
```

Default legacy:

```text
Burn curve:  [0,0], [165,125], [255,255]
Dodge curve: [0,0], [85,125], [255,255]
Layer names: Burn, Dodge
Mask: đen/invert
```

Checklist:

- [ ] Tool chạy không báo lỗi.
- [ ] Có 2 layer `Burn` và `Dodge`.
- [ ] Mask của 2 layer là mask đen.
- [ ] Brush trắng lên mask Burn làm tối đúng.
- [ ] Brush trắng lên mask Dodge làm sáng đúng.
- [ ] Nếu tắt `Legacy Curve Points`, strength generic vẫn hoạt động.

Ghi chú client:

```text

```

---

### 1.3 D&B Master

Nguồn legacy:

```text
bổ sung/TABLE 1/007 D&B Master.jsx
bổ sung/TABLE 2/32 D&B Master.jsx
```

Vị trí:

```text
Dodge & Burn > D&B Master
```

Các mode cần test:

```text
Standard Curves
Soft Light
Danh khoi
Overlay
Screen
Danh khoi RA
Multiply
Sang AI
Danh khoi AI
Toi AI
Sang AI+
Danh khoi AI+
Toi AI+
```

Checklist chung:

- [ ] Mỗi mode chạy không báo lỗi.
- [ ] Tool tạo layer/group có tên dễ nhận biết.
- [ ] Các mode paint layer như Soft Light/Overlay/Screen/Multiply có blend mode đúng.
- [ ] Các mode AI/Curve có mask đen để brush vào vùng cần chỉnh.
- [ ] B&W Check hiện đúng khi chọn `B&W Check`.
- [ ] Solar Check hiện đúng khi chọn `Solar Curve`.
- [ ] Chọn `None` không bật check layer.
- [ ] Client đánh giá mode nào giống JSX cũ, mode nào cần chỉnh thêm.

Ghi chú từng mode:

```text
Standard Curves:
Soft Light:
Danh khoi:
Overlay:
Screen:
Danh khoi RA:
Multiply:
Sang AI:
Danh khoi AI:
Toi AI:
Sang AI+:
Danh khoi AI+:
Toi AI+:
```

---

### 1.4 Color Correction Pro

Nguồn legacy:

```text
bổ sung/TABLE 2/24 Color correction.jsx
```

Vị trí:

```text
Color Correction > Color Correction Pro
```

Expected group:

```text
Color correction - Meko media
├─ Hue correction - Color correction
│  ├─ Gradient skin - Hue fix
│  ├─ Dark - Hue fix
│  └─ Light - Hue fix
└─ Saturation correction - Color correction
   ├─ + Saturation fix
   └─ - Saturation fix
```

Checklist:

- [ ] Tool chạy không báo lỗi.
- [ ] Group/layer đúng cấu trúc trên.
- [ ] Các layer Hue/Saturation có mask đen.
- [ ] Brush trắng vào mask thấy tác dụng chỉnh màu.
- [ ] `Hue Shift` default 25 cho cảm giác giống tool cũ.
- [ ] `Saturation Shift` default 25 cho cảm giác giống tool cũ.
- [ ] `Gradient Opacity` default 0, tăng lên thì thấy hiệu ứng.

Ghi chú client:

```text

```

---

## 2. Nhóm B - Texture / Export / Watermark

### 2.1 Check Texture

Nguồn legacy:

```text
bổ sung/TABLE 2/20 Texture.jsx
```

Vị trí:

```text
Sharpen & Texture > Check Texture
```

Expected group:

```text
Check Layer
├─ D&B
├─ Skin Blemish
├─ Solarize
├─ Black/White
└─ Invert
```

Checklist:

- [ ] Tool chạy không báo lỗi.
- [ ] Group `Check Layer` được tạo.
- [ ] Có đủ các layer trên.
- [ ] `Active View` chỉ bật layer tương ứng.
- [ ] `Show All` bật tất cả layer check.
- [ ] Client đánh giá layer `Skin Blemish` có hỗ trợ soi texture tốt không.

Ghi chú client:

```text

```

---

### 2.2 Check Texture Pro

Nguồn legacy:

```text
bổ sung/TABLE 2/21 Texture Pro.jsx
```

Vị trí:

```text
Sharpen & Texture > Check Texture Pro
```

Expected group:

```text
Help
├─ Saturation
├─ Color
├─ Hue
├─ Luminosity
├─ Negative
├─ Contract
├─ Test Color
├─ Skin Blemish
├─ Desaturate
├─ Invert
├─ Toi
└─ Sang
```

Checklist:

- [ ] Tool chạy không báo lỗi.
- [ ] Group `Help` được tạo.
- [ ] Có đủ layer trên.
- [ ] `Active View` bật đúng layer cần soi.
- [ ] `Show All` bật tất cả layer helper.
- [ ] Client đánh giá layer nào giống/chưa giống JSX cũ.

Ghi chú client:

```text

```

---

### 2.3 Xuat Anh Facebook

Nguồn legacy:

```text
bổ sung/TABLE 1/038 xuatanhfacebook.jsx
```

Vị trí:

```text
Brand & Export > Xuat Anh Facebook
```

Preset cần test:

```text
Facebook Ngang 2048x1072
Facebook Dung 1350x1688
Long Edge tu chon
```

Checklist:

- [ ] Chọn folder xuất thành công.
- [ ] Preset ngang xuất file `_FB_Ngang.jpg`.
- [ ] File ngang có kích thước 2048x1072.
- [ ] Preset đứng xuất file `_FB_Dung.jpg`.
- [ ] File đứng có kích thước 1350x1688.
- [ ] Long Edge xuất file `_facebook.jpg`.
- [ ] File gốc trong Photoshop không bị flatten/resize.
- [ ] Option `Convert sRGB` không làm tool lỗi.
- [ ] Option `Flatten duplicate` hoạt động.
- [ ] Option `Sharpen nhe` cho ảnh nét vừa phải.
- [ ] Quality JPG đạt yêu cầu client.

Ghi chú client:

```text

```

---

### 2.4 Add Logo Meko

Nguồn legacy:

```text
bổ sung/TABLE 1/035 add logo meko.jsx
```

Vị trí:

```text
Brand & Export > Add Logo Meko
```

Mode cần test:

```text
Logo Watermark
Text Watermark
```

Checklist Logo:

- [ ] Chọn logo file thành công.
- [ ] Logo được đưa vào document hiện tại.
- [ ] Logo scale theo `Logo Width`.
- [ ] Position top-left/top-right/bottom-left/bottom-right/center đúng.
- [ ] Margin hoạt động.
- [ ] Opacity hoạt động.

Checklist Text:

- [ ] Chọn `Text Watermark` chạy không báo lỗi.
- [ ] Text default `© Mekomedia.vn` hiện đúng.
- [ ] Font PS Name hoạt động với `ArialMT`.
- [ ] Font size hoạt động.
- [ ] Position tương đối đúng.
- [ ] Opacity hoạt động.

Ghi chú client:

```text

```

---

## 3. Nhóm Quick Effects / Upscale đã port trước đó

### 3.1 Add Noise

Vị trí:

```text
Sharpen & Texture > Add Noise
```

Expected legacy:

```text
Layer: Add Noise|Mekomedia.vn
Fill gray
Add Noise ~25.98
Gaussian Blur 1.1
Blend: Soft Light
```

Checklist:

- [ ] Tool chạy không lỗi.
- [ ] Grain đẹp/tự nhiên.
- [ ] Opacity dễ kiểm soát.

---

### 3.2 Mo Ao / Nang Tho

Vị trí:

```text
Legacy Quick Effects > Mo Ao / Nang Tho
```

Checklist:

- [ ] Tạo group `Meko - hieu ung nang tho`.
- [ ] Hiệu ứng blur/soft light/screen giống style legacy.
- [ ] Screen opacity default 47 ổn.

---

### 3.3 Highlight Boost / Dark Boost

Vị trí:

```text
Legacy Quick Effects > Highlight Boost
Legacy Quick Effects > Dark Boost
```

Checklist:

- [ ] Highlight Boost làm nổi vùng sáng tự nhiên.
- [ ] Dark Boost nhấn vùng tối đúng ý.
- [ ] Range/Strength dễ chỉnh.

---

### 3.4 Upscale Pro

Vị trí:

```text
Legacy Quick Effects > Upscale Pro
```

Checklist:

- [ ] Scale 2x chạy không lỗi.
- [ ] Preserve Details 2.0 hoạt động trên máy client.
- [ ] Bicubic Smoother hoạt động.
- [ ] Sharpen nhẹ không quá gắt.

---

## 4. Kết quả tổng hợp client

Client đánh dấu status từng tool:

```text
[OK]       Đủ dùng, không cần chỉnh.
[REFINE]   Chạy được nhưng cảm giác chưa giống tool cũ.
[BUG]      Báo lỗi hoặc không tạo đúng layer/file.
[DROP]     Không cần giữ feature này.
```

Bảng tổng hợp:

| Tool | Status | Ghi chú cần sửa |
|---|---|---|
| D&B 50% Gray |  |  |
| D&B Curves |  |  |
| D&B Master |  |  |
| Color Correction Pro |  |  |
| Check Texture |  |  |
| Check Texture Pro |  |  |
| Xuat Anh Facebook |  |  |
| Add Logo Meko |  |  |
| Add Noise |  |  |
| Mo Ao / Nang Tho |  |  |
| Highlight Boost |  |  |
| Dark Boost |  |  |
| Upscale Pro |  |  |

---

## 5. Những feature chưa port / làm sau

Các feature khó hoặc rủi ro cao, nên chờ feedback client trước:

```text
bổ sung/TABLE 1/29.jsx        Kéo chân/body transform
bổ sung/TABLE 1/30.jsx        Kéo chân/body transform bản khác
bổ sung/TABLE 1/001 Mịn Thon AI.jsx
bổ sung/TABLE 2/04 Miệng cười.jsx
bổ sung/TABLE 2/13 dìm tối BG.jsx bản Camera Raw
```

Lý do chưa port ngay:

- Liên quan selection/transform hoặc Liquify/Camera Raw descriptor.
- Dễ phụ thuộc Photoshop version.
- Cần client xác nhận có thật sự cần giống legacy hay nên làm lại bằng workflow mới.

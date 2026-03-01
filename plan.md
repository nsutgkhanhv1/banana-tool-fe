# Kế Hoạch Triển Khai (Implementation Plan) - Nano Banana Pro UXP Panel

Tài liệu này phác thảo kế hoạch chi tiết xây dựng panel UXP dựa trên React cho Photoshop cho dự án **Nano Banana Pro**, dựa trên các mô tả thiết kế và yêu cầu chức năng.

---

## Giai đoạn 1: Xây dựng Giao diện (Đã Hoàn Thành)
Tập trung vào cấu trúc HTML, component React và làm đẹp giao diện (CSS) theo tiêu chuẩn UI/UX của nền tảng chỉnh sửa đồ hoạ chuyên nghiệp.

1.  **Hệ Thống Component**:
    *   **Main App (`App.jsx`)**: Container bao quanh điều phối trạng thái giữa các Tab.
    *   **Header (`Header.jsx`)**: Banner logo gradient SVG, tuỳ chọn thông báo số lượng Credit (Còn 17 ảnh), nút Refresh và Thoát.
    *   **Điều Hướng (`TabNavigation.jsx`)**: Chuyển đổi qua lại giữa `Thay Nền`, `Phục chế ảnh`, và `Tự do AI`.
2.  **Giao Diện Trong Suốt & Đẹp Mắt (Premium UI)**:
    *   Màu nền xám đen (`#1e1e1e`), thành phần nổi (`#282828`).
    *   Sử dụng màu nhấn Vàng Cam (`#ffd000`), hệ thống nút Button (Primary, Secondary, Danger), các nút Toggle chuẩn iOS, có thiết kế bóng đổ nhẹ khi tương tác (hover).
    *   Icon mũi tên thả xuống (dropdown) và các biểu tượng mượt mà.

---

## Giai đoạn 1.5: Quản lý Trạng Thái Frontend (Phase 1 Backend - Đang Chuẩn Bị)
Giai đoạn này tập trung vào làm cho phần React UI thực sự hoạt động, quản lý State người dùng nhập tay, giả lập thao tác lệnh gọi Photoshop.

1.  **State Management (React State)**:
    *   Lưu thông số **Tỉ lệ** (2:3, 1:1...) và **Kích thước** (4K, 2K...).
    *   Quản lý danh sách **Ảnh tham chiếu** (Thêm, Xoá, Chọn ảnh chính/active).
    *   Lưu trữ nội dung **Prompt**.
    *   Điều khiển bật/tắt của **Công tắc** (Giữ chủ thể, Thu phóng...).
2.  **Mô phỏng (Mock) Photoshop UXP Action**:
    *   Hàm **Lớp nhanh**: Giả lập API Photoshop, chuẩn bị kịch bản lưu layer hiện hành vào máy, giả vờ đẩy ảnh lên State Khung tham chiếu.
    *   Hàm **Tạo Ảnh / Thay Nền**: Khi click sẽ kiểm tra dữ liệu State, gom hết thành 1 chuỗi `JSON Payload` (đại diện thông tin gửi đi) rồi `console.log` ra màn hình để nghiệm thu, đồng thời hiển thị chữ "Đang xử lý..." trên nút.

---

## Giai đoạn 2: Tương tác Server & Áp Dụng Photoshop (Phase 2 - Mở Rộng)
Đây là giai đoạn kết nối Internet tới AI Server và xử lý ảnh thật trên Photoshop khi Giai đoạn 1.5 đã hoàn chỉnh logic.

1.  **Giao tiếp Server (Backend AI)**:
    *   Từ `JSON Payload` gom được ở trên, Tool đóng gói lại bằng fetch HTTP POST request, đính kèm Token xác thực.
    *   Gửi file ảnh Base64 sang server *Banana / Google* để sinh hình bằng AI.
2.  **Áp Dụng Tự Động Vào Photoshop (UXP ExecuteAsModal)**:
    *   Server trả về file ảnh AI hoàn thiện (hoặc link Image).
    *   Sử dụng lệnh đặc quyền `require("photoshop").core.executeAsModal` cho phép Plugin thay đổi Document.
    *   Quy trình thao tác gồm: 
        *   Tạo Layer mới trên đầu hoặc kề dưới Layer gốc.
        *   Nhúng ảnh kết quả vào Layer mới này.
        *   Đặt tên Layer là *Banana AI - Result*.
        *   Tuỳ chọn tự động Transform, Scale (Thu phóng) dựa theo đúng tỷ lệ khách hàng đã chọn trên Panel.

---

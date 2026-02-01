làm theo các bước như trong ảnh để import firebase eggIoT
go to this link:
https://console.firebase.google.com/u/0/


Sau khi đã hoàn thành sẽ có cấu trúc Firebase như sau:
https://eggiot-e58fe-default-rtdb.firebaseio.com/
│
├── DS18B20                                ← Nhánh cảm biến nhiệt độ (ESP32 gửi dữ liệu lên)
│   ├── CURRENT_STAGE : 0                   ← Giai đoạn ấp hiện tại (ESP32 cập nhật theo tiến trình)
│   ├── STATUS : "pending"                  ← Trạng thái hệ thống
│   │      ↳ "pending": đang khởi tạo / chờ bắt đầu
│   │      ↳ "running": đang hoạt động
│   │      ↳ "done": hoàn tất quy trình ấp
│   ├── TEMP_MONGMUON : 37                 ← Nhiệt độ mục tiêu (được lấy từ nhánh SETUP/STAGES)
│   └── TEMP_THUCTE : 38.5                 ← Nhiệt độ thực tế đọc từ cảm biến DS18B20
│        ↳ ESP32 đọc cảm biến mỗi vài giây và cập nhật giá trị này lên đây
│
├── LAMP                                   ← Nhánh điều khiển đèn sưởi (Relay)
│   └── RELAY_STATE : 1                    ← Trạng thái relay điều khiển đèn
│        ↳ 1 = bật (đèn ON), 0 = tắt (đèn OFF)
│        ↳ ESP32 đọc giá trị này để bật/tắt chân điều khiển relay vật lý
│
├── LOGS                                   ← Nhật ký hoạt động hệ thống (do ESP32 ghi lại)
│   └── -ObnCXsq6EDAS18TUbfl               ← ID log tự sinh (Firebase tự tạo mỗi lần push)
│       ├── CURRENT_STAGE : 0              ← Giai đoạn tại thời điểm log
│       ├── RELAY_STATE : 0                ← Trạng thái đèn tại thời điểm log
│       ├── SETUP_TIME : "18/10/2025 00:20:38"  ← Thời điểm bắt đầu stage
│       ├── STATUS : "running"             ← Trạng thái hệ thống tại thời điểm log
│       ├── TEMP_MONGMUON : 33             ← Nhiệt độ mục tiêu trong stage log
│       ├── TEMP_THUCTE : 32.8125          ← Nhiệt độ thực tế đo được tại log
│       └── timestamp : "18/10/2025 00:28:12"   ← Thời điểm ghi log (Firebase push time)
│        ↳ Dữ liệu này giúp người dùng theo dõi lại tiến trình ấp trứng theo thời gian
│
└── SETUP                                  ← Nhánh cấu hình từng giai đoạn ấp (do Web gửi xuống)
    ├── STAGES                             ← Mảng các giai đoạn ấp (stage 0, 1, 2, ... tùy theo số lượng giai đoạn mà Web gửi xuống)
    │   └── 0
    │       ├── temp : 37                  ← Nhiệt độ yêu cầu cho stage 0
    │       └── time : 30240               ← Thời gian duy trì (giây)
    │        ↳ Web/App nhập cấu hình này → Firebase lưu lại → ESP32 đọc và thực thi
    │
    ├── STAGE_END_TIME                     ← Thời điểm stage hiện tại kết thúc (ESP32 tính toán)
    │   ├── day : 26
    │   ├── hour : 18
    │   ├── minute : 37
    │   ├── month : 10
    │   ├── second : 44
    │   └── year : 2025
    │        ↳ ESP32 tính toán từ thời gian bắt đầu + “time” trong STAGES
    │
    └── STAGE_START_TIME                   ← Thời điểm bắt đầu stage (ESP32 ghi khi stage đổi)
        ├── day : 27
        ├── hour : 0
        ├── minute : 7
        └── month : 10
         ↳ ESP32 ghi thời gian thực tế khi chuyển sang stage mới

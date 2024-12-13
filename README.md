# CalMe - Ứng Dụng Đặt Lịch Thông Minh

+ ## Demo
+ ![](https://i.ibb.co/pZdyyx1/2024-12-13-222938.png)
+ ![](https://i.ibb.co/w4kmS0k/2024-12-13-222756.png)
+ ![](https://i.ibb.co/RDQmZ6m/2024-12-13-223150.png)
+ ![](https://i.ibb.co/vmNLzfd/2024-12-13-223133.png)
+ ![](https://i.ibb.co/x6qbQ5k/2024-12-13-223019.png)
+ ![](https://i.ibb.co/nm28h7v/2024-12-13-223002.png)
+ ![](https://i.ibb.co/1sbnbHF/2024-12-13-223516.png)

## Giới Thiệu

CalMe là một ứng dụng đặt lịch thông minh, giúp bạn quản lý lịch hẹn một cách hiệu quả. Được xây dựng với Node.js và tích hợp với Google Calendar, CalMe cung cấp giải pháp toàn diện cho việc quản lý thời gian.

## Tính Năng Chính

- 📅 Đồng bộ với Google Calendar
- 🔗 Tạo liên kết đặt lịch tùy chỉnh
- 📧 Thông báo email tự động
- 📱 Giao diện responsive trên mọi thiết bị
- 🔒 Xác thực qua Google OAuth
- ⚡ Trải nghiệm người dùng mượt mà

## Cài Đặt

1. Clone repository:
   ```
   git clone https://github.com/khadnhdev/CalMe.git
   ```

2. Cài đặt dependencies:
   ```
   npm install
   ```

3. Tạo file .env từ .env.example và cập nhật các biến môi trường

    ### Cấu hình Google OAuth:
    1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
    2. Tạo project mới hoặc chọn project có sẵn
    3. Vào APIs & Services > Credentials
    4. Tạo OAuth 2.0 Client ID mới:
       - Application type: Web application
       - Authorized redirect URIs: http://localhost:3000/auth/google/callback
    5. Copy Client ID và Client Secret vào .env:
       ```
       GOOGLE_CLIENT_ID=your_client_id
       GOOGLE_CLIENT_SECRET=your_client_secret
       GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
       ```

    ### Cấu hình Email (Gmail):
    1. Vào Google Account > Security
    2. Bật 2-Step Verification
    3. Tạo App Password:
       - Select app: Mail
       - Select device: Other (Custom name)
       - Đặt tên (vd: CalMe)
    4. Copy mật khẩu 16 ký tự vào .env:
       ```
       EMAIL_USER=your_gmail_address
       EMAIL_PASSWORD=your_16_digit_app_password
       ```

    ### Cấu hình khác:
    ```
    SESSION_SECRET=your_random_secret_key
    APP_NAME=CalMe
    PORT=3000
    DB_PATH=./db/database.sqlite
    ```

4. Khởi tạo database:
   ```
   npm run init-db
   ```

5. Chạy ứng dụng:
   ```
   npm run dev
   ```

## Công Nghệ Sử Dụng

- Node.js & Express
- SQLite3
- EJS Template Engine
- Tailwind CSS
- Google Calendar API
- Nodemailer

## Đóng Góp

Mọi đóng góp đều được chào đón! Hãy tạo pull request hoặc báo cáo lỗi trong mục Issues.

## Tác Giả

**Kha Dang**
- GitHub: [khadnhdev](https://github.com/khadnhdev)
- LinkedIn: [Kha Dang](https://www.linkedin.com/in/khadnh)

## License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết. 

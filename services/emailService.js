const nodemailer = require('nodemailer');

// Thêm template HTML chung cho email
const emailTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #ffffff;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .logo {
            width: 120px;
            height: auto;
        }
        .content {
            padding: 30px 0;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4F46E5;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #4338CA;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6B7280;
        }
        .info-box {
            background: #F3F4F6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .info-item {
            margin: 10px 0;
        }
        .highlight {
            color: #4F46E5;
            font-weight: 500;
        }
        .icon {
            color: #4F46E5;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="https://your-logo-url.com/logo.png" alt="Logo" class="logo">
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
            <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email support@yourcompany.com</p>
        </div>
    </div>
</body>
</html>
`;

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendAppointmentCreated(appointment, host) {
    const { guest_email, title, start_time, end_time, description } = appointment;
    if (!guest_email) return;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: guest_email,
      subject: `Lịch hẹn mới: ${title}`,
      html: `
        <h2>Bạn có một lịch hẹn mới</h2>
        <p><strong>Tiêu đề:</strong> ${title}</p>
        <p><strong>Thời gian bắt đầu:</strong> ${formatDateTime(start_time)}</p>
        <p><strong>Thời gian kết thúc:</strong> ${formatDateTime(end_time)}</p>
        ${description ? `<p><strong>Mô tả:</strong> ${description}</p>` : ''}
        <p>
          <a href="http://${host}/appointments/guest/${appointment.id}" 
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Xem chi tiết
          </a>
        </p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Lỗi khi gửi email thông báo:', error);
    }
  }

  async sendAppointmentUpdated(appointment, host) {
    const { guest_email, title, start_time, end_time, description } = appointment;
    if (!guest_email) return;

    const content = `
        <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">
            Lịch hẹn đã được cập nhật 🔄
        </h1>
        <p>Xin chào,</p>
        <p>Lịch hẹn của bạn đã được cập nhật với những thông tin mới sau:</p>
        
        <div class="info-box">
            <div class="info-item">
                <span class="icon">📌</span>
                <span class="highlight">Tiêu đề:</span> ${title}
            </div>
            <div class="info-item">
                <span class="icon">🕒</span>
                <span class="highlight">Thời gian mới:</span> ${formatDateTime(start_time)}
            </div>
            ${description ? `
            <div class="info-item">
                <span class="icon">📝</span>
                <span class="highlight">Mô tả:</span> ${description}
            </div>
            ` : ''}
        </div>

        <p>Nhấn vào nút bên dưới để xem chi tiết cập nhật:</p>
        
        <div style="text-align: center;">
            <a href="http://${host}/appointments/guest/${appointment.id}" class="button">
                Xem chi tiết
            </a>
        </div>
    `;

    const mailOptions = {
      from: {
        name: 'Your Company Name',
        address: process.env.EMAIL_USER
      },
      to: guest_email,
      subject: `🔄 Cập nhật lịch hẹn: ${title}`,
      html: emailTemplate(content)
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Lỗi khi gửi email thông báo:', error);
    }
  }

  async sendAppointmentCancelled(appointment, host) {
    const { guest_email, title } = appointment;
    if (!guest_email) return;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: guest_email,
      subject: `Lịch hẹn đã bị hủy: ${title}`,
      html: `
        <h2>Lịch hẹn đã bị hủy</h2>
        <p><strong>Tiêu đề:</strong> ${title}</p>
        <p>Lịch hẹn này đã bị hủy bởi người tạo.</p>
        <p>Vui lòng liên hệ để biết thêm chi tiết nếu cần.</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Lỗi khi gửi email thông báo:', error);
    }
  }

  async sendReminderEmail(appointment, host) {
    const { guest_email, title, start_time, description } = appointment;
    if (!guest_email) return;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: guest_email,
      subject: `Nhắc nhở: ${title}`,
      html: `
        <h2>Nhắc nhở lịch hẹn sắp diễn ra</h2>
        <p><strong>Tiêu đề:</strong> ${title}</p>
        <p><strong>Thời gian:</strong> ${formatDateTime(start_time)}</p>
        ${description ? `<p><strong>Mô tả:</strong> ${description}</p>` : ''}
        <p>
          <a href="http://${host}/appointments/guest/${appointment.id}" 
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Xem chi tiết
          </a>
        </p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Lỗi khi gửi email nhắc nhở:', error);
    }
  }

  async sendCreatorNotification(appointment, template, host) {
    const { creator_email, title, guest_email } = appointment;

    const templates = {
      appointmentAccepted: {
        subject: `Lịch hẹn được chấp nhận: ${title}`,
        html: `
          <h2>Lịch hẹn đã được chấp nhận</h2>
          <p><strong>Tiêu đề:</strong> ${title}</p>
          <p><strong>Khách:</strong> ${guest_email}</p>
          <p>Khách mời đã đồng ý tham gia lịch hẹn.</p>
          <p>
            <a href="http://${host}/appointments/${appointment.id}"
               style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Xem chi tiết
            </a>
          </p>
        `
      },
      appointmentDeclined: {
        subject: `Lịch hẹn bị từ chối: ${title}`,
        html: `
          <h2>Lịch hẹn đã bị từ chối</h2>
          <p><strong>Tiêu đề:</strong> ${title}</p>
          <p><strong>Khách:</strong> ${guest_email}</p>
          <p>Khách mời không thể tham gia lịch hẹn này.</p>
          <p>
            <a href="http://${host}/appointments/${appointment.id}"
               style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Xem chi tiết
            </a>
          </p>
        `
      }
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: creator_email,
      subject: templates[template].subject,
      html: templates[template].html
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Lỗi khi gửi email thông báo:', error);
    }
  }

  async sendBookingNotification(booking, link, host) {
    // Email cho người đặt lịch
    const guestContent = `
        <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">
            Xác nhận đặt lịch thành công! 🎉
        </h1>
        <p>Xin chào ${booking.name},</p>
        <p>Cảm ơn bạn đã đặt lịch. Dưới đây là thông tin chi tiết cuộc hẹn của bạn:</p>
        
        <div class="info-box">
            <div class="info-item">
                <span class="icon">📌</span>
                <span class="highlight">Tiêu đề:</span> ${link.title}
            </div>
            <div class="info-item">
                <span class="icon">🕒</span>
                <span class="highlight">Thời gian:</span> ${formatDateTime(booking.startTime)}
            </div>
            <div class="info-item">
                <span class="icon">⏱️</span>
                <span class="highlight">Thời lượng:</span> ${link.duration} phút
            </div>
            ${booking.note ? `
            <div class="info-item">
                <span class="icon">📝</span>
                <span class="highlight">Ghi chú:</span> ${booking.note}
            </div>
            ` : ''}
        </div>

        <p>Nhấn vào nút bên dưới để xem chi tiết và quản lý cuộc hẹn của bạn:</p>
        
        <div style="text-align: center;">
            <a href="http://${host}/appointments/guest/${booking.id}" class="button">
                Xem chi tiết cuộc hẹn
            </a>
        </div>

        <p style="margin-top: 30px;">
            <span class="highlight">Lưu ý:</span> Bạn có thể thêm sự kiện này vào lịch của mình bằng cách nhấn vào nút "Thêm vào lịch" trong trang chi tiết.
        </p>
    `;

    // Email cho người tạo liên kết
    const creatorContent = `
        <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">
            Có lịch hẹn mới! 📅
        </h1>
        <p>Xin chào,</p>
        <p>Bạn vừa nhận được một lịch hẹn mới từ liên kết đặt lịch "${link.title}".</p>
        
        <div class="info-box">
            <div class="info-item">
                <span class="icon">👤</span>
                <span class="highlight">Người đặt:</span> ${booking.name}
            </div>
            <div class="info-item">
                <span class="icon">📧</span>
                <span class="highlight">Email:</span> ${booking.email}
            </div>
            <div class="info-item">
                <span class="icon">🕒</span>
                <span class="highlight">Thời gian:</span> ${formatDateTime(booking.startTime)}
            </div>
            <div class="info-item">
                <span class="icon">⏱️</span>
                <span class="highlight">Thời lượng:</span> ${link.duration} phút
            </div>
            ${booking.note ? `
            <div class="info-item">
                <span class="icon">📝</span>
                <span class="highlight">Ghi chú:</span> ${booking.note}
            </div>
            ` : ''}
        </div>

        <p>Vui lòng xác nhận hoặc từ chối lịch hẹn này bằng cách nhấn vào nút bên dưới:</p>
        
        <div style="text-align: center;">
            <a href="http://${host}/appointments/${booking.id}" class="button">
                Quản lý lịch hẹn
            </a>
        </div>
    `;

    const guestMailOptions = {
        from: {
            name: 'Your Company Name',
            address: process.env.EMAIL_USER
        },
        to: booking.email,
        subject: `✨ Xác nhận đặt lịch: ${link.title}`,
        html: emailTemplate(guestContent)
    };

    const creatorMailOptions = {
        from: {
            name: 'Your Company Name',
            address: process.env.EMAIL_USER
        },
        to: link.creator_email,
        subject: `📅 Lịch hẹn mới từ ${booking.name}`,
        html: emailTemplate(creatorContent)
    };

    try {
        await Promise.all([
            this.transporter.sendMail(guestMailOptions),
            this.transporter.sendMail(creatorMailOptions)
        ]);
    } catch (error) {
        console.error('Lỗi khi gửi email thông báo đặt lịch:', error);
    }
  }

  async sendBookingLink({ recipientEmail, message, bookingUrl, link, creator }) {
    const mailOptions = {
      to: recipientEmail,
      subject: `Lời mời đặt lịch từ ${creator}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Lời mời đặt lịch</h2>
          
          <p>${creator} đã gửi cho bạn một lời mời đặt lịch:</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${link.title}</h3>
            <p>Thời lượng: ${link.duration} phút</p>
            ${link.description ? `<p>${link.description}</p>` : ''}
          </div>

          ${message ? `<p>Lời nhắn: ${message}</p>` : ''}
          
          <p>Vui lòng click vào nút bên dưới để chọn thời gian phù hợp với bạn:</p>
          
          <a href="${bookingUrl}" 
             style="display: inline-block; background: #4F46E5; color: white; 
                    padding: 12px 24px; text-decoration: none; border-radius: 5px;
                    margin: 20px 0;">
            Đặt lịch ngay
          </a>
          
          <p style="color: #666; font-size: 14px;">
            Hoặc copy liên kết này: ${bookingUrl}
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
}

module.exports = new EmailService(); 
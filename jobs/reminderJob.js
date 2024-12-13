const cron = require('node-cron');
const { db } = require('../config/database');
const emailService = require('../services/emailService');

// Chạy mỗi giờ
cron.schedule('0 * * * *', async () => {
  try {
    // Lấy các lịch hẹn sắp diễn ra trong 24h tới
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM appointments 
         WHERE start_time BETWEEN ? AND ?
         AND status = 'confirmed'
         AND reminder_sent = 0`,
        [now.toISOString(), tomorrow.toISOString()],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    // Gửi email nhắc nhở
    for (const appointment of appointments) {
      await emailService.sendReminderEmail(appointment, process.env.APP_HOST);
      
      // Đánh dấu đã gửi nhắc nhở
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE appointments SET reminder_sent = 1 WHERE id = ?',
          [appointment.id],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
  } catch (error) {
    console.error('Lỗi khi gửi email nhắc nhở:', error);
  }
}); 
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const emailService = require('../services/emailService');
const GoogleCalendarService = require('../services/googleCalendar');

// Trang đặt lịch cho khách
router.get('/:slug', async (req, res) => {
  console.log('Đang tìm liên kết với slug:', req.params.slug);
  try {
    const link = await new Promise((resolve, reject) => {
      console.log('Đang query database...');
      db.get(
        `SELECT booking_links.*, users.name as creator_name, users.email as creator_email
         FROM booking_links 
         LEFT JOIN users ON booking_links.user_id = users.id
         WHERE slug = ?`,
        [req.params.slug],
        (err, row) => {
          console.log('Kết quả query:', { error: err, link: row });
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      console.log('Không tìm thấy liên kết');
      return res.status(404).render('error', { 
        message: 'Không tìm thấy liên kết đặt lịch' 
      });
    }

    console.log('Đang render view với link:', link);
    console.log('Đường dẫn view:', require('path').resolve('views/book/index.ejs'));
    res.render('book/index', {
      link,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chi tiết lỗi:', error);
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// Xử lý đặt lịch từ khách
router.post('/:slug', async (req, res) => {
  const { name, email, date, time, note } = req.body;

  try {
    const link = await new Promise((resolve, reject) => {
      db.get(
        `SELECT booking_links.*, users.google_token
         FROM booking_links 
         LEFT JOIN users ON booking_links.user_id = users.id
         WHERE slug = ?`,
        [req.params.slug],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      return res.status(404).json({ 
        message: 'Không tìm thấy liên kết đặt lịch' 
      });
    }

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + link.duration * 60000);

    // Tạo lịch hẹn mới
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO appointments (
          user_id, title, description, start_time, end_time, 
          guest_name, guest_email, status, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'booking_link')`,
        [
          link.user_id,
          `Lịch hẹn với ${name}`,
          note,
          startTime.toISOString(),
          endTime.toISOString(),
          name,
          email
        ],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    // Thêm sự kiện vào Google Calendar
    if (link.google_token) {
      try {
        await GoogleCalendarService.addEvent(
          JSON.parse(link.google_token),
          {
            title: `Lịch hẹn với ${name}`,
            guest_name: name,
            guest_email: email,
            note: note,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
          }
        );
      } catch (calendarError) {
        console.error('Lỗi khi thêm vào Google Calendar:', calendarError);
        // Vẫn tiếp tục xử lý nếu không thêm được vào Google Calendar
      }
    }

    // Gửi email thông báo
    await emailService.sendBookingNotification(
      { id: result, name, email, startTime, endTime, note },
      link,
      req.get('host')
    );

    res.redirect(`/book/${req.params.slug}?success=booked`);
  } catch (error) {
    console.error('Lỗi khi đặt lịch:', error);
    res.redirect(`/book/${req.params.slug}?error=booking_failed`);
  }
});

module.exports = router; 
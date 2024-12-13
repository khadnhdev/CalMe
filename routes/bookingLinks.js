const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { db } = require('../config/database');
const { generateSlug } = require('../utils/stringUtils');
const emailService = require('../services/emailService');

// Trang quản lý liên kết đặt lịch
router.get('/', isAuthenticated, async (req, res) => {
  console.log('=== DEBUG: Truy cập trang booking links ===');
  console.log('User:', req.session?.user);
  try {
    const links = await new Promise((resolve, reject) => {
      console.log('Đang query booking links cho user_id:', req.session.user.id);
      db.all(
        'SELECT * FROM booking_links WHERE user_id = ? ORDER BY created_at DESC',
        [req.session.user.id],
        (err, rows) => {
          console.log('Kết quả query:', { error: err, rows });
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    console.log('Đang render view với links:', links);
    res.render('booking-links/index', {
      links,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chi tiết lỗi:', error);
    console.error('Lỗi khi tải danh sách liên kết:', error);
    res.render('booking-links/index', {
      links: [],
      error: 'Không thể tải danh sách liên kết'
    });
  }
});

// Tạo liên kết mới
router.post('/', isAuthenticated, async (req, res) => {
  const { title, duration, description } = req.body;
  
  try {
    if (!title || !duration) {
      return res.redirect('/booking-links?error=missing_fields');
    }

    const slug = generateSlug(title);

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO booking_links (user_id, title, slug, duration, description)
         VALUES (?, ?, ?, ?, ?)`,
        [req.session.user.id, title, slug, duration, description],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.redirect('/booking-links?success=created');
  } catch (error) {
    console.error('Lỗi khi tạo liên kết:', error);
    res.redirect('/booking-links?error=create_failed');
  }
});

// Xóa liên kết
router.post('/:id/delete', isAuthenticated, async (req, res) => {
  try {
    const link = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM booking_links WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      return res.redirect('/booking-links?error=not_found');
    }

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM booking_links WHERE id = ?',
        [req.params.id],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.redirect('/booking-links?success=deleted');
  } catch (error) {
    console.error('Lỗi khi xóa liên kết:', error);
    res.redirect('/booking-links?error=delete_failed');
  }
});

// Gửi liên kết đặt lịch qua email
router.post('/:id/share', isAuthenticated, async (req, res) => {
  const { recipientEmail, message } = req.body;
  
  try {
    // Lấy thông tin booking link
    const link = await new Promise((resolve, reject) => {
      db.get(
        `SELECT booking_links.*, users.name as creator_name 
         FROM booking_links 
         LEFT JOIN users ON booking_links.user_id = users.id
         WHERE booking_links.id = ? AND booking_links.user_id = ?`,
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      return res.status(404).json({ error: 'Không tìm thấy liên kết' });
    }

    // Tạo URL đặt lịch
    const bookingUrl = `${req.protocol}://${req.get('host')}/book/${link.slug}`;

    // Gửi email
    await emailService.sendBookingLink({
      recipientEmail,
      message,
      bookingUrl,
      link,
      creator: link.creator_name
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi khi gửi liên kết:', error);
    res.status(500).json({ error: 'Không thể gửi liên kết' });
  }
});

// Trang đặt lịch cho khách
router.get('/book/:slug', async (req, res) => {
  console.log('Đang tìm liên kết với slug:', req.params.slug);
  try {
    const link = await new Promise((resolve, reject) => {
      db.get(
        `SELECT booking_links.*, users.name as creator_name, users.email as creator_email
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
      return res.status(404).render('error', { 
        message: 'Không tìm thấy liên kết đặt lịch' 
      });
    }

    res.render('booking-links/book', {
      link,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Lỗi khi tải trang đặt lịch:', error);
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// Xử lý đặt lịch từ khách
router.post('/book/:slug', async (req, res) => {
  const { name, email, date, time, note } = req.body;

  try {
    const link = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM booking_links WHERE slug = ?', [req.params.slug],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      return res.status(404).render('error', { 
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

    // Gửi email thông báo
    await emailService.sendBookingNotification(
      { id: result, name, email, startTime, endTime, note },
      link,
      req.get('host')
    );

    res.redirect(`/booking-links/book/${req.params.slug}?success=booked`);
  } catch (error) {
    console.error('Lỗi khi đặt lịch:', error);
    res.redirect(`/booking-links/book/${req.params.slug}?error=booking_failed`);
  }
});

module.exports = router; 
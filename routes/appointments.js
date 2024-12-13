const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { db } = require('../config/database');
const googleCalendar = require('../services/googleCalendar');
const emailService = require('../services/emailService');
const { bookingValidation } = require('../middleware/validation');
const { generateSlug } = require('../utils/stringUtils');

// Danh sách lịch hẹn
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const appointments = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM appointments WHERE user_id = ? ORDER BY start_time DESC',
        [req.session.user.id],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.render('appointments/list', { 
      appointments,
      error: null,
      success: req.query.success
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lịch hẹn:', error);
    res.render('appointments/list', { 
      appointments: [],
      error: 'Không thể tải danh sách lịch hẹn',
      success: null
    });
  }
});

// API endpoint cho FullCalendar
router.get('/events', isAuthenticated, async (req, res) => {
  const { start, end } = req.query;
  
  try {
    const query = `
      SELECT * FROM appointments 
      WHERE user_id = ? 
      AND start_time >= ? 
      AND end_time <= ?
    `;

    const appointments = await new Promise((resolve, reject) => {
      db.all(query, [req.session.user.id, start, end], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    // Chuyển đổi sang định dạng FullCalendar
    const events = appointments.map(apt => ({
      id: apt.id,
      title: apt.title,
      start: apt.start_time,
      end: apt.end_time,
      className: getStatusClass(apt.status)
    }));

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Không thể tải sự kiện' });
  }
});

function getStatusClass(status) {
  switch (status) {
    case 'pending': return 'bg-yellow-200 border-yellow-600';
    case 'confirmed': return 'bg-green-200 border-green-600';
    case 'cancelled': return 'bg-red-200 border-red-600';
    default: return 'bg-gray-200 border-gray-600';
  }
}

// Chi tiết lịch hẹn
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get(
        `SELECT appointments.*, users.name as creator_name 
         FROM appointments 
         LEFT JOIN users ON appointments.user_id = users.id 
         WHERE appointments.id = ? AND appointments.user_id = ?`,
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!appointment) {
      return res.status(404).render('error', { 
        message: 'Không tìm thấy lịch hẹn' 
      });
    }

    res.render('appointments/detail', {
      appointment,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// Cập nhật trạng thái lịch hẹn
router.post('/:id/status', isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.redirect(`/appointments/${req.params.id}?error=invalid_status`);
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE appointments SET status = ? WHERE id = ? AND user_id = ?',
        [status, req.params.id, req.session.user.id],
        async function(err) {
          if (err) reject(err);
          
          // Nếu đã kết nối Google Calendar
          if (status === 'cancelled') {
            try {
              const apt = await new Promise((resolve, reject) => {
                db.get('SELECT google_event_id FROM appointments WHERE id = ?', 
                  [req.params.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                  });
              });
              
              if (apt?.google_event_id) {
                await googleCalendar.deleteEvent(req.session.user.id, apt.google_event_id);
              }
            } catch (error) {
              console.error('Lỗi khi xóa sự kiện Google Calendar:', error);
            }
          }
          
          resolve();
        }
      );
    });

    if (status === 'cancelled') {
      await emailService.sendAppointmentCancelled(appointment, req.get('host'));
    }

    res.redirect(`/appointments/${req.params.id}?success=status_updated`);
  } catch (error) {
    res.redirect(`/appointments/${req.params.id}?error=update_failed`);
  }
});

// Xóa lịch hẹn
router.post('/:id/delete', isAuthenticated, async (req, res) => {
  try {
    // Kiểm tra và xóa sự kiện Google Calendar nếu có
    const appointment = await new Promise((resolve, reject) => {
      db.get('SELECT google_event_id FROM appointments WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (appointment?.google_event_id) {
      try {
        await googleCalendar.deleteEvent(req.session.user.id, appointment.google_event_id);
      } catch (error) {
        console.error('Lỗi khi xóa sự kiện Google Calendar:', error);
      }
    }

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM appointments WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.user.id],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.redirect('/appointments?success=deleted');
  } catch (error) {
    res.redirect(`/appointments/${req.params.id}?error=delete_failed`);
  }
});

// Trang chỉnh sửa lịch hẹn
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM appointments WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!appointment) {
      return res.status(404).render('error', { 
        message: 'Không tìm thấy lịch hẹn' 
      });
    }

    // Format datetime-local input
    appointment.start_time = new Date(appointment.start_time)
      .toISOString().slice(0, 16);
    appointment.end_time = new Date(appointment.end_time)
      .toISOString().slice(0, 16);

    res.render('appointments/edit', {
      appointment,
      error: req.query.error
    });
  } catch (error) {
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// Xử lý chỉnh sửa lịch hẹn
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  const { title, description, start_time, end_time, guest_email } = req.body;

  try {
    // Kiểm tra lịch hẹn tồn tại và thuộc về user
    const appointment = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM appointments WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!appointment) {
      return res.status(404).render('error', { 
        message: 'Không tìm thấy lịch hẹn' 
      });
    }

    // Cập nhật trong database
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE appointments 
         SET title = ?, description = ?, start_time = ?, end_time = ?, guest_email = ?
         WHERE id = ? AND user_id = ?`,
        [title, description, start_time, end_time, guest_email, req.params.id, req.session.user.id],
        async function(err) {
          if (err) reject(err);

          // Cập nhật sự kiện trong Google Calendar nếu đã kết nối
          if (appointment.google_event_id) {
            try {
              await googleCalendar.updateEvent(req.session.user.id, {
                ...appointment,
                title,
                description,
                start_time,
                end_time,
                guest_email
              });
            } catch (error) {
              console.error('Lỗi khi cập nhật Google Calendar:', error);
            }
          }

          resolve();
        }
      );
    });

    await emailService.sendAppointmentUpdated(appointment, req.get('host'));

    res.redirect(`/appointments/${req.params.id}?success=updated`);
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch hẹn:', error);
    res.redirect(`/appointments/${req.params.id}/edit?error=update_failed`);
  }
});

// Trong route tạo lịch hẹn
router.post('/create', isAuthenticated, async (req, res) => {
  // ... code hiện tại ...

  try {
    // Sau khi tạo lịch hẹn thành công
    await emailService.sendAppointmentCreated(appointment, req.get('host'));
    res.redirect(`/appointments/${appointmentId}`);
  } catch (error) {
    // ... xử lý lỗi ...
  }
});

// Trang xem lịch cho khách
router.get('/guest/:id', async (req, res) => {
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get(
        `SELECT appointments.*, users.name as creator_name, users.email as creator_email
         FROM appointments 
         LEFT JOIN users ON appointments.user_id = users.id 
         WHERE appointments.id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!appointment) {
      return res.status(404).render('error', { 
        message: 'Không tìm thấy lịch hẹn' 
      });
    }

    res.render('appointments/guest-view', {
      appointment,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// API xác nhận/từ chối lịch hẹn từ khách
router.post('/guest/:id/respond', async (req, res) => {
  const { response } = req.body;
  const validResponses = ['accept', 'decline'];

  if (!validResponses.includes(response)) {
    return res.redirect(`/appointments/guest/${req.params.id}?error=invalid_response`);
  }

  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!appointment) {
      return res.status(404).render('error', { 
        message: 'Không tìm thấy lịch hẹn' 
      });
    }

    // Cập nhật trạng thái
    const status = response === 'accept' ? 'confirmed' : 'cancelled';
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE appointments SET status = ?, guest_response = ? WHERE id = ?',
        [status, response, req.params.id],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Gửi email thông báo cho người tạo
    const emailTemplate = response === 'accept' 
      ? 'appointmentAccepted'
      : 'appointmentDeclined';
    
    await emailService.sendCreatorNotification(
      appointment,
      emailTemplate,
      req.get('host')
    );

    res.redirect(`/appointments/guest/${req.params.id}?success=response_recorded`);
  } catch (error) {
    console.error('Lỗi khi xử lý phản hồi:', error);
    res.redirect(`/appointments/guest/${req.params.id}?error=response_failed`);
  }
});

// Trang quản lý liên kết đặt lịch
router.get('/booking-links', isAuthenticated, async (req, res) => {
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

    console.log('Links được tìm thấy:', links);
    console.log('Đang render view:', 'appointments/booking-links.ejs');
    res.render('appointments/booking-links', {
      links,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chi tiết lỗi:', error);
    console.error('Lỗi khi tải danh sách liên kết:', error);
    res.render('appointments/booking-links', {
      links: [],
      error: 'Không thể tải danh sách liên kết'
    });
  }
});

// Tạo liên kết đặt lịch mới
router.post('/booking-links', isAuthenticated, async (req, res) => {
  const { title, duration, description } = req.body;
  console.log('Đang tạo booking link:', { title, duration, description });
  
  try {
    if (!title || !duration) {
      console.log('Thiếu thông tin bắt buộc');
      return res.redirect('/appointments/booking-links?error=missing_fields');
    }

    const slug = generateSlug(title);
    console.log('Đã tạo slug:', slug);

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO booking_links (user_id, title, slug, duration, description)
         VALUES (?, ?, ?, ?, ?)`,
        [req.session.user.id, title, slug, duration, description],
        function(err) {
          console.log('Kết quả tạo booking link:', { error: err, lastID: this.lastID });
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    console.log('Đã tạo booking link thành công');
    res.redirect('/appointments/booking-links?success=created');
  } catch (error) {
    console.error('Chi tiết lỗi khi tạo liên kết:', error);
    res.redirect('/appointments/booking-links?error=create_failed');
  }
});

// Xóa liên kết đặt lịch
router.post('/booking-links/:id/delete', isAuthenticated, async (req, res) => {
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
      return res.redirect('/appointments/booking-links?error=not_found');
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

    res.redirect('/appointments/booking-links?success=deleted');
  } catch (error) {
    console.error('Lỗi khi xóa liên kết:', error);
    res.redirect('/appointments/booking-links?error=delete_failed');
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
          console.log('Kết quả truy vấn:', { error: err, link: row });
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

    console.log('Đã tìm thấy liên kết:', link);
    res.render('appointments/book', {
      link,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chi tiết lỗi khi tải trang đặt lịch:', error);
    res.render('error', { message: 'Lỗi hệ thống' });
  }
});

// Xử lý đặt lịch từ khách
router.post('/book/:slug', bookingValidation, async (req, res) => {
  console.log('Nhận yêu cầu đặt lịch:', {
    slug: req.params.slug,
    body: req.body
  });
  const { name, email, date, time, note } = req.body;

  try {
    const link = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM booking_links WHERE slug = ?',
        [req.params.slug],
        (err, row) => {
          console.log('Kết quả tìm liên kết:', { error: err, link: row });
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (!link) {
      console.log('Không tìm thấy liên kết khi đặt lịch');
      return res.status(404).render('error', { 
        message: 'Không tìm thấy liên kết đặt lịch' 
      });
    }

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + link.duration * 60000);

    console.log('Thông tin lịch hẹn sẽ tạo:', {
      startTime,
      endTime,
      duration: link.duration
    });

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
          console.log('Kết quả tạo lịch hẹn:', {
            error: err,
            appointmentId: this.lastID
          });
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    console.log('Đã tạo lịch hẹn thành công, ID:', result);

    // Gửi email thông báo
    await emailService.sendBookingNotification(
      { id: result, name, email, startTime, endTime, note },
      link,
      req.get('host')
    );

    res.redirect(`/appointments/book/${req.params.slug}?success=booked`);
  } catch (error) {
    console.error('Chi tiết lỗi khi đặt lịch:', error);
    res.redirect(`/appointments/book/${req.params.slug}?error=booking_failed`);
  }
});

module.exports = router; 
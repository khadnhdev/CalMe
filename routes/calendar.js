const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const googleCalendar = require('../services/googleCalendar');
const { db } = require('../config/database');

// Trang cài đặt Calendar
router.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM calendar_settings WHERE user_id = ?',
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    res.render('calendar/settings', {
      isConnected: !!settings?.google_refresh_token,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    res.render('calendar/settings', { error: 'Lỗi hệ thống', isConnected: false });
  }
});

// Kết nối Google Calendar
router.get('/connect', isAuthenticated, async (req, res) => {
  try {
    const authUrl = await googleCalendar.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    res.redirect('/calendar/settings?error=auth_failed');
  }
});

// Google Calendar callback
router.get('/callback', isAuthenticated, async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await googleCalendar.oauth2Client.getToken(code);
    
    // Lưu refresh token
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO calendar_settings (user_id, google_refresh_token) 
         VALUES (?, ?)
         ON CONFLICT(user_id) 
         DO UPDATE SET google_refresh_token = excluded.google_refresh_token`,
        [req.session.user.id, tokens.refresh_token],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.redirect('/calendar/settings?success=connected');
  } catch (error) {
    console.error('Lỗi khi kết nối Google Calendar:', error);
    res.redirect('/calendar/settings?error=connection_failed');
  }
});

// Ngắt kết nối Google Calendar
router.post('/disconnect', isAuthenticated, async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM calendar_settings WHERE user_id = ?',
        [req.session.user.id],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
    res.redirect('/calendar/settings?success=disconnected');
  } catch (error) {
    res.redirect('/calendar/settings?error=disconnect_failed');
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('../config/database');
const { google } = require('googleapis');

// Khởi tạo OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// Khởi tạo passport
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('Callback URL:', process.env.GOOGLE_CALLBACK_URL);
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Kiểm tra user trong database
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });

      if (user) {
        // Cập nhật thông tin nếu user đã tồn tại
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE users SET name = ?, email = ?, google_token = ? WHERE google_id = ?',
            [
              profile.displayName, 
              profile.emails[0].value,
              JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
              profile.id
            ],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });
        return done(null, user);
      }

      // Tạo user mới nếu chưa tồn tại
      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (google_id, name, email, google_token) VALUES (?, ?, ?, ?)',
          [
            profile.id, 
            profile.displayName, 
            profile.emails[0].value,
            JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
          ],
          function(err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });

      const newUser = {
        id: result,
        google_id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value
      };

      done(null, newUser);
    } catch (error) {
      done(error);
    }
  }
));

// Serialize user cho session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user từ session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Route bắt đầu đăng nhập Google
router.get('/google',
  passport.authenticate('google', { 
    scope: [
      'profile', 
      'email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })
);

// Callback URL sau khi đăng nhập Google
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Lưu user vào session
    req.session.user = req.user;
    res.redirect('/appointments');
  }
);

// Route đăng xuất
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router; 
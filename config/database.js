const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Đảm bảo đường dẫn đến thư mục db
const dbPath = path.resolve(__dirname, '../db/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Lỗi khi kết nối database:', err);
  } else {
    console.log('Đã kết nối database thành công');
  }
});

const initialize = () => {
  db.serialize(() => {
    // Tạo bảng users nếu chưa tồn tại
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE,
        name TEXT,
        email TEXT,
        google_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Kiểm tra xem cột google_token đã tồn tại chưa
    db.all("PRAGMA table_info(users)", (err, rows) => {
      if (err) {
        console.error('Lỗi khi kiểm tra schema:', err);
        return;
      }
      
      // Nếu chưa có cột google_token thì thêm vào
      const hasGoogleToken = rows.some(row => row.name === 'google_token');
      if (!hasGoogleToken) {
        console.log('Thêm cột google_token vào bảng users...');
        db.run('ALTER TABLE users ADD COLUMN google_token TEXT', (err) => {
          if (err) {
            console.error('Lỗi khi thêm cột google_token:', err);
          } else {
            console.log('Đã thêm cột google_token thành công');
          }
        });
      }
    });

    // Tạo bảng appointments
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      guest_name TEXT,
      guest_email TEXT,
      status TEXT DEFAULT 'pending',
      guest_response TEXT,
      reminder_sent INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Tạo bảng booking_links
    db.run(`CREATE TABLE IF NOT EXISTS booking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      duration INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Tạo các indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_booking_links_user ON booking_links(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_booking_links_slug ON booking_links(slug)');
  });
};

module.exports = {
  db,
  initialize
}; 
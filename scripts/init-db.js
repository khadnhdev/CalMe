const { db, initialize } = require('../config/database');

console.log('Đang khởi tạo database...');

initialize();

console.log('Đã khởi tạo database thành công!');

// Đóng kết nối sau khi hoàn tất
setTimeout(() => {
  db.close();
  process.exit(0);
}, 1000); 
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // Xử lý lỗi validation
  if (err.name === 'ValidationError') {
    return res.status(400).render('error', {
      message: 'Dữ liệu không hợp lệ',
      details: err.details
    });
  }

  // Xử lý lỗi database
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).render('error', {
      message: 'Lỗi ràng buộc dữ liệu'
    });
  }

  // Xử lý lỗi chung
  res.status(500).render('error', {
    message: 'Đã có lỗi xảy ra'
  });
}

module.exports = errorHandler; 
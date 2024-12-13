const { body, validationResult } = require('express-validator');

const bookingValidation = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Tên phải có ít nhất 2 ký tự'),
  
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ'),
  
  body('date')
    .isDate()
    .withMessage('Ngày không hợp lệ')
    .custom(value => {
      const date = new Date(value);
      const now = new Date();
      if (date < now) {
        throw new Error('Không thể đặt lịch cho ngày đã qua');
      }
      return true;
    }),
  
  body('time')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Thời gian không hợp lệ'),
  
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được quá 500 ký tự'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  bookingValidation
}; 
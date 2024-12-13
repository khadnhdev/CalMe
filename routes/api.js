const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// API lấy các khung giờ trống
router.get('/available-times', async (req, res) => {
  const { date, duration } = req.query;
  const selectedDate = new Date(date);
  
  try {
    // Lấy tất cả lịch hẹn trong ngày
    const appointments = await new Promise((resolve, reject) => {
      db.all(
        `SELECT start_time, end_time 
         FROM appointments 
         WHERE DATE(start_time) = DATE(?)
         AND status != 'cancelled'`,
        [date],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    // Tạo danh sách các khung giờ có thể đặt
    const availableTimes = [];
    const workingHours = {
      start: 9, // 9:00
      end: 17   // 17:00
    };

    // Chuyển duration từ phút sang milliseconds
    const durationMs = parseInt(duration) * 60 * 1000;

    // Tạo danh sách các khung giờ với bước 30 phút
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date(selectedDate);
        time.setHours(hour, minute, 0, 0);

        // Bỏ qua các khung giờ đã qua
        if (time < new Date()) continue;

        const endTime = new Date(time.getTime() + durationMs);
        
        // Kiểm tra xem khung giờ có bị trùng với lịch hẹn nào không
        const isAvailable = !appointments.some(apt => {
          const aptStart = new Date(apt.start_time);
          const aptEnd = new Date(apt.end_time);
          return (
            (time >= aptStart && time < aptEnd) ||
            (endTime > aptStart && endTime <= aptEnd) ||
            (time <= aptStart && endTime >= aptEnd)
          );
        });

        // Kiểm tra xem lịch hẹn có kết thúc trong giờ làm việc không
        const isWithinWorkingHours = endTime.getHours() <= workingHours.end;

        if (isAvailable && isWithinWorkingHours) {
          availableTimes.push(
            time.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          );
        }
      }
    }

    res.json(availableTimes);
  } catch (error) {
    console.error('Lỗi khi lấy khung giờ trống:', error);
    res.status(500).json({ error: 'Không thể lấy khung giờ trống' });
  }
});

// Lấy danh sách slot đã được đặt
router.get('/slots', async (req, res) => {
  const { date, userId } = req.query;
  
  try {
    const appointments = await new Promise((resolve, reject) => {
      db.all(
        `SELECT start_time, end_time 
         FROM appointments 
         WHERE user_id = ? 
         AND DATE(start_time) = DATE(?)
         AND status != 'cancelled'`,
        [userId, date],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.json(appointments);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách slot:', error);
    res.status(500).json({ error: 'Không thể lấy danh sách slot' });
  }
});

module.exports = router; 
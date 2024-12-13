const { google } = require('googleapis');
const { OAuth2 } = google.auth;

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

class GoogleCalendarService {
  static async addEvent(userToken, eventDetails) {
    try {
      oauth2Client.setCredentials({
        access_token: userToken.access_token,
        refresh_token: userToken.refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const event = {
        summary: eventDetails.title,
        description: `Lịch hẹn với ${eventDetails.guest_name}\n\nGhi chú: ${eventDetails.note || 'Không có'}`,
        start: {
          dateTime: eventDetails.start_time,
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: eventDetails.end_time,
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        attendees: [
          { email: eventDetails.guest_email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all', // Gửi email cho người tham gia
      });

      return response.data;
    } catch (error) {
      console.error('Lỗi khi thêm sự kiện vào Google Calendar:', error);
      throw error;
    }
  }
}

module.exports = GoogleCalendarService; 
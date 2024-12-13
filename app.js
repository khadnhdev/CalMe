require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { formatDateTime } = require('./utils/dateUtils');
const { getStatusClass, getStatusText } = require('./utils/appointmentUtils');

// Tạo thư mục db nếu chưa tồn tại
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Log middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Session configuration
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './db'
  }),
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Khởi tạo passport
app.use(passport.initialize());
app.use(passport.session());

// Truyền user vào tất cả views
app.use((req, res, next) => {
  res.locals.user = req.session?.user;
  res.locals.path = req.path;
  next();
});

// Database initialization
db.initialize();

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/appointments', require('./routes/appointments'));
app.use('/booking-links', require('./routes/bookingLinks'));
app.use('/book', require('./routes/book'));
app.use('/api', require('./routes/api'));

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Error handler
app.use(errorHandler);

// Debug view resolution
app.use((req, res, next) => {
  const render = res.render;
  res.render = function(view, options, callback) {
    console.log('Rendering view:', view);
    console.log('View path:', path.resolve(app.get('views'), view));
    render.call(this, view, options, callback);
  };
  next();
});

// Đăng ký helper functions cho tất cả views
app.locals.formatDateTime = formatDateTime;
app.locals.getStatusClass = getStatusClass;
app.locals.getStatusText = getStatusText;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
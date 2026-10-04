const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/userRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const perkRoutes = require('./routes/perkRoutes');
const jobRoutes = require('./routes/jobRoutes');
const academicRoutes = require('./routes/academicRoutes');
const scholarshipRoutes = require('./routes/scholarshipRoutes');
const aiRoutes = require('./routes/aiRoutes');
const communityRoutes = require('./routes/communityRoutes');
const gatePaperRoutes = require('./routes/gatePaperRoutes');
const { initializePerkCron } = require('./services/aiPerkSync');

const app = express();
const server = http.createServer(app);
app.use(cookieParser());

const ALLOWED_ORIGINS = [
  // Production
  'https://www.vidya-setu.org.in',
  'https://mini-project-eight-lime.vercel.app',

  // Localhost
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5500',
  'http://localhost:5501',
  'http://localhost:5502',

  // 127.0.0.1
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://127.0.0.1:5502'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. direct browser visits, curl, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    const envOrigin = process.env.FRONTEND_URL;
    if (envOrigin && origin === envOrigin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));

// ── Socket.io Setup ──────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const envOrigin = process.env.FRONTEND_URL;
      if ((envOrigin && origin === envOrigin) || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('Socket CORS blocked'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Track connected socket IDs mapped to userId
const onlineUsers = new Map(); // socketId -> userId

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Student comes online
  socket.on('student-online', (userId) => {
    onlineUsers.set(socket.id, userId);
    io.emit('online-students-update', { count: onlineUsers.size });
  });

  // Student goes offline
  socket.on('student-offline', (userId) => {
    onlineUsers.delete(socket.id);
    io.emit('online-students-update', { count: onlineUsers.size });
  });

  // Request current count
  socket.on('get-online-students', () => {
    socket.emit('online-students-update', { count: onlineUsers.size });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    onlineUsers.delete(socket.id);
    io.emit('online-students-update', { count: onlineUsers.size });
  });
});

// Make io accessible in route handlers
app.set('io', io);
// ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/users', userRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/perks', perkRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin-pyq', require('./routes/adminPyqRoutes'));
app.use('/api/gate-papers', gatePaperRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;

if (!mongoURI) {
  console.error("❌ ERROR: MONGO_URI is missing in your .env file!");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ Database Connected');

    // Initialize automatic background tasks after DB connection
    try {
      jobRoutes.initializeJobRefresh();
      console.log('✅ Automatic job refresh initialized');
      
      // Initialize AI Perk Sync Autopilot
      initializePerkCron();
    } catch (error) {
      console.error('⚠️ Failed to initialize background tasks:', error.message);
    }
  })
  .catch(err => {
    console.error('❌ Database Connection Error:');
    console.error(err.message);
  });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready on port ${PORT}`);
});


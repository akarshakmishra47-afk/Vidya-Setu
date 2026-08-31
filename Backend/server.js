require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
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

const app = express();
app.use(cookieParser());

const ALLOWED_ORIGINS = [
  'https://mini-project-eight-lime.vercel.app',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  null // file:// protocol (local file open)
];

app.use(cors({
  origin: (origin, callback) => {
    const envOrigin = process.env.FRONTEND_URL;
    if (envOrigin) {
      if (origin === envOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;

if (!mongoURI) {
  console.error("❌ ERROR: MONGO_URI is missing in your .env file!");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ Database Connected');
    
    // Initialize automatic job refresh after DB connection
    try {
      jobRoutes.initializeJobRefresh();
      console.log('✅ Automatic job refresh initialized');
    } catch (error) {
      console.error('⚠️  Failed to initialize job refresh:', error.message);
    }
  })
  .catch(err => {
    console.error('❌ Database Connection Error:');
    console.error(err.message);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

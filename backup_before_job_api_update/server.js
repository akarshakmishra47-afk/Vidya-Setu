require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const perkRoutes = require('./routes/perkRoutes');
const jobRoutes = require('./routes/jobRoutes');
const academicRoutes = require('./routes/academicRoutes');
const scholarshipRoutes = require('./routes/scholarshipRoutes');
const aiRoutes = require('./routes/aiRoutes');
const communityRoutes = require('./routes/communityRoutes');

const app = express();

app.use(cors({
  origin: 'https://mini-project-eight-lime.vercel.app',
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

const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;

if (!mongoURI) {
  console.error("❌ ERROR: MONGO_URI is missing in your .env file!");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Database Connected'))
  .catch(err => {
    console.error('❌ Database Connection Error:');
    console.error(err.message);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

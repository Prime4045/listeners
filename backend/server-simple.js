require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:12000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for audio files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    message: 'Listeners Backend API is running!'
  });
});

// Mock API endpoints for testing
app.get('/api/songs', (req, res) => {
  res.json({
    songs: [
      {
        id: '1',
        title: 'Midnight Dreams',
        artist: 'Luna Echo',
        duration: 208,
        coverImage: null,
        fileUrl: '/uploads/audio/sample1.mp3'
      },
      {
        id: '2',
        title: 'Electric Pulse',
        artist: 'Neon Waves',
        duration: 252,
        coverImage: null,
        fileUrl: '/uploads/audio/sample2.mp3'
      }
    ],
    total: 2
  });
});

app.get('/api/playlists', (req, res) => {
  res.json({
    playlists: [
      {
        id: '1',
        name: 'Chill Vibes',
        description: 'Relaxing music for any time',
        songCount: 24,
        coverImage: null
      },
      {
        id: '2',
        name: 'Workout Mix',
        description: 'High energy tracks',
        songCount: 18,
        coverImage: null
      }
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Listeners Backend Server (Simple Mode) running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:12000'}`);
  console.log(`📡 API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`\n✅ Backend is ready for frontend integration!`);
});

module.exports = app;
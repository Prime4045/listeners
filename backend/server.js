import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { createServer } from 'http';
import { Server } from 'socket.io';
import passport from 'passport';
import './config/passport.js'; // Initialize passport configuration
import { authenticateToken, securityHeaders } from './middleware/auth.js';
import { connectMongoDB, initializeRedis } from './config/database.js';
import { 
  securityHeaders, 
  corsConfig, 
  apiLimiter, 
  authLimiter, 
  searchLimiter,
  sanitizeRequest,
  securityLogger,
  preventParameterPollution
} from './middleware/security.js';
import {
  compressionMiddleware,
  timingMiddleware,
  memoryMonitor,
  requestIdMiddleware,
  optimizeResponse,
  gracefulShutdown
} from './middleware/performance.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import musicRoutes from './routes/music.js';
import playlistRoutes from './routes/playlists.js';
import songsRoutes from './routes/songs.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:12000',
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL || 'http://localhost:12000'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Enhanced middleware stack
app.use(cors(corsConfig));
app.use(securityHeaders);
app.use(requestIdMiddleware);
app.use(timingMiddleware);
app.use(memoryMonitor);
app.use(securityLogger);
app.use(preventParameterPollution);
app.use(sanitizeRequest);
app.use(compressionMiddleware);
app.use(optimizeResponse);

// Handle preflight requests explicitly
app.options('*', cors(corsConfig));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    ttl: 24 * 60 * 60,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Body parsing middleware
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF token generation
app.use(async (req, res, next) => {
  if (!req.session.csrfToken) {
    const crypto = await import('crypto');
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/music', apiLimiter, musicRoutes);
app.use('/api/music/search', searchLimiter); // Special rate limit for search
app.use('/api/playlists', apiLimiter, playlistRoutes);
app.use('/api/songs', apiLimiter, songsRoutes);

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '2.0.0',
    features: {
      authentication: true,
      mfa: true,
      realtime: true,
      security: true,
      musicPlayer: true,
      googleCloudStorage: true,
      spotify: true,
    },
  });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  if (socket.handshake.auth && socket.handshake.auth.token) {
    const token = socket.handshake.auth.token.split(' ')[1];
    authenticateToken({ headers: { authorization: socket.handshake.auth.token } }, {}, (err) => {
      if (err) {
        console.error('Socket.IO auth error:', err);
        return next(new Error('Authentication error'));
      }
      socket.user = socket.request.user;
      next();
    });
  } else {
    console.error('Socket.IO missing token');
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.user?.username);

  socket.on('join-room', async (roomId) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }
    socket.join(roomId);
    console.log(`User ${socket.user.username} joined room ${roomId}`);
  });

  socket.on('sync-playback', async (data) => {
    if (!data.roomId || typeof data.currentTime !== 'number' || typeof data.isPlaying !== 'boolean') {
      socket.emit('error', { message: 'Invalid playback data' });
      return;
    }
    socket.to(data.roomId).emit('playback-sync', data);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: Object.values(err.errors).map(e => e.message),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID format',
      code: 'INVALID_ID',
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: 'Duplicate entry',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectMongoDB();
    
    // Initialize Redis with error handling
    try {
      await initializeRedis();
      console.log('✅ Redis connected successfully');
    } catch (redisError) {
      console.warn('⚠️ Redis connection failed, continuing without Redis:', redisError.message);
    }

    const serverInstance = server.listen(PORT, '0.0.0.0', () => {
      console.log(`🎵 Listeners Backend Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`🔒 Enhanced Security: Rate limiting, CORS, Helmet, CSRF, Request sanitization`);
      console.log(`🔐 Authentication: JWT with refresh tokens, MFA support, Google OAuth`);
      console.log(`⚡ Performance: Compression, Caching, Request optimization`);
      console.log(`📧 Email service: ${process.env.SMTP_HOST ? 'Configured' : 'Not configured'}`);
      console.log(`🎶 Music Player: Spotify API + Amazon S3 + MongoDB`);
      console.log(`☁️ Amazon S3: ${process.env.AWS_ACCESS_KEY_ID ? 'Configured' : 'Not configured'}`);
      console.log(`🎵 Spotify API: ${process.env.SPOTIFY_CLIENT_ID ? 'Configured' : 'Not configured'}`);
      console.log(`🚀 Server ready for production use!`);
    });
    
    // Setup graceful shutdown
    gracefulShutdown(serverInstance);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
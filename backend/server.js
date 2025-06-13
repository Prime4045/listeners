import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authenticateToken } from './middleware/auth.js';
import { connectMongoDB, initializeRedis } from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import musicRoutes from './routes/music.js';
import playlistRoutes from './routes/playlists.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:12000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
    },
  },
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later.',
});

app.use('/api/auth', authLimiter);
app.use('/api/', limiter);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:12000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

io.use((socket, next) => {
  if (socket.handshake.auth && socket.handshake.auth.token) {
    const token = socket.handshake.auth.token.split(' ')[1];
    authenticateToken({ headers: { authorization: socket.handshake.auth.token } }, {}, (err) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = socket.request.user;
      next();
    });
  } else {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.user.username);

  socket.on('join-room', async (roomId) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }
    socket.join(roomId);
    await redisClient.set(`room:${roomId}:lastActive`, Date.now());
    console.log(`User ${socket.user.username} joined room ${roomId}`);
  });

  socket.on('sync-playback', async (data) => {
    if (!data.roomId || !data.currentTime || !data.isPlaying) {
      socket.emit('error', { message: 'Invalid playback data' });
      return;
    }
    await redisClient.set(`room:${data.roomId}:playback`, JSON.stringify(data));
    socket.to(data.roomId).emit('playback-sync', data);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
    for (const room of rooms) {
      await redisClient.del(`room:${room}:playback`);
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectMongoDB();
    await initializeRedis();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🎵 Listeners Backend Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
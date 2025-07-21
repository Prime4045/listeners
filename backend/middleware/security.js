import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';

// Enhanced rate limiting with different tiers
export const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, retryAfter: windowMs },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP + User-Agent for better fingerprinting
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      return crypto.createHash('sha256').update(ip + userAgent).digest('hex');
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    },
    onLimitReached: (req, res) => {
      console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
    }
  });
};

// Different rate limiters for different endpoints
export const strictLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests
  'Too many requests, please try again later'
);

export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  'Too many authentication attempts'
);

export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests
  'API rate limit exceeded'
);

export const searchLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // 30 searches per minute
  'Too many search requests'
);

// Enhanced security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', 'https:', 'https://*.amazonaws.com'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:', process.env.FRONTEND_URL],
      fontSrc: ["'self'", 'https:', 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
    },
  },
});

// Request sanitization middleware
export const sanitizeRequest = (req, res, next) => {
  // Remove potentially dangerous characters from query params
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].replace(/[<>\"']/g, '');
    }
  }
  
  // Limit request body size
  if (req.body && JSON.stringify(req.body).length > 1024 * 1024) { // 1MB limit
    return res.status(413).json({
      message: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

// IP whitelist for admin endpoints
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        message: 'Access denied from this IP address',
        code: 'IP_BLOCKED'
      });
    }
    
    next();
  };
};

// Request logging for security monitoring
export const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?._id || 'anonymous'
    };
    
    // Log suspicious activity
    if (res.statusCode >= 400 || duration > 5000) {
      console.warn('Security Alert:', logData);
    }
  });
  
  next();
};

// Prevent parameter pollution
export const preventParameterPollution = (req, res, next) => {
  for (const key in req.query) {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][0]; // Take only the first value
    }
  }
  next();
};

// CORS configuration with dynamic origin checking
export const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:12000',
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'X-API-Key'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
};
import compression from 'compression';
import { redisClient } from '../config/database.js';

// Enhanced compression middleware
export const compressionMiddleware = compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    
    // Compress JSON, text, and other compressible content
    return compression.filter(req, res);
  }
});

// Response caching middleware
export const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = `cache:${req.originalUrl}`;
    
    try {
      const cachedResponse = await redisClient.get(cacheKey);
      
      if (cachedResponse) {
        const { data, headers, statusCode } = JSON.parse(cachedResponse);
        
        // Set cached headers
        Object.keys(headers).forEach(key => {
          res.set(key, headers[key]);
        });
        
        res.set('X-Cache', 'HIT');
        return res.status(statusCode).json(data);
      }
    } catch (error) {
      console.warn('Cache read error:', error.message);
    }
    
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          data,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${duration}`,
            'X-Cache': 'MISS'
          },
          statusCode: res.statusCode
        };
        
        // Cache asynchronously
        redisClient.setEx(cacheKey, duration, JSON.stringify(cacheData))
          .catch(error => console.warn('Cache write error:', error.message));
      }
      
      res.set('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Request timing middleware
export const timingMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  const onFinish = () => {
    if (res.headersSent) {
      return;
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    try {
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    } catch (error) {
      // Headers already sent, ignore
    }
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
    }
  };
  
  res.once('finish', onFinish);
  res.once('close', onFinish);
  
  next();
};

// Memory usage monitoring
export const memoryMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  
  // Log memory usage if it's high
  if (memUsageMB.heapUsed > 500) { // 500MB threshold
    console.warn('High memory usage:', memUsageMB);
  }
  
  res.set('X-Memory-Usage', JSON.stringify(memUsageMB));
  next();
};

// Request ID middleware for tracing
export const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  
  next();
};

// Database connection pooling optimization
export const optimizeDbQueries = (req, res, next) => {
  // Add query optimization hints
  req.dbOptions = {
    lean: true, // Return plain objects instead of Mongoose documents
    maxTimeMS: 5000, // 5 second timeout for queries
    readPreference: 'secondaryPreferred' // Use secondary replicas when possible
  };
  
  next();
};

// Response optimization middleware
export const optimizeResponse = (req, res, next) => {
  // Disable response optimization to prevent circular reference issues
  console.log('Response optimization middleware - skipping for stability');
  next();
};

// Helper function to remove null/undefined values
function removeNullValues(obj) {
  if (obj === null || obj === undefined) {
    return undefined;
  }
  
  // Handle Mongoose objects and circular references
  if (obj && typeof obj === 'object') {
    // Check for circular references or Mongoose objects
    if (obj.constructor && (obj.constructor.name === 'ObjectId' || obj.constructor.name === 'model')) {
      return obj;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.filter(item => item !== null && item !== undefined);
    }
    
    // Handle plain objects only
    if (obj.constructor === Object) {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    }
  }
  
  return obj;
}

// Graceful shutdown handler
export const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      console.log('Server closed successfully');
      
      // Close database connections
      Promise.all([
        redisClient.quit().catch(console.error),
        // Add MongoDB close here if needed
      ]).then(() => {
        console.log('All connections closed');
        process.exit(0);
      }).catch((error) => {
        console.error('Error closing connections:', error);
        process.exit(1);
      });
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
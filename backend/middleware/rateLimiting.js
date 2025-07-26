import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/database.js';
import crypto from 'crypto';

class AdvancedRateLimiter {
    constructor() {
        this.store = new RedisStore();
    }

    /**
     * Create adaptive rate limiter based on user behavior
     */
    createAdaptiveLimit(baseConfig) {
        return rateLimit({
            ...baseConfig,
            store: this.store,
            keyGenerator: this.generateAdvancedKey,
            skip: this.skipTrustedRequests,
            handler: this.handleLimitReached,
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    /**
     * Generate advanced fingerprint for rate limiting
     */
    generateAdvancedKey(req) {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        const acceptLanguage = req.get('Accept-Language') || '';
        const acceptEncoding = req.get('Accept-Encoding') || '';
        
        // Create fingerprint
        const fingerprint = crypto
            .createHash('sha256')
            .update(ip + userAgent + acceptLanguage + acceptEncoding)
            .digest('hex')
            .substring(0, 16);

        // Include user ID if authenticated
        const userId = req.user?._id || 'anonymous';
        
        return `${fingerprint}:${userId}`;
    }

    /**
     * Skip rate limiting for trusted requests
     */
    skipTrustedRequests(req) {
        // Skip for health checks
        if (req.path === '/api/health') return true;
        
        // Skip for successful authentication (set by auth middleware)
        if (req.skipRateLimit === true) return true;
        
        // Skip for premium users on certain endpoints
        if (req.user?.subscription?.type === 'premium' && req.path.includes('/music/')) {
            return true;
        }
        
        return false;
    }

    /**
     * Handle rate limit exceeded
     */
    handleLimitReached(req, res, next, options) {
        const key = this.generateAdvancedKey(req);
        console.warn(`Rate limit exceeded for ${key} on ${req.path}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            userId: req.user?._id || 'anonymous'
        });

        // Log suspicious activity
        if (req.path.includes('/auth/') || req.path.includes('/admin/')) {
            console.error(`Suspicious activity detected: ${key}`, {
                ip: req.ip,
                path: req.path,
                attempts: options?.max || 'unknown'
            });
        }

        // Send rate limit response
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: options?.windowMs || 15 * 60 * 1000
        });
    }
}

/**
 * Redis store for rate limiting
 */
class RedisStore {
    constructor() {
        this.prefix = 'rl:';
        this.resetTime = 60 * 1000; // 1 minute default
    }

    async increment(key, windowMs) {
        try {
            const redisKey = `${this.prefix}${key}`;
            const current = await redisClient.incr(redisKey);
            
            if (current === 1) {
                await redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
            }
            
            const ttl = await redisClient.ttl(redisKey);
            const resetTime = new Date(Date.now() + (ttl * 1000));
            
            return {
                totalHits: current,
                resetTime
            };
        } catch (error) {
            console.error('Rate limit store error:', error);
            // Fallback to allow request if Redis fails
            return {
                totalHits: 0,
                resetTime: new Date(Date.now() + windowMs)
            };
        }
    }

    async decrement(key) {
        try {
            const redisKey = `${this.prefix}${key}`;
            const current = await redisClient.decr(redisKey);
            return Math.max(0, current);
        } catch (error) {
            console.error('Rate limit decrement error:', error);
            return 0;
        }
    }

    async resetKey(key) {
        try {
            const redisKey = `${this.prefix}${key}`;
            await redisClient.del(redisKey);
        } catch (error) {
            console.error('Rate limit reset error:', error);
        }
    }
}

const rateLimiter = new AdvancedRateLimiter();

// Different rate limiters for different endpoints
export const strictLimiter = rateLimiter.createAdaptiveLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60 * 1000
    }
});

export const authLimiter = rateLimiter.createAdaptiveLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
        // More lenient for OAuth callbacks
        if (req.path.includes('/callback')) return 20;
        // Stricter for login attempts
        if (req.path.includes('/login')) return 8;
        return 10;
    },
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 15 * 60 * 1000
    }
});

export const apiLimiter = rateLimiter.createAdaptiveLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
        // Higher limits for premium users
        if (req.user?.subscription?.type === 'premium') return 2000;
        // Standard limits for authenticated users
        if (req.user) return 1000;
        // Lower limits for anonymous users
        return 500;
    },
    message: {
        error: 'API rate limit exceeded. Upgrade to Premium for higher limits.',
        retryAfter: 15 * 60 * 1000
    }
});

export const searchLimiter = rateLimiter.createAdaptiveLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: (req) => {
        if (req.user?.subscription?.type === 'premium') return 100;
        if (req.user) return 50;
        return 20;
    },
    message: {
        error: 'Search rate limit exceeded. Please slow down.',
        retryAfter: 1 * 60 * 1000
    }
});

export const uploadLimiter = rateLimiter.createAdaptiveLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req) => {
        if (req.user?.subscription?.type === 'premium') return 100;
        return 10;
    },
    message: {
        error: 'Upload limit exceeded. Upgrade to Premium for more uploads.',
        retryAfter: 60 * 60 * 1000
    }
});

// Progressive rate limiting for failed attempts
export const progressiveLimiter = (attempts) => {
    return rateLimiter.createAdaptiveLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: Math.max(1, 10 - attempts * 2), // Decrease limit with more failures
        message: {
            error: 'Account temporarily restricted due to multiple failed attempts.',
            retryAfter: 60 * 60 * 1000
        }
    });
};

export default rateLimiter;
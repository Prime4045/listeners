import { redisClient } from '../config/database.js';
import s3Service from '../config/s3.js';

class AudioCacheService {
    constructor() {
        this.cachePrefix = 'audio:';
        this.preloadPrefix = 'preload:';
        this.metadataPrefix = 'metadata:';
        this.defaultTTL = 3600; // 1 hour
        this.preloadTTL = 1800; // 30 minutes
        this.metadataTTL = 86400; // 24 hours
    }

    /**
     * Preload audio files for faster playback
     */
    async preloadAudioFiles(spotifyIds, quality = 'high') {
        try {
            const preloadPromises = spotifyIds.slice(0, 5).map(async (spotifyId) => {
                const cacheKey = `${this.preloadPrefix}${spotifyId}:${quality}`;
                
                // Check if already preloaded
                const isPreloaded = await redisClient.get(cacheKey);
                if (isPreloaded) return { spotifyId, status: 'cached' };

                try {
                    // Check if file exists in S3
                    const exists = await s3Service.audioExists(spotifyId);
                    if (!exists) {
                        return { spotifyId, status: 'not_found' };
                    }

                    // Generate signed URL and cache it
                    const audioUrl = await s3Service.getAudioUrl(spotifyId);
                    const audioCacheKey = `${this.cachePrefix}${spotifyId}:${quality}`;
                    
                    await Promise.all([
                        redisClient.setEx(audioCacheKey, this.defaultTTL, audioUrl),
                        redisClient.setEx(cacheKey, this.preloadTTL, 'true')
                    ]);

                    return { spotifyId, status: 'preloaded', url: audioUrl };
                } catch (error) {
                    console.error(`Preload failed for ${spotifyId}:`, error.message);
                    return { spotifyId, status: 'error', error: error.message };
                }
            });

            const results = await Promise.all(preloadPromises);
            const successful = results.filter(r => r.status === 'preloaded').length;
            
            console.log(`Preloaded ${successful}/${spotifyIds.length} audio files`);
            return results;

        } catch (error) {
            console.error('Audio preload error:', error);
            return [];
        }
    }

    /**
     * Get cached audio URL or generate new one
     */
    async getCachedAudioUrl(spotifyId, quality = 'high') {
        try {
            const cacheKey = `${this.cachePrefix}${spotifyId}:${quality}`;
            
            // Try to get from cache first
            const cachedUrl = await redisClient.get(cacheKey);
            if (cachedUrl) {
                console.log(`Audio cache hit: ${spotifyId}`);
                return cachedUrl;
            }

            // Generate new URL and cache it
            const audioUrl = await s3Service.getAudioUrl(spotifyId);
            await redisClient.setEx(cacheKey, this.defaultTTL, audioUrl);
            
            console.log(`Audio URL generated and cached: ${spotifyId}`);
            return audioUrl;

        } catch (error) {
            console.error(`Failed to get audio URL for ${spotifyId}:`, error);
            throw error;
        }
    }

    /**
     * Cache audio metadata
     */
    async cacheAudioMetadata(spotifyId, metadata) {
        try {
            const cacheKey = `${this.metadataPrefix}${spotifyId}`;
            const dataWithTimestamp = {
                ...metadata,
                cachedAt: new Date().toISOString(),
            };
            
            await redisClient.setEx(cacheKey, this.metadataTTL, JSON.stringify(dataWithTimestamp));
            console.log(`Metadata cached: ${spotifyId}`);
            
        } catch (error) {
            console.error(`Failed to cache metadata for ${spotifyId}:`, error);
        }
    }

    /**
     * Get cached audio metadata
     */
    async getCachedMetadata(spotifyId) {
        try {
            const cacheKey = `${this.metadataPrefix}${spotifyId}`;
            const cached = await redisClient.get(cacheKey);
            
            if (cached) {
                console.log(`Metadata cache hit: ${spotifyId}`);
                return JSON.parse(cached);
            }
            
            return null;
        } catch (error) {
            console.error(`Failed to get cached metadata for ${spotifyId}:`, error);
            return null;
        }
    }

    /**
     * Batch preload for playlists
     */
    async batchPreloadPlaylist(spotifyIds, quality = 'high') {
        try {
            const batchSize = 3; // Preload 3 at a time to avoid overwhelming S3
            const results = [];

            for (let i = 0; i < spotifyIds.length; i += batchSize) {
                const batch = spotifyIds.slice(i, i + batchSize);
                const batchResults = await this.preloadAudioFiles(batch, quality);
                results.push(...batchResults);

                // Small delay between batches
                if (i + batchSize < spotifyIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            return results;
        } catch (error) {
            console.error('Batch preload error:', error);
            return [];
        }
    }

    /**
     * Invalidate audio cache
     */
    async invalidateAudioCache(spotifyId) {
        try {
            const patterns = [
                `${this.cachePrefix}${spotifyId}:*`,
                `${this.preloadPrefix}${spotifyId}:*`,
                `${this.metadataPrefix}${spotifyId}`
            ];

            const deletePromises = patterns.map(async (pattern) => {
                const keys = await redisClient.keys(pattern);
                if (keys.length > 0) {
                    return redisClient.del(keys);
                }
                return 0;
            });

            await Promise.all(deletePromises);
            console.log(`Audio cache invalidated: ${spotifyId}`);

        } catch (error) {
            console.error(`Failed to invalidate cache for ${spotifyId}:`, error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const [audioKeys, preloadKeys, metadataKeys] = await Promise.all([
                redisClient.keys(`${this.cachePrefix}*`),
                redisClient.keys(`${this.preloadPrefix}*`),
                redisClient.keys(`${this.metadataPrefix}*`)
            ]);

            return {
                audioUrls: audioKeys.length,
                preloadedFiles: preloadKeys.length,
                metadataEntries: metadataKeys.length,
                totalEntries: audioKeys.length + preloadKeys.length + metadataKeys.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Clean expired cache entries
     */
    async cleanExpiredEntries() {
        try {
            const patterns = [
                `${this.cachePrefix}*`,
                `${this.preloadPrefix}*`,
                `${this.metadataPrefix}*`
            ];

            let totalCleaned = 0;

            for (const pattern of patterns) {
                const keys = await redisClient.keys(pattern);
                const expiredKeys = [];

                for (const key of keys) {
                    const ttl = await redisClient.ttl(key);
                    if (ttl === -1) { // No expiration set
                        expiredKeys.push(key);
                    }
                }

                if (expiredKeys.length > 0) {
                    await redisClient.del(expiredKeys);
                    totalCleaned += expiredKeys.length;
                }
            }

            console.log(`Cleaned ${totalCleaned} expired cache entries`);
            return totalCleaned;

        } catch (error) {
            console.error('Cache cleanup error:', error);
            return 0;
        }
    }

    /**
     * Health check for audio cache service
     */
    async healthCheck() {
        try {
            const testKey = `${this.cachePrefix}health_test`;
            const testValue = { timestamp: Date.now() };

            await redisClient.setEx(testKey, 10, JSON.stringify(testValue));
            const retrieved = await redisClient.get(testKey);
            await redisClient.del(testKey);

            const isHealthy = retrieved && JSON.parse(retrieved).timestamp === testValue.timestamp;

            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'audio_cache',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'audio_cache',
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

export default new AudioCacheService();
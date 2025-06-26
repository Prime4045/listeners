import { redisClient } from '../config/database.js';

class CacheService {
    constructor() {
        this.defaultTTL = 60 * 60; // 1 hour
        this.prefixes = {
            song: 'song:',
            search: 'search:',
            spotify: 'spotify:',
            s3_check: 's3_check:',
            popular: 'popular:',
            trending: 'trending:',
            database_songs: 'db_songs:',
            user_data: 'user:',
        };
    }

    /**
     * Generate cache key with prefix
     */
    generateKey(prefix, key) {
        return `${this.prefixes[prefix] || prefix}${key}`;
    }

    /**
     * Set cache with TTL and error handling
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify(value);
            const result = await redisClient.setEx(key, ttl, serializedValue);
            console.log(`Cache set: ${key} (TTL: ${ttl}s)`);
            return result;
        } catch (error) {
            console.error('Cache set error:', {
                key,
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Get cached value with error handling
     */
    async get(key) {
        try {
            const value = await redisClient.get(key);
            if (value) {
                console.log(`Cache hit: ${key}`);
                return JSON.parse(value);
            }
            console.log(`Cache miss: ${key}`);
            return null;
        } catch (error) {
            console.error('Cache get error:', {
                key,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Delete cached value
     */
    async del(key) {
        try {
            const result = await redisClient.del(key);
            console.log(`Cache deleted: ${key}`);
            return result;
        } catch (error) {
            console.error('Cache delete error:', {
                key,
                error: error.message,
            });
            return 0;
        }
    }

    /**
     * Delete multiple keys by pattern
     */
    async delByPattern(pattern) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                const result = await redisClient.del(keys);
                console.log(`Cache pattern deleted: ${pattern} (${keys.length} keys)`);
                return result;
            }
            return 0;
        } catch (error) {
            console.error('Cache pattern delete error:', {
                pattern,
                error: error.message,
            });
            return 0;
        }
    }

    /**
     * Cache song data with metadata
     */
    async cacheSong(spotifyId, songData, ttl = 24 * 60 * 60) {
        const key = this.generateKey('song', spotifyId);
        const dataWithTimestamp = {
            ...songData,
            cachedAt: new Date().toISOString(),
        };
        return await this.set(key, dataWithTimestamp, ttl);
    }

    /**
     * Get cached song
     */
    async getCachedSong(spotifyId) {
        const key = this.generateKey('song', spotifyId);
        return await this.get(key);
    }

    /**
     * Cache Spotify search results
     */
    async cacheSpotifySearch(query, results, ttl = 15 * 60) {
        const key = this.generateKey('spotify', `search:${query.toLowerCase()}`);
        const dataWithTimestamp = {
            results,
            query,
            cachedAt: new Date().toISOString(),
            count: results.length,
        };
        return await this.set(key, dataWithTimestamp, ttl);
    }

    /**
     * Get cached Spotify search
     */
    async getCachedSpotifySearch(query) {
        const key = this.generateKey('spotify', `search:${query.toLowerCase()}`);
        const cached = await this.get(key);
        return cached?.results || null;
    }

    /**
     * Cache S3 file existence check
     */
    async cacheS3Check(spotifyId, exists, ttl = 60 * 60) {
        const key = this.generateKey('s3_check', spotifyId);
        const data = {
            exists,
            checkedAt: new Date().toISOString(),
            spotifyId,
        };
        return await this.set(key, data, ttl);
    }

    /**
     * Get cached S3 check
     */
    async getCachedS3Check(spotifyId) {
        const key = this.generateKey('s3_check', spotifyId);
        const cached = await this.get(key);
        return cached?.exists ?? null;
    }

    /**
     * Cache database search results
     */
    async cacheDatabaseSearch(query, results, ttl = 30 * 60) {
        const key = this.generateKey('search', `db:${query.toLowerCase()}`);
        const dataWithTimestamp = {
            results,
            query,
            cachedAt: new Date().toISOString(),
            count: results.length,
        };
        return await this.set(key, dataWithTimestamp, ttl);
    }

    /**
     * Get cached database search
     */
    async getCachedDatabaseSearch(query) {
        const key = this.generateKey('search', `db:${query.toLowerCase()}`);
        const cached = await this.get(key);
        return cached?.results || null;
    }

    /**
     * Cache popular songs
     */
    async cachePopularSongs(songs, cacheKey = null, ttl = 60 * 60) {
        const key = cacheKey || this.generateKey('popular', 'songs');
        const dataWithTimestamp = {
            songs,
            cachedAt: new Date().toISOString(),
            count: songs.length,
        };
        return await this.set(key, dataWithTimestamp, ttl);
    }

    /**
     * Get cached popular songs
     */
    async getCachedPopularSongs(cacheKey = null) {
        const key = cacheKey || this.generateKey('popular', 'songs');
        const cached = await this.get(key);
        return cached?.songs || null;
    }

    /**
     * Cache all database songs with pagination
     */
    async cacheDatabaseSongs(songs, cacheKey, ttl = 30 * 60) {
        const dataWithTimestamp = {
            ...songs,
            cachedAt: new Date().toISOString(),
        };
        return await this.set(cacheKey, dataWithTimestamp, ttl);
    }

    /**
     * Get cached database songs
     */
    async getCachedDatabaseSongs(cacheKey) {
        return await this.get(cacheKey);
    }

    /**
     * Cache user data
     */
    async cacheUserData(userId, userData, ttl = 30 * 60) {
        const key = this.generateKey('user_data', userId);
        const dataWithTimestamp = {
            ...userData,
            cachedAt: new Date().toISOString(),
        };
        return await this.set(key, dataWithTimestamp, ttl);
    }

    /**
     * Get cached user data
     */
    async getCachedUserData(userId) {
        const key = this.generateKey('user_data', userId);
        return await this.get(key);
    }

    /**
     * Invalidate song-related caches
     */
    async invalidateSongCaches(spotifyId) {
        const patterns = [
            this.generateKey('song', spotifyId),
            this.generateKey('s3_check', spotifyId),
        ];

        const deletePromises = patterns.map(pattern => this.del(pattern));
        const results = await Promise.all(deletePromises);
        console.log(`Invalidated song caches for: ${spotifyId}`);
        return results;
    }

    /**
     * Invalidate search caches
     */
    async invalidateSearchCaches() {
        try {
            const patterns = [
                this.generateKey('search', '*'),
                this.generateKey('database_songs', '*'),
                this.generateKey('popular', '*'),
                this.generateKey('trending', '*'),
            ];

            const deletePromises = patterns.map(pattern => this.delByPattern(pattern));
            const results = await Promise.all(deletePromises);
            console.log('Invalidated search caches');
            return results;
        } catch (error) {
            console.error('Error invalidating search caches:', error.message);
            return [];
        }
    }

    /**
     * Invalidate user-related caches
     */
    async invalidateUserCaches(userId) {
        const patterns = [
            this.generateKey('user_data', userId),
            this.generateKey('user_data', `${userId}:*`),
        ];

        const deletePromises = patterns.map(pattern => this.delByPattern(pattern));
        const results = await Promise.all(deletePromises);
        console.log(`Invalidated user caches for: ${userId}`);
        return results;
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            const info = await redisClient.info('memory');
            const keyspace = await redisClient.info('keyspace');
            const stats = await redisClient.info('stats');

            // Get key counts by prefix
            const keyCounts = {};
            for (const [name, prefix] of Object.entries(this.prefixes)) {
                try {
                    const keys = await redisClient.keys(`${prefix}*`);
                    keyCounts[name] = keys.length;
                } catch (err) {
                    keyCounts[name] = 0;
                }
            }

            return {
                memory: this.parseRedisInfo(info),
                keyspace: this.parseRedisInfo(keyspace),
                stats: this.parseRedisInfo(stats),
                keyCounts,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Cache stats error:', error.message);
            return {
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Parse Redis INFO command output
     */
    parseRedisInfo(infoString) {
        const result = {};
        const lines = infoString.split('\r\n');
        for (const line of lines) {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    result[key] = isNaN(value) ? value : Number(value);
                }
            }
        }
        return result;
    }

    /**
     * Clear all caches (use with caution)
     */
    async clearAll() {
        try {
            await redisClient.flushDb();
            console.log('All caches cleared');
            return true;
        } catch (error) {
            console.error('Error clearing all caches:', error.message);
            return false;
        }
    }

    /**
     * Health check for cache service
     */
    async healthCheck() {
        try {
            const testKey = 'health_check_test';
            const testValue = { timestamp: Date.now() };

            await this.set(testKey, testValue, 10);
            const retrieved = await this.get(testKey);
            await this.del(testKey);

            const isHealthy = retrieved && retrieved.timestamp === testValue.timestamp;

            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'redis_cache',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'redis_cache',
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

export default new CacheService();
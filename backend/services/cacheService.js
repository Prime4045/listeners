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
        };
    }

    /**
     * Generate cache key with prefix
     */
    generateKey(prefix, key) {
        return `${this.prefixes[prefix] || prefix}${key}`;
    }

    /**
     * Set cache with TTL
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify(value);
            return await redisClient.setEx(key, ttl, serializedValue);
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    /**
     * Get cached value
     */
    async get(key) {
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Delete cached value
     */
    async del(key) {
        try {
            return await redisClient.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
            return 0;
        }
    }

    /**
     * Cache song data
     */
    async cacheSong(spotifyId, songData, ttl = 24 * 60 * 60) {
        const key = this.generateKey('song', spotifyId);
        return await this.set(key, songData, ttl);
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
        return await this.set(key, results, ttl);
    }

    /**
     * Get cached Spotify search
     */
    async getCachedSpotifySearch(query) {
        const key = this.generateKey('spotify', `search:${query.toLowerCase()}`);
        return await this.get(key);
    }

    /**
     * Cache S3 file existence check
     */
    async cacheS3Check(spotifyId, exists, ttl = 60 * 60) {
        const key = this.generateKey('s3_check', spotifyId);
        return await this.set(key, { exists, timestamp: Date.now() }, ttl);
    }

    /**
     * Get cached S3 check
     */
    async getCachedS3Check(spotifyId) {
        const key = this.generateKey('s3_check', spotifyId);
        return await this.get(key);
    }

    /**
     * Cache database search results
     */
    async cacheDatabaseSearch(query, results, ttl = 30 * 60) {
        const key = this.generateKey('search', `db:${query.toLowerCase()}`);
        return await this.set(key, results, ttl);
    }

    /**
     * Get cached database search
     */
    async getCachedDatabaseSearch(query) {
        const key = this.generateKey('search', `db:${query.toLowerCase()}`);
        return await this.get(key);
    }

    /**
     * Cache popular songs
     */
    async cachePopularSongs(songs, ttl = 60 * 60) {
        const key = this.generateKey('popular', 'songs');
        return await this.set(key, songs, ttl);
    }

    /**
     * Get cached popular songs
     */
    async getCachedPopularSongs() {
        const key = this.generateKey('popular', 'songs');
        return await this.get(key);
    }

    /**
     * Cache all database songs
     */
    async cacheDatabaseSongs(songs, page = 1, ttl = 30 * 60) {
        const key = this.generateKey('database_songs', `page:${page}`);
        return await this.set(key, songs, ttl);
    }

    /**
     * Get cached database songs
     */
    async getCachedDatabaseSongs(page = 1) {
        const key = this.generateKey('database_songs', `page:${page}`);
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
        return await Promise.all(deletePromises);
    }

    /**
     * Invalidate search caches
     */
    async invalidateSearchCaches() {
        try {
            const searchKeys = await redisClient.keys(this.generateKey('search', '*'));
            const dbSongKeys = await redisClient.keys(this.generateKey('database_songs', '*'));
            const popularKeys = await redisClient.keys(this.generateKey('popular', '*'));

            const allKeys = [...searchKeys, ...dbSongKeys, ...popularKeys];
            if (allKeys.length > 0) {
                return await redisClient.del(allKeys);
            }
            return 0;
        } catch (error) {
            console.error('Error invalidating search caches:', error);
            return 0;
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            const info = await redisClient.info('memory');
            const keyspace = await redisClient.info('keyspace');

            return {
                memory: info,
                keyspace: keyspace,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return null;
        }
    }
}

export default new CacheService();
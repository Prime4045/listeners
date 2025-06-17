import { redisClient } from '../config/database.js';

class CacheService {
  constructor() {
    this.defaultTTL = 60 * 60; // 1 hour
    this.prefixes = {
      user: 'user:',
      song: 'song:',
      playlist: 'playlist:',
      trending: 'trending:',
      popular: 'popular:',
      search: 'search:',
      session: 'session:',
      recently_played: 'recently_played:',
    };
  }

  /**
   * Generate cache key with prefix
   * @param {string} prefix - Cache prefix
   * @param {string} key - Cache key
   * @returns {string} Full cache key
   */
  generateKey(prefix, key) {
    return `${this.prefixes[prefix] || prefix}${key}`;
  }

  /**
   * Set cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<string>} Redis response
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serializedValue = JSON.stringify(value);
      return await redisClient.setEx(key, ttl, serializedValue);
    } catch (error) {
      console.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
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
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of keys deleted
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
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key) {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration for existing key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True if expiration was set
   */
  async expire(key, ttl) {
    try {
      const result = await redisClient.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<Array>} Array of cached values
   */
  async mget(keys) {
    try {
      const values = await redisClient.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple key-value pairs
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<Array>} Array of set results
   */
  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      const promises = Object.entries(keyValuePairs).map(([key, value]) =>
        this.set(key, value, ttl)
      );
      return await Promise.all(promises);
    } catch (error) {
      console.error('Cache mset error:', error);
      throw error;
    }
  }

  /**
   * Delete keys by pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async delByPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;
      return await redisClient.del(keys);
    } catch (error) {
      console.error('Cache delete by pattern error:', error);
      return 0;
    }
  }

  /**
   * Cache user session data
   * @param {string} userId - User ID
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in seconds
   */
  async cacheUserSession(userId, sessionData, ttl = 24 * 60 * 60) {
    const key = this.generateKey('session', userId);
    return await this.set(key, sessionData, ttl);
  }

  /**
   * Get user session data
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Session data
   */
  async getUserSession(userId) {
    const key = this.generateKey('session', userId);
    return await this.get(key);
  }

  /**
   * Cache trending songs
   * @param {Array} songs - Array of trending songs
   * @param {number} ttl - Time to live in seconds
   */
  async cacheTrendingSongs(songs, ttl = 30 * 60) {
    const key = this.generateKey('trending', 'songs');
    return await this.set(key, songs, ttl);
  }

  /**
   * Get trending songs from cache
   * @returns {Promise<Array|null>} Trending songs
   */
  async getTrendingSongs() {
    const key = this.generateKey('trending', 'songs');
    return await this.get(key);
  }

  /**
   * Cache popular songs
   * @param {Array} songs - Array of popular songs
   * @param {number} ttl - Time to live in seconds
   */
  async cachePopularSongs(songs, ttl = 60 * 60) {
    const key = this.generateKey('popular', 'songs');
    return await this.set(key, songs, ttl);
  }

  /**
   * Get popular songs from cache
   * @returns {Promise<Array|null>} Popular songs
   */
  async getPopularSongs() {
    const key = this.generateKey('popular', 'songs');
    return await this.get(key);
  }

  /**
   * Cache search results
   * @param {string} query - Search query
   * @param {Array} results - Search results
   * @param {number} ttl - Time to live in seconds
   */
  async cacheSearchResults(query, results, ttl = 15 * 60) {
    const key = this.generateKey('search', query.toLowerCase().replace(/\s+/g, '_'));
    return await this.set(key, results, ttl);
  }

  /**
   * Get search results from cache
   * @param {string} query - Search query
   * @returns {Promise<Array|null>} Search results
   */
  async getSearchResults(query) {
    const key = this.generateKey('search', query.toLowerCase().replace(/\s+/g, '_'));
    return await this.get(key);
  }

  /**
   * Cache user's recently played songs
   * @param {string} userId - User ID
   * @param {Array} songs - Recently played songs
   * @param {number} ttl - Time to live in seconds
   */
  async cacheRecentlyPlayed(userId, songs, ttl = 24 * 60 * 60) {
    const key = this.generateKey('recently_played', userId);
    return await this.set(key, songs, ttl);
  }

  /**
   * Get user's recently played songs from cache
   * @param {string} userId - User ID
   * @returns {Promise<Array|null>} Recently played songs
   */
  async getRecentlyPlayed(userId) {
    const key = this.generateKey('recently_played', userId);
    return await this.get(key);
  }

  /**
   * Cache song metadata
   * @param {string} songId - Song ID
   * @param {Object} metadata - Song metadata
   * @param {number} ttl - Time to live in seconds
   */
  async cacheSongMetadata(songId, metadata, ttl = 24 * 60 * 60) {
    const key = this.generateKey('song', songId);
    return await this.set(key, metadata, ttl);
  }

  /**
   * Get song metadata from cache
   * @param {string} songId - Song ID
   * @returns {Promise<Object|null>} Song metadata
   */
  async getSongMetadata(songId) {
    const key = this.generateKey('song', songId);
    return await this.get(key);
  }

  /**
   * Invalidate user-related caches
   * @param {string} userId - User ID
   */
  async invalidateUserCaches(userId) {
    const patterns = [
      this.generateKey('session', userId),
      this.generateKey('recently_played', userId),
      this.generateKey('user', `${userId}:*`),
    ];

    const deletePromises = patterns.map(pattern => this.delByPattern(pattern));
    return await Promise.all(deletePromises);
  }

  /**
   * Invalidate song-related caches
   * @param {string} songId - Song ID
   */
  async invalidateSongCaches(songId) {
    const patterns = [
      this.generateKey('song', songId),
      this.generateKey('trending', '*'),
      this.generateKey('popular', '*'),
      this.generateKey('search', '*'),
    ];

    const deletePromises = patterns.map(pattern => this.delByPattern(pattern));
    return await Promise.all(deletePromises);
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
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

  /**
   * Clear all caches (use with caution)
   * @returns {Promise<string>} Redis response
   */
  async clearAll() {
    try {
      return await redisClient.flushAll();
    } catch (error) {
      console.error('Cache clear all error:', error);
      throw error;
    }
  }
}

export default new CacheService();
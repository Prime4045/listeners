import AWS from 'aws-sdk';
import { redisClient } from '../config/database.js';

class AudioOptimizationService {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1',
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'listeners101';
        this.cdnUrl = process.env.CDN_URL; // CloudFront URL if available
    }

    /**
     * Get optimized audio URL with CDN and caching
     */
    async getOptimizedAudioUrl(spotifyId, quality = 'high') {
        try {
            const cacheKey = `audio_url:${spotifyId}:${quality}`;
            
            // Check cache first
            const cachedUrl = await redisClient.get(cacheKey);
            if (cachedUrl) {
                console.log(`Cache hit for audio URL: ${spotifyId}`);
                return cachedUrl;
            }

            // Generate optimized S3 URL
            let audioKey = spotifyId;
            
            // Use different quality versions if available
            switch (quality) {
                case 'low':
                    audioKey = `${spotifyId}_128.mp3`;
                    break;
                case 'medium':
                    audioKey = `${spotifyId}_192.mp3`;
                    break;
                case 'high':
                default:
                    audioKey = `${spotifyId}.mp3`;
                    break;
            }

            // Check if file exists
            const exists = await this.checkFileExists(audioKey);
            if (!exists) {
                // Fallback to original file
                audioKey = `${spotifyId}.mp3`;
                const originalExists = await this.checkFileExists(audioKey);
                if (!originalExists) {
                    throw new Error(`Audio file not found: ${spotifyId}`);
                }
            }

            // Use CDN URL if available, otherwise S3 direct
            let audioUrl;
            if (this.cdnUrl) {
                audioUrl = `${this.cdnUrl}/${audioKey}`;
            } else {
                // Generate signed URL with optimized parameters
                const params = {
                    Bucket: this.bucketName,
                    Key: audioKey,
                    Expires: 3600, // 1 hour
                    ResponseContentType: 'audio/mpeg',
                    ResponseContentDisposition: 'inline',
                    ResponseCacheControl: 'public, max-age=3600',
                };
                audioUrl = await this.s3.getSignedUrlPromise('getObject', params);
            }

            // Cache the URL for 30 minutes
            await redisClient.setEx(cacheKey, 1800, audioUrl);
            
            console.log(`Generated optimized audio URL for: ${spotifyId} (${quality})`);
            return audioUrl;

        } catch (error) {
            console.error('Audio optimization error:', error);
            throw new Error(`Failed to get optimized audio URL: ${error.message}`);
        }
    }

    /**
     * Preload audio files for faster playback
     */
    async preloadAudio(spotifyIds) {
        try {
            const preloadPromises = spotifyIds.map(async (spotifyId) => {
                const cacheKey = `preload:${spotifyId}`;
                
                // Check if already preloaded
                const isPreloaded = await redisClient.get(cacheKey);
                if (isPreloaded) return;

                // Generate and cache URLs for all quality levels
                const qualities = ['low', 'medium', 'high'];
                const urlPromises = qualities.map(quality => 
                    this.getOptimizedAudioUrl(spotifyId, quality).catch(() => null)
                );

                await Promise.all(urlPromises);
                
                // Mark as preloaded for 1 hour
                await redisClient.setEx(cacheKey, 3600, 'true');
            });

            await Promise.all(preloadPromises);
            console.log(`Preloaded ${spotifyIds.length} audio files`);

        } catch (error) {
            console.error('Audio preload error:', error);
        }
    }

    /**
     * Get audio metadata with caching
     */
    async getAudioMetadata(spotifyId) {
        try {
            const cacheKey = `metadata:${spotifyId}`;
            
            // Check cache first
            const cachedMetadata = await redisClient.get(cacheKey);
            if (cachedMetadata) {
                return JSON.parse(cachedMetadata);
            }

            // Get metadata from S3
            const params = {
                Bucket: this.bucketName,
                Key: `${spotifyId}.mp3`,
            };

            const metadata = await this.s3.headObject(params).promise();
            
            const audioMetadata = {
                size: metadata.ContentLength,
                lastModified: metadata.LastModified,
                contentType: metadata.ContentType,
                etag: metadata.ETag,
                cacheControl: metadata.CacheControl,
                bitrate: this.estimateBitrate(metadata.ContentLength),
            };

            // Cache for 24 hours
            await redisClient.setEx(cacheKey, 86400, JSON.stringify(audioMetadata));
            
            return audioMetadata;

        } catch (error) {
            console.error('Metadata fetch error:', error);
            return null;
        }
    }

    /**
     * Check if file exists in S3
     */
    async checkFileExists(key) {
        try {
            await this.s3.headObject({
                Bucket: this.bucketName,
                Key: key,
            }).promise();
            return true;
        } catch (error) {
            if (error.code === 'NotFound') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Estimate bitrate from file size (rough calculation)
     */
    estimateBitrate(fileSize, duration = 180) {
        // Assume average 3-minute song
        const bitsPerSecond = (fileSize * 8) / duration;
        return Math.round(bitsPerSecond / 1000); // Convert to kbps
    }

    /**
     * Get streaming URL with range support
     */
    async getStreamingUrl(spotifyId, range = null) {
        try {
            const audioKey = `${spotifyId}.mp3`;
            
            const params = {
                Bucket: this.bucketName,
                Key: audioKey,
                Expires: 3600,
                ResponseContentType: 'audio/mpeg',
                ResponseCacheControl: 'public, max-age=3600',
            };

            // Add range support for progressive loading
            if (range) {
                params.Range = range;
            }

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            return url;

        } catch (error) {
            console.error('Streaming URL error:', error);
            throw new Error(`Failed to get streaming URL: ${error.message}`);
        }
    }

    /**
     * Batch process audio URLs for playlists
     */
    async batchGetAudioUrls(spotifyIds, quality = 'high') {
        try {
            const batchSize = 10; // Process in batches to avoid overwhelming S3
            const results = [];

            for (let i = 0; i < spotifyIds.length; i += batchSize) {
                const batch = spotifyIds.slice(i, i + batchSize);
                const batchPromises = batch.map(async (spotifyId) => {
                    try {
                        const url = await this.getOptimizedAudioUrl(spotifyId, quality);
                        return { spotifyId, url, success: true };
                    } catch (error) {
                        console.error(`Failed to get URL for ${spotifyId}:`, error.message);
                        return { spotifyId, url: null, success: false, error: error.message };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Small delay between batches
                if (i + batchSize < spotifyIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            return results;

        } catch (error) {
            console.error('Batch URL generation error:', error);
            throw error;
        }
    }

    /**
     * Clean up expired cache entries
     */
    async cleanupCache() {
        try {
            const patterns = ['audio_url:*', 'metadata:*', 'preload:*'];
            
            for (const pattern of patterns) {
                const keys = await redisClient.keys(pattern);
                if (keys.length > 0) {
                    // Check TTL and remove expired entries
                    const expiredKeys = [];
                    for (const key of keys) {
                        const ttl = await redisClient.ttl(key);
                        if (ttl === -1) { // No expiration set
                            expiredKeys.push(key);
                        }
                    }
                    
                    if (expiredKeys.length > 0) {
                        await redisClient.del(expiredKeys);
                        console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
                    }
                }
            }

        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }

    /**
     * Health check for audio service
     */
    async healthCheck() {
        try {
            // Test S3 connectivity
            await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            
            // Test cache connectivity
            await redisClient.ping();
            
            return {
                status: 'healthy',
                service: 'audio_optimization',
                bucket: this.bucketName,
                cdn: !!this.cdnUrl,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'audio_optimization',
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

export default new AudioOptimizationService();
import AWS from 'aws-sdk';

class S3Service {
    constructor() {
        // Only initialize S3 if credentials are provided
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            this.s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION || 'us-east-1',
                signatureVersion: 'v4',
            });
            this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'listeners101';
            this.urlExpiration = 3600; // 1 hour
            this.isConfigured = true;
            console.log('✅ S3 Service initialized with bucket:', this.bucketName);
        } else {
            this.isConfigured = false;
            console.warn('⚠️ S3 Service not configured: Missing AWS credentials');
        }
    }

    /**
     * Check if S3 is properly configured
     */
    isS3Configured() {
        return this.isConfigured;
    }

    /**
     * Check if audio file exists in S3
     */
    async audioExists(spotifyId) {
        if (!this.isConfigured) {
            console.log('⚠️ S3 not configured, returning false for:', spotifyId);
            return false;
        }

        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId, // Direct spotifyId as key
            };

            await this.s3.headObject(params).promise();
            console.log(`✅ Audio file exists for track: ${spotifyId}`);
            return true;
        } catch (error) {
            if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
                console.log(`❌ Audio file not found for track: ${spotifyId}`);
                return false;
            }
            console.log(`⚠️ S3 check failed for track: ${spotifyId} - ${error.message}`);
            return false;
        }
    }

    /**
     * Get signed URL for audio file with error handling
     */
    async getAudioUrl(spotifyId) {
        if (!this.isConfigured) {
            throw new Error('S3 service not configured');
        }

        try {
            const key = spotifyId; // Direct spotifyId as key
            // First check if file exists
            const exists = await this.audioExists(spotifyId);
            if (!exists) {
                throw new Error(`Audio file not found for track: ${spotifyId}`);
            }

            const params = {
                Bucket: this.bucketName,
                Key: key,
                Expires: this.urlExpiration,
                ResponseContentType: 'audio/mpeg',
                ResponseContentDisposition: 'inline',
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            console.log(`✅ Generated signed URL for track: ${spotifyId}`);
            return url;
        } catch (error) {
            console.log(`❌ S3 URL generation failed for track: ${spotifyId} - ${error.message}`);
            throw new Error(`Audio file not available for track: ${spotifyId}`);
        }
    }

    /**
     * Get audio file stream for direct streaming
     */
    async getAudioStream(spotifyId) {
        if (!this.isConfigured) {
            throw new Error('S3 service not configured');
        }

        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId,
            };

            const stream = this.s3.getObject(params).createReadStream();
            console.log(`✅ Created audio stream for track: ${spotifyId}`);
            return stream;
        } catch (error) {
            console.error('❌ Error getting S3 audio stream:', {
                spotifyId,
                error: error.message,
            });
            throw new Error(`Failed to stream audio for track: ${spotifyId}`);
        }
    }

    /**
     * List all audio files in bucket with pagination
     */
    async listAudioFiles(maxKeys = 1000, continuationToken = null) {
        if (!this.isConfigured) {
            throw new Error('S3 service not configured');
        }

        try {
            const params = {
                Bucket: this.bucketName,
                MaxKeys: maxKeys,
                ...(continuationToken && { ContinuationToken: continuationToken }),
            };

            const data = await this.s3.listObjectsV2(params).promise();
            const files = data.Contents?.map(item => ({
                spotifyId: item.Key, // Key is the spotifyId
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                etag: item.ETag,
            })) || [];

            console.log(`✅ Listed ${files.length} audio files from S3`);
            return {
                files,
                isTruncated: data.IsTruncated,
                nextContinuationToken: data.NextContinuationToken,
                totalCount: data.KeyCount,
            };
        } catch (error) {
            console.error('❌ Error listing S3 files:', error.message);
            throw new Error('Failed to list audio files');
        }
    }

    /**
     * Health check for S3 service
     */
    async healthCheck() {
        if (!this.isConfigured) {
            return {
                status: 'not_configured',
                service: 's3',
                message: 'AWS credentials not provided',
            };
        }

        try {
            await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            return {
                status: 'healthy',
                service: 's3',
                bucket: this.bucketName,
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 's3',
                bucket: this.bucketName,
                error: error.message,
            };
        }
    }
}

export default new S3Service();
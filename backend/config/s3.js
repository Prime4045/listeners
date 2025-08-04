import AWS from 'aws-sdk';

class S3Service {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1',
            signatureVersion: 'v4',
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'listeners101';
        this.urlExpiration = 3600; // 1 hour
    }

    /**
     * Check if audio file exists in S3
     */
    async audioExists(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId, // Direct spotifyId as key
            };

            await this.s3.headObject(params).promise();
            console.log(`Audio file exists for track: ${spotifyId}`);
            return true;
        } catch (error) {
            if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
                console.log(`Audio file not found for track: ${spotifyId}`);
                return false;
            }
            // Don't log as error for missing files, it's expected
            console.log(`S3 check failed for track: ${spotifyId} - ${error.message}`);
            return false;
        }
    }

    /**
     * Get signed URL for audio file with error handling
     */
    async getAudioUrl(spotifyId) {
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
            console.log(`Generated signed URL for track: ${spotifyId}`);
            return url;
        } catch (error) {
            console.log(`S3 URL generation failed for track: ${spotifyId} - ${error.message}`);
            throw new Error(`Audio file not available for track: ${spotifyId}`);
        }
    }

    /**
     * Get audio file stream for direct streaming
     */
    async getAudioStream(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId,
            };

            const stream = this.s3.getObject(params).createReadStream();
            console.log(`Created audio stream for track: ${spotifyId}`);
            return stream;
        } catch (error) {
            console.error('Error getting S3 audio stream:', {
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

            console.log(`Listed ${files.length} audio files from S3`);
            return {
                files,
                isTruncated: data.IsTruncated,
                nextContinuationToken: data.NextContinuationToken,
                totalCount: data.KeyCount,
            };
        } catch (error) {
            console.error('Error listing S3 files:', error.message);
            throw new Error('Failed to list audio files');
        }
    }

    /**
     * Get file metadata with detailed information
     */
    async getFileMetadata(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId,
            };

            const data = await this.s3.headObject(params).promise();
            const metadata = {
                size: data.ContentLength,
                lastModified: data.LastModified,
                contentType: data.ContentType,
                etag: data.ETag,
                cacheControl: data.CacheControl,
                contentEncoding: data.ContentEncoding,
                metadata: data.Metadata,
                storageClass: data.StorageClass,
            };

            console.log(`Retrieved metadata for track: ${spotifyId}`, metadata);
            return metadata;
        } catch (error) {
            console.error('Error getting S3 file metadata:', {
                spotifyId,
                error: error.message,
            });
            throw new Error(`Failed to get metadata for track: ${spotifyId}`);
        }
    }

    /**
     * Upload audio file to S3 (for future use)
     */
    async uploadAudioFile(spotifyId, audioBuffer, metadata = {}) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId,
                Body: audioBuffer,
                ContentType: 'audio/mpeg',
                CacheControl: 'max-age=31536000', // 1 year
                Metadata: {
                    spotifyId,
                    uploadedAt: new Date().toISOString(),
                    ...metadata,
                },
            };

            const result = await this.s3.upload(params).promise();
            console.log(`Uploaded audio file for track: ${spotifyId}`, {
                location: result.Location,
                etag: result.ETag,
            });
            return result;
        } catch (error) {
            console.error('Error uploading audio file:', {
                spotifyId,
                error: error.message,
            });
            throw new Error(`Failed to upload audio for track: ${spotifyId}`);
        }
    }

    /**
     * Delete audio file from S3
     */
    async deleteAudioFile(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: spotifyId,
            };

            await this.s3.deleteObject(params).promise();
            console.log(`Deleted audio file for track: ${spotifyId}`);
            return true;
        } catch (error) {
            console.error('Error deleting audio file:', {
                spotifyId,
                error: error.message,
            });
            throw new Error(`Failed to delete audio for track: ${spotifyId}`);
        }
    }

    /**
     * Generate presigned POST URL for direct uploads
     */
    async getPresignedPostUrl(spotifyId, expiresIn = 3600) {
        try {
            const params = {
                Bucket: this.bucketName,
                Fields: {
                    key: spotifyId,
                    'Content-Type': 'audio/mpeg',
                },
                Expires: expiresIn,
                Conditions: [
                    ['content-length-range', 0, 50 * 1024 * 1024], // Max 50MB
                    ['eq', '$Content-Type', 'audio/mpeg'],
                ],
            };

            const postData = await this.s3.createPresignedPost(params);
            console.log(`Generated presigned POST URL for track: ${spotifyId}`);
            return postData;
        } catch (error) {
            console.error('Error generating presigned POST URL:', {
                spotifyId,
                error: error.message,
            });
            throw new Error(`Failed to generate upload URL for track: ${spotifyId}`);
        }
    }

    /**
     * Health check for S3 service
     */
    async healthCheck() {
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

    /**
     * Get bucket statistics
     */
    async getBucketStats() {
        try {
            const listResult = await this.listAudioFiles(1000);
            const totalSize = listResult.files.reduce((sum, file) => sum + file.size, 0);
            return {
                totalFiles: listResult.files.length,
                totalSize,
                totalSizeFormatted: this.formatBytes(totalSize),
                bucket: this.bucketName,
                lastUpdated: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error getting bucket stats:', error.message);
            throw new Error('Failed to get bucket statistics');
        }
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

export default new S3Service();
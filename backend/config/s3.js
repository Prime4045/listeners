import AWS from 'aws-sdk';

class S3Service {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1',
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'listeners101';
    }

    /**
     * Check if audio file exists in S3
     * @param {string} spotifyId - Spotify track ID
     * @returns {Promise<boolean>} File exists
     */
    async audioExists(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${spotifyId}.mp3`,
            };

            await this.s3.headObject(params).promise();
            return true;
        } catch (error) {
            if (error.code === 'NotFound') {
                return false;
            }
            console.error('Error checking S3 file existence:', error);
            return false;
        }
    }

    /**
     * Get signed URL for audio file
     * @param {string} spotifyId - Spotify track ID
     * @returns {Promise<string>} Signed URL
     */
    async getAudioUrl(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${spotifyId}.mp3`,
                Expires: 3600, // 1 hour
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            return url;
        } catch (error) {
            console.error('Error generating S3 signed URL:', error);
            throw new Error(`Failed to get audio URL for track: ${spotifyId}`);
        }
    }

    /**
     * Get audio file stream
     * @param {string} spotifyId - Spotify track ID
     * @returns {Promise<ReadableStream>} Audio stream
     */
    async getAudioStream(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${spotifyId}.mp3`,
            };

            return this.s3.getObject(params).createReadStream();
        } catch (error) {
            console.error('Error getting S3 audio stream:', error);
            throw new Error(`Failed to stream audio for track: ${spotifyId}`);
        }
    }

    /**
     * List all audio files in bucket
     * @returns {Promise<Array>} List of file keys
     */
    async listAudioFiles() {
        try {
            const params = {
                Bucket: this.bucketName,
                Prefix: '',
                MaxKeys: 1000,
            };

            const data = await this.s3.listObjectsV2(params).promise();
            return data.Contents.map(item => item.Key.replace('.mp3', ''));
        } catch (error) {
            console.error('Error listing S3 files:', error);
            throw new Error('Failed to list audio files');
        }
    }

    /**
     * Get file metadata
     * @param {string} spotifyId - Spotify track ID
     * @returns {Promise<Object>} File metadata
     */
    async getFileMetadata(spotifyId) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${spotifyId}.mp3`,
            };

            const data = await this.s3.headObject(params).promise();
            return {
                size: data.ContentLength,
                lastModified: data.LastModified,
                contentType: data.ContentType,
            };
        } catch (error) {
            console.error('Error getting S3 file metadata:', error);
            throw new Error(`Failed to get metadata for track: ${spotifyId}`);
        }
    }
}

export default new S3Service();
<<<<<<< HEAD
import { v2 as cloudinary } from 'cloudinary';
import { redisClient } from '../config/database.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

class CloudinaryService {
  constructor() {
    this.cachePrefix = 'cloudinary:';
    this.cacheTTL = 24 * 60 * 60; // 24 hours
  }

  /**
   * Upload audio file to Cloudinary
   * @param {Buffer|string} file - File buffer or file path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadAudio(file, options = {}) {
    try {
      const uploadOptions = {
        resource_type: 'video', // Use 'video' for audio files
        folder: 'listeners/audio',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        format: 'mp3',
        audio_codec: 'mp3',
        ...options,
      };

      const result = await cloudinary.uploader.upload(file, uploadOptions);
      
      // Cache the result
      await this.cacheUploadResult(result.public_id, result);
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload audio: ${error.message}`);
    }
  }

  /**
   * Upload image to Cloudinary
   * @param {Buffer|string} file - File buffer or file path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(file, options = {}) {
    try {
      const uploadOptions = {
        resource_type: 'image',
        folder: 'listeners/images',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        transformation: [
          { width: 500, height: 500, crop: 'fill', quality: 'auto' },
        ],
        ...options,
      };

      const result = await cloudinary.uploader.upload(file, uploadOptions);
      
      // Cache the result
      await this.cacheUploadResult(result.public_id, result);
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at,
      };
    } catch (error) {
      console.error('Cloudinary image upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Get optimized audio URL
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Transformation options
   * @returns {string} Optimized URL
   */
  getOptimizedAudioUrl(publicId, options = {}) {
    const transformOptions = {
      resource_type: 'video',
      quality: 'auto',
      format: 'mp3',
      ...options,
    };

    return cloudinary.url(publicId, transformOptions);
  }

  /**
   * Get optimized image URL
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Transformation options
   * @returns {string} Optimized URL
   */
  getOptimizedImageUrl(publicId, options = {}) {
    const transformOptions = {
      resource_type: 'image',
      quality: 'auto',
      format: 'auto',
      width: 300,
      height: 300,
      crop: 'fill',
      ...options,
    };

    return cloudinary.url(publicId, transformOptions);
  }

  /**
   * Delete resource from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - Resource type (image, video, raw)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteResource(publicId, resourceType = 'image') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      // Remove from cache
      await this.removeCachedResult(publicId);

      return result;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete resource: ${error.message}`);
    }
  }

  /**
   * Get resource details
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - Resource type
   * @returns {Promise<Object>} Resource details
   */
  async getResourceDetails(publicId, resourceType = 'image') {
    try {
      // Check cache first
      const cached = await this.getCachedResult(publicId);
      if (cached) {
        return cached;
      }

      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      // Cache the result
      await this.cacheUploadResult(publicId, result);

      return result;
    } catch (error) {
      console.error('Cloudinary get resource error:', error);
      throw new Error(`Failed to get resource details: ${error.message}`);
    }
  }

  /**
   * Search resources
   * @param {string} expression - Search expression
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchResources(expression, options = {}) {
    try {
      const searchOptions = {
        resource_type: 'image',
        max_results: 50,
        ...options,
      };

      const result = await cloudinary.search
        .expression(expression)
        .with_field('context')
        .with_field('tags')
        .max_results(searchOptions.max_results)
        .execute();

      return result;
    } catch (error) {
      console.error('Cloudinary search error:', error);
      throw new Error(`Failed to search resources: ${error.message}`);
    }
  }

  /**
   * Generate audio waveform
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<string>} Waveform image URL
   */
  async generateWaveform(publicId) {
    try {
      const waveformUrl = cloudinary.url(publicId, {
        resource_type: 'video',
        flags: 'waveform',
        format: 'png',
        width: 800,
        height: 200,
        color: '8b5cf6',
        background: 'transparent',
      });

      return waveformUrl;
    } catch (error) {
      console.error('Waveform generation error:', error);
      throw new Error(`Failed to generate waveform: ${error.message}`);
    }
  }

  /**
   * Cache upload result in Redis
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} result - Upload result
   */
  async cacheUploadResult(publicId, result) {
    try {
      const cacheKey = `${this.cachePrefix}${publicId}`;
      await redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(result));
    } catch (error) {
      console.error('Cache error:', error);
      // Don't throw error for cache failures
    }
  }

  /**
   * Get cached upload result from Redis
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object|null>} Cached result
   */
  async getCachedResult(publicId) {
    try {
      const cacheKey = `${this.cachePrefix}${publicId}`;
      const cached = await redisClient.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Remove cached result from Redis
   * @param {string} publicId - Cloudinary public ID
   */
  async removeCachedResult(publicId) {
    try {
      const cacheKey = `${this.cachePrefix}${publicId}`;
      await redisClient.del(cacheKey);
    } catch (error) {
      console.error('Cache removal error:', error);
      // Don't throw error for cache failures
    }
  }

  /**
   * Batch upload multiple files
   * @param {Array} files - Array of files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Array>} Array of upload results
   */
  async batchUpload(files, options = {}) {
    try {
      const uploadPromises = files.map(file => {
        if (file.type?.startsWith('audio/')) {
          return this.uploadAudio(file.buffer || file.path, {
            ...options,
            public_id: file.name?.replace(/\.[^/.]+$/, ''),
          });
        } else if (file.type?.startsWith('image/')) {
          return this.uploadImage(file.buffer || file.path, {
            ...options,
            public_id: file.name?.replace(/\.[^/.]+$/, ''),
          });
        } else {
          throw new Error(`Unsupported file type: ${file.type}`);
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      
      return results.map((result, index) => ({
        file: files[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null,
      }));
    } catch (error) {
      console.error('Batch upload error:', error);
      throw new Error(`Batch upload failed: ${error.message}`);
    }
  }
=======
import cloudinary from '../config/cloudinary.js';

class CloudinaryService {
    async uploadAudio(file, options = {}) {
        try {
            const uploadOptions = {
                resource_type: 'video',
                folder: 'my_music_app/audio',
                use_filename: true,
                unique_filename: true,
                overwrite: false,
                format: 'mp3',
                audio_codec: 'mp3',
                ...options,
            };

            const result = await cloudinary.uploader.upload(file, uploadOptions);
            return result.secure_url;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new Error(`Failed to upload audio: ${error.message}`);
        }
    }
>>>>>>> 267ccd8 (Adding login and Registration form, Connecting cloudinary for songs)
}

export default new CloudinaryService();
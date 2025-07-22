import crypto from 'crypto';
import bcrypt from 'bcryptjs';

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.saltRounds = 12;
        
        // Use environment variable or generate a secure key
        this.encryptionKey = process.env.ENCRYPTION_KEY 
            ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
            : crypto.randomBytes(this.keyLength);
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
            cipher.setAAD(Buffer.from('listeners-app', 'utf8'));
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const tag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex')
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        try {
            const { encrypted, iv, tag } = encryptedData;
            const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
            
            decipher.setAAD(Buffer.from('listeners-app', 'utf8'));
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash passwords with salt
     */
    async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(this.saltRounds);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            console.error('Password hashing error:', error);
            throw new Error('Failed to hash password');
        }
    }

    /**
     * Verify password against hash
     */
    async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate HMAC signature
     */
    generateHMAC(data, secret = null) {
        const key = secret || this.encryptionKey;
        return crypto.createHmac('sha256', key).update(data).digest('hex');
    }

    /**
     * Verify HMAC signature
     */
    verifyHMAC(data, signature, secret = null) {
        const key = secret || this.encryptionKey;
        const expectedSignature = crypto.createHmac('sha256', key).update(data).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }

    /**
     * Encrypt API keys and sensitive configuration
     */
    encryptConfig(config) {
        const encrypted = {};
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'string' && value.length > 0) {
                encrypted[key] = this.encrypt(value);
            } else {
                encrypted[key] = value;
            }
        }
        return encrypted;
    }

    /**
     * Decrypt API keys and sensitive configuration
     */
    decryptConfig(encryptedConfig) {
        const decrypted = {};
        for (const [key, value] of Object.entries(encryptedConfig)) {
            if (value && typeof value === 'object' && value.encrypted) {
                decrypted[key] = this.decrypt(value);
            } else {
                decrypted[key] = value;
            }
        }
        return decrypted;
    }

    /**
     * Generate secure session ID
     */
    generateSessionId() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        return crypto.createHash('sha256').update(timestamp + randomBytes).digest('hex');
    }

    /**
     * Encrypt user PII (Personally Identifiable Information)
     */
    encryptPII(data) {
        const sensitiveFields = ['email', 'phoneNumber', 'firstName', 'lastName'];
        const encrypted = { ...data };
        
        for (const field of sensitiveFields) {
            if (encrypted[field]) {
                encrypted[field] = this.encrypt(encrypted[field]);
            }
        }
        
        return encrypted;
    }

    /**
     * Decrypt user PII
     */
    decryptPII(encryptedData) {
        const sensitiveFields = ['email', 'phoneNumber', 'firstName', 'lastName'];
        const decrypted = { ...encryptedData };
        
        for (const field of sensitiveFields) {
            if (decrypted[field] && typeof decrypted[field] === 'object') {
                try {
                    decrypted[field] = this.decrypt(decrypted[field]);
                } catch (error) {
                    console.error(`Failed to decrypt ${field}:`, error);
                    decrypted[field] = '[ENCRYPTED]';
                }
            }
        }
        
        return decrypted;
    }

    /**
     * Generate API key with metadata
     */
    generateAPIKey(userId, permissions = []) {
        const keyData = {
            userId,
            permissions,
            createdAt: Date.now(),
            version: 1
        };
        
        const keyString = JSON.stringify(keyData);
        const signature = this.generateHMAC(keyString);
        
        return {
            key: Buffer.from(keyString).toString('base64'),
            signature,
            fullKey: `lsn_${Buffer.from(keyString).toString('base64')}.${signature}`
        };
    }

    /**
     * Verify API key
     */
    verifyAPIKey(apiKey) {
        try {
            if (!apiKey.startsWith('lsn_')) {
                throw new Error('Invalid API key format');
            }
            
            const [keyPart, signature] = apiKey.substring(4).split('.');
            if (!keyPart || !signature) {
                throw new Error('Malformed API key');
            }
            
            const keyString = Buffer.from(keyPart, 'base64').toString('utf8');
            
            if (!this.verifyHMAC(keyString, signature)) {
                throw new Error('Invalid API key signature');
            }
            
            const keyData = JSON.parse(keyString);
            
            // Check if key is expired (optional)
            const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
            if (Date.now() - keyData.createdAt > maxAge) {
                throw new Error('API key expired');
            }
            
            return keyData;
        } catch (error) {
            console.error('API key verification error:', error);
            return null;
        }
    }
}

export default new EncryptionService();
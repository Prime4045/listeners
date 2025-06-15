import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    minlength: 8,
    validate: {
      validator: function(password) {
        if (!password && this.googleId) return true;
        // Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
      },
      message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character'
    }
  },
  firstName: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 30,
  },
  lastName: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 30,
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: /^\+[1-9]\d{1,14}$/,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
  },
  passwordResetToken: {
    type: String,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaSecret: {
    type: String,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    success: Boolean,
  }],
  preferences: {
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark',
    },
    autoplay: {
      type: Boolean,
      default: true,
    },
    quality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'high',
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    volumeSync: {
      type: Boolean,
      default: false,
    },
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    expiresAt: Date,
  },
  likedSongs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
  }],
  playlists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist',
  }],
  followedArtists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
  }],
  recentlyPlayed: {
    type: [{
      song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
        required: true,
      },
      playedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    validate: {
      validator: function (arr) {
        return arr.length <= 50;
      },
      message: 'Recently played tracks cannot exceed 50 entries.',
    },
  },
}, {
  timestamps: true,
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ lockUntil: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Validate authentication method
userSchema.pre('save', function (next) {
  if (!this.password && !this.googleId) {
    next(new Error('At least one authentication method (password or Google OAuth) is required'));
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Handle login attempts and account locking
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1,
      },
      $set: {
        loginAttempts: 1,
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1,
    }
  });
};

// Add login history entry
userSchema.methods.addLoginHistory = async function(ip, userAgent, success = true) {
  this.loginHistory.unshift({
    ip,
    userAgent,
    success,
    timestamp: new Date(),
  });
  
  // Keep only last 20 login attempts
  if (this.loginHistory.length > 20) {
    this.loginHistory = this.loginHistory.slice(0, 20);
  }
  
  return this.save();
};

// Exclude sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.googleId;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.mfaSecret;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

export default mongoose.model('User', userSchema);
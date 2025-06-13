import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    minlength: 6,
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
        return arr.length <= 5;
      },
      message: 'Recently played tracks cannot exceed 5 entries.',
    },
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
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

// Exclude sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.googleId;
  return userObject;
};

export default mongoose.model('User', userSchema);
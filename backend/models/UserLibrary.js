import mongoose from 'mongoose';

const userLibrarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  song: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: true,
    index: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound index to ensure unique user-song combinations
userLibrarySchema.index({ user: 1, song: 1 }, { unique: true });

// Index for efficient queries
userLibrarySchema.index({ user: 1, addedAt: -1 });
userLibrarySchema.index({ song: 1, addedAt: -1 });
userLibrarySchema.index({ isActive: 1 });

// Static method to add song to library
userLibrarySchema.statics.addToLibrary = async function (userId, songId) {
  try {
    const existingEntry = await this.findOne({ user: userId, song: songId });

    if (existingEntry) {
      if (existingEntry.isActive) {
        // Remove from library
        existingEntry.isActive = false;
        await existingEntry.save();
        return { added: false, message: 'Song removed from library' };
      } else {
        // Re-add to library
        existingEntry.isActive = true;
        existingEntry.addedAt = new Date();
        await existingEntry.save();
        return { added: true, message: 'Song added to library' };
      }
    } else {
      // Create new library entry
      const newEntry = new this({
        user: userId,
        song: songId,
      });
      await newEntry.save();
      return { added: true, message: 'Song added to library' };
    }
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      throw new Error('Song already in library');
    }
    throw error;
  }
};

// Static method to remove song from library
userLibrarySchema.statics.removeFromLibrary = async function (userId, songId) {
  try {
    const entry = await this.findOne({ user: userId, song: songId, isActive: true });
    
    if (entry) {
      entry.isActive = false;
      await entry.save();
      return { removed: true, message: 'Song removed from library' };
    } else {
      return { removed: false, message: 'Song not found in library' };
    }
  } catch (error) {
    throw error;
  }
};

// Static method to get user's library
userLibrarySchema.statics.getUserLibrary = function (userId, limit = 50, skip = 0) {
  return this.find({ user: userId, isActive: true })
    .populate('song')
    .sort({ addedAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to check if song is in user's library
userLibrarySchema.statics.isInLibrary = function (userId, songId) {
  return this.findOne({ user: userId, song: songId, isActive: true });
};

// Static method to get library count for user
userLibrarySchema.statics.getLibraryCount = function (userId) {
  return this.countDocuments({ user: userId, isActive: true });
};

export default mongoose.model('UserLibrary', userLibrarySchema);
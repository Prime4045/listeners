import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'song_added',
      'playlist_created',
      'playlist_shared',
      'new_feature',
      'system_update',
      'welcome',
      'achievement',
      'recommendation'
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  actionUrl: {
    type: String,
    default: null,
  },
  actionText: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes for performance
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, notificationData) {
  try {
    const notification = new this({
      user: userId,
      ...notificationData,
    });
    
    await notification.save();
    
    // Emit real-time notification if socket.io is available
    // This would be handled by the socket.io server
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function(userId, limit = 20, skip = 0) {
  return this.find({ 
    user: userId,
    isArchived: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds) {
  return this.updateMany(
    { 
      user: userId, 
      _id: { $in: notificationIds } 
    },
    { isRead: true }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ 
    user: userId, 
    isRead: false,
    isArchived: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to clean expired notifications
notificationSchema.statics.cleanExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

export default mongoose.model('Notification', notificationSchema);
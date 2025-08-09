import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const [notifications, unreadCount] = await Promise.all([
      Notification.getUserNotifications(req.user._id, parseInt(limit), parseInt(skip)),
      Notification.getUnreadCount(req.user._id)
    ]);

    res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      message: 'Failed to get notifications',
      error: error.message
    });
  }
});

// Mark notifications as read
router.put('/mark-read', authenticateToken, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({
        message: 'notificationIds must be an array'
      });
    }

    await Notification.markAsRead(req.user._id, notificationIds);
    
    res.json({
      message: 'Notifications marked as read'
    });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({
      message: 'Failed to mark notifications as read',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    
    res.json({
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Archive notification
router.put('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isArchived: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found'
      });
    }

    res.json({
      message: 'Notification archived',
      notification
    });
  } catch (error) {
    console.error('Archive notification error:', error);
    res.status(500).json({
      message: 'Failed to archive notification',
      error: error.message
    });
  }
});

// Create system notification (admin only)
router.post('/system', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin check
    const { userIds, type, title, message, data, priority, actionUrl, actionText } = req.body;
    
    const notifications = await Promise.all(
      userIds.map(userId => 
        Notification.createNotification(userId, {
          type,
          title,
          message,
          data,
          priority,
          actionUrl,
          actionText
        })
      )
    );

    res.json({
      message: 'System notifications created',
      count: notifications.length
    });
  } catch (error) {
    console.error('Create system notification error:', error);
    res.status(500).json({
      message: 'Failed to create system notification',
      error: error.message
    });
  }
});

export default router;
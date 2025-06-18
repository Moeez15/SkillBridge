const express = require('express');
const { body, validationResult } = require('express-validator');
const { getUserFromToken } = require('../middleware/auth');
const { getDb } = require('../utils/database');

const router = express.Router();

// Get conversation messages between two users
router.get('/:userId', getUserFromToken, (req, res) => {
  const db = getDb();
  const currentUserId = req.user.id;
  const otherUserId = req.params.userId;
  const { limit = 50, offset = 0 } = req.query;

  // Check if users are matched
  db.get(`
    SELECT * FROM matches 
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    AND status = 'active'
  `, [currentUserId, otherUserId, otherUserId, currentUserId], (err, match) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!match) {
      return res.status(403).json({ error: 'Users must be matched to exchange messages' });
    }

    // Get messages
    db.all(`
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.is_read,
        m.created_at,
        u.username as sender_username,
        u.full_name as sender_full_name,
        u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?) 
         OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [currentUserId, otherUserId, otherUserId, currentUserId, parseInt(limit), parseInt(offset)], (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Mark messages as read
      db.run(`
        UPDATE messages 
        SET is_read = 1 
        WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
      `, [otherUserId, currentUserId], (err) => {
        if (err) {
          console.error('Error marking messages as read:', err);
        }
      });

      res.json({ messages: messages.reverse() }); // Reverse to get chronological order
    });
  });
});

// Send a message
router.post('/', [
  getUserFromToken,
  body('recipientId').isInt().withMessage('Valid recipient ID required'),
  body('content').isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const { recipientId, content } = req.body;
  const senderId = req.user.id;

  if (parseInt(recipientId) === senderId) {
    return res.status(400).json({ error: 'Cannot send message to yourself' });
  }

  // Check if users are matched
  db.get(`
    SELECT * FROM matches 
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    AND status = 'active'
  `, [senderId, recipientId, recipientId, senderId], (err, match) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!match) {
      return res.status(403).json({ error: 'Users must be matched to exchange messages' });
    }

    // Insert message
    db.run(`
      INSERT INTO messages (sender_id, recipient_id, content)
      VALUES (?, ?, ?)
    `, [senderId, recipientId, content], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }

      // Get the created message with sender info
      db.get(`
        SELECT 
          m.id,
          m.sender_id,
          m.recipient_id,
          m.content,
          m.is_read,
          m.created_at,
          u.username as sender_username,
          u.full_name as sender_full_name,
          u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `, [this.lastID], (err, message) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve message' });
        }

        res.status(201).json({ message });
      });
    });
  });
});

// Get unread message count
router.get('/unread/count', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.get(`
    SELECT COUNT(*) as unread_count
    FROM messages 
    WHERE recipient_id = ? AND is_read = 0
  `, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ unreadCount: result.unread_count });
  });
});

// Get conversations list (users with recent messages)
router.get('/conversations/list', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.all(`
    WITH recent_messages AS (
      SELECT 
        CASE 
          WHEN sender_id = ? THEN recipient_id 
          ELSE sender_id 
        END as other_user_id,
        MAX(created_at) as last_message_time,
        COUNT(*) as message_count,
        SUM(CASE WHEN recipient_id = ? AND is_read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM messages
      WHERE sender_id = ? OR recipient_id = ?
      GROUP BY other_user_id
    )
    SELECT 
      rm.other_user_id,
      rm.last_message_time,
      rm.message_count,
      rm.unread_count,
      u.username,
      u.full_name,
      u.avatar_url,
      u.location,
      m.content as last_message_content,
      m.sender_id as last_message_sender_id
    FROM recent_messages rm
    JOIN users u ON rm.other_user_id = u.id
    JOIN messages m ON (
      m.id = (
        SELECT id FROM messages 
        WHERE (sender_id = ? AND recipient_id = rm.other_user_id) 
           OR (sender_id = rm.other_user_id AND recipient_id = ?)
        ORDER BY created_at DESC 
        LIMIT 1
      )
    )
    ORDER BY rm.last_message_time DESC
  `, [userId, userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ conversations });
  });
});

// Mark messages as read
router.put('/:userId/read', getUserFromToken, (req, res) => {
  const db = getDb();
  const currentUserId = req.user.id;
  const otherUserId = req.params.userId;

  db.run(`
    UPDATE messages 
    SET is_read = 1 
    WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
  `, [otherUserId, currentUserId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to mark messages as read' });
    }

    res.json({ 
      message: 'Messages marked as read',
      updatedCount: this.changes 
    });
  });
});

// Delete a message (only sender can delete)
router.delete('/:messageId', getUserFromToken, (req, res) => {
  const db = getDb();
  const { messageId } = req.params;
  const userId = req.user.id;

  db.run(`
    DELETE FROM messages 
    WHERE id = ? AND sender_id = ?
  `, [messageId, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized to delete' });
    }

    res.json({ message: 'Message deleted successfully' });
  });
});

module.exports = router; 
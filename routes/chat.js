const express = require('express');
const { body, validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/chat/tournament/:tournamentId
// @desc    Get tournament chat messages
// @access  Public
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const tournament = await Tournament.findById(req.params.tournamentId)
      .select('chat name')
      .populate('chat.userId', 'username profile.displayName profile.avatar');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Get paginated chat messages (most recent first)
    const totalMessages = tournament.chat.length;
    const startIndex = Math.max(0, totalMessages - (page * limit));
    const endIndex = totalMessages - ((page - 1) * limit);
    
    const messages = tournament.chat
      .slice(startIndex, endIndex)
      .reverse(); // Show newest first

    res.json({
      success: true,
      messages,
      tournament: {
        id: tournament._id,
        name: tournament.name
      },
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalMessages / limit),
        hasMore: startIndex > 0
      }
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chat/tournament/:tournamentId
// @desc    Send message to tournament chat
// @access  Private
router.post('/tournament/:tournamentId', auth, [
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const tournament = await Tournament.findById(req.params.tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is registered for tournament or is organizer
    const isRegistered = tournament.participants.teams.some(
      team => team.players.some(player => player.userId.toString() === user._id.toString())
    );
    const isOrganizer = tournament.organizer.userId.toString() === user._id.toString();

    if (!isRegistered && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'You must be registered for this tournament to chat'
      });
    }

    const chatMessage = {
      userId: user._id,
      username: user.username,
      message: req.body.message,
      timestamp: new Date(),
      isSystemMessage: false
    };

    tournament.chat.push(chatMessage);
    await tournament.save();

    // Populate user data for response
    const populatedMessage = {
      ...chatMessage,
      userId: {
        _id: user._id,
        username: user.username,
        profile: {
          displayName: user.profile.displayName,
          avatar: user.profile.avatar
        }
      }
    };

    res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chat/tournament/:tournamentId/system
// @desc    Send system message to tournament chat
// @access  Private (Organizer only)
router.post('/tournament/:tournamentId/system', auth, [
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const tournament = await Tournament.findById(req.params.tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is organizer
    if (tournament.organizer.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizer can send system messages'
      });
    }

    const systemMessage = {
      userId: null,
      username: 'System',
      message: req.body.message,
      timestamp: new Date(),
      isSystemMessage: true
    };

    tournament.chat.push(systemMessage);
    await tournament.save();

    res.status(201).json({
      success: true,
      message: systemMessage
    });
  } catch (error) {
    console.error('Send system message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/chat/tournament/:tournamentId/message/:messageId
// @desc    Delete chat message
// @access  Private (Message author or organizer)
router.delete('/tournament/:tournamentId/message/:messageId', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const messageIndex = tournament.chat.findIndex(
      msg => msg._id.toString() === req.params.messageId
    );

    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = tournament.chat[messageIndex];
    const isAuthor = message.userId && message.userId.toString() === req.user.userId;
    const isOrganizer = tournament.organizer.userId.toString() === req.user.userId;

    if (!isAuthor && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    tournament.chat.splice(messageIndex, 1);
    await tournament.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chat/tournament/:tournamentId/online
// @desc    Get online users in tournament chat
// @access  Public
router.get('/tournament/:tournamentId/online', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId)
      .populate('participants.teams.players.userId', 'username profile.displayName profile.avatar lastLogin');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Get users who were online in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = [];

    tournament.participants.teams.forEach(team => {
      team.players.forEach(player => {
        if (player.userId && player.userId.lastLogin && player.userId.lastLogin > fiveMinutesAgo) {
          onlineUsers.push({
            id: player.userId._id,
            username: player.userId.username,
            displayName: player.userId.profile?.displayName || player.userId.username,
            avatar: player.userId.profile?.avatar
          });
        }
      });
    });

    // Remove duplicates
    const uniqueOnlineUsers = onlineUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id.toString() === user.id.toString())
    );

    res.json({
      success: true,
      onlineUsers: uniqueOnlineUsers,
      count: uniqueOnlineUsers.length
    });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

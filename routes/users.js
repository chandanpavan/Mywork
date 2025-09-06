const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('profile.displayName').optional().isLength({ min: 1, max: 50 }),
  body('profile.bio').optional().isLength({ max: 500 }),
  body('profile.country').optional().isLength({ max: 50 }),
  body('profile.website').optional().isURL(),
  body('profile.phoneNumber').optional().isMobilePhone()
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

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update profile fields
    if (req.body.profile) {
      Object.keys(req.body.profile).forEach(key => {
        if (req.body.profile[key] !== undefined) {
          user.profile[key] = req.body.profile[key];
        }
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('stats gameStats achievements');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      stats: user.stats,
      gameStats: user.gameStats,
      achievements: user.achievements
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/stats
// @desc    Update user statistics
// @access  Private
router.put('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { game, result, kills, deaths, score } = req.body;

    // Update overall stats
    if (result === 'win') {
      user.stats.totalWins += 1;
    } else if (result === 'loss') {
      user.stats.totalLosses += 1;
    }

    user.stats.totalKills += kills || 0;
    user.stats.totalDeaths += deaths || 0;
    user.stats.totalScore += score || 0;
    user.stats.gamesPlayed += 1;
    user.updateWinRate();

    // Update game-specific stats
    let gameStats = user.gameStats.find(stat => stat.game === game);
    if (!gameStats) {
      gameStats = {
        game,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        score: 0,
        lastPlayed: new Date()
      };
      user.gameStats.push(gameStats);
    } else {
      gameStats.lastPlayed = new Date();
    }

    if (result === 'win') {
      gameStats.wins += 1;
    } else if (result === 'loss') {
      gameStats.losses += 1;
    }

    gameStats.kills += kills || 0;
    gameStats.deaths += deaths || 0;
    gameStats.score += score || 0;

    await user.save();

    res.json({
      success: true,
      message: 'Stats updated successfully',
      stats: user.stats,
      gameStats: user.gameStats
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/settings
// @desc    Update user settings
// @access  Private
router.put('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update settings
    if (req.body.settings) {
      Object.keys(req.body.settings).forEach(key => {
        if (req.body.settings[key] !== undefined) {
          user.settings[key] = req.body.settings[key];
        }
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/achievements
// @desc    Get user achievements
// @access  Private
router.get('/achievements', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('achievements');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      achievements: user.achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/achievements
// @desc    Add achievement to user
// @access  Private
router.post('/achievements', auth, [
  body('id').notEmpty().withMessage('Achievement ID is required'),
  body('name').notEmpty().withMessage('Achievement name is required'),
  body('description').notEmpty().withMessage('Achievement description is required'),
  body('category').notEmpty().withMessage('Achievement category is required')
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

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const achievement = {
      id: req.body.id,
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon || '🏆',
      category: req.body.category,
      unlockedAt: new Date()
    };

    user.addAchievement(achievement);
    await user.save();

    res.json({
      success: true,
      message: 'Achievement unlocked!',
      achievement
    });
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { 'profile.displayName': { $regex: q, $options: 'i' } }
      ],
      isActive: true
    })
    .select('username profile.displayName profile.avatar stats.globalRank stats.totalScore')
    .limit(parseInt(limit))
    .sort({ 'stats.totalScore': -1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/:userId
// @desc    Get public user profile
// @access  Public
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email -settings -resetPasswordToken -resetPasswordExpire -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (user.settings.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

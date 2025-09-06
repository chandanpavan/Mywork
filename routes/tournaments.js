const express = require('express');
const { body, validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/tournaments
// @desc    Get all tournaments with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      game,
      status,
      format,
      region,
      page = 1,
      limit = 10,
      search
    } = req.query;

    const filter = {};
    
    if (game) filter.game = game;
    if (status) filter.status = status;
    if (format) filter.format = format;
    if (region && region !== 'global') filter['settings.region'] = region;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tournaments = await Tournament.find(filter)
      .populate('organizer.userId', 'username profile.displayName')
      .sort({ 'dates.tournamentStart': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Tournament.countDocuments(filter);

    res.json({
      success: true,
      tournaments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/tournaments/:id
// @desc    Get tournament by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizer.userId', 'username profile.displayName')
      .populate('participants.teams.players.userId', 'username profile.displayName profile.avatar');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Update tournament status based on dates
    tournament.updateStatus();
    await tournament.save();

    res.json({
      success: true,
      tournament
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/tournaments
// @desc    Create new tournament
// @access  Private
router.post('/', auth, [
  body('name').notEmpty().withMessage('Tournament name is required'),
  body('game').isIn(['valorant', 'cs2', 'fortnite', 'bgmi', 'rocket-league', 'apex-legends', 'free-fire', 'cod']),
  body('format').isIn(['solo', 'duo', 'squad', 'team']),
  body('prizePool.amount').isNumeric().withMessage('Prize pool amount must be a number'),
  body('participants.maxTeams').isInt({ min: 2 }).withMessage('Max teams must be at least 2'),
  body('dates.registrationStart').isISO8601().withMessage('Registration start date is required'),
  body('dates.registrationEnd').isISO8601().withMessage('Registration end date is required'),
  body('dates.tournamentStart').isISO8601().withMessage('Tournament start date is required')
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

    const tournamentData = {
      ...req.body,
      organizer: {
        userId: user._id,
        username: user.username,
        contact: user.email
      }
    };

    const tournament = new Tournament(tournamentData);
    tournament.updateStatus();
    await tournament.save();

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      tournament
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/tournaments/:id/register
// @desc    Register for tournament
// @access  Private
router.post('/:id/register', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
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

    // Check if already registered
    const alreadyRegistered = tournament.participants.teams.some(
      team => team.players.some(player => player.userId.toString() === user._id.toString())
    );

    if (alreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this tournament'
      });
    }

    // Create team data
    const teamData = {
      teamId: user._id, // For solo tournaments, use user ID as team ID
      players: [{
        userId: user._id,
        username: user.username,
        role: 'player'
      }],
      registeredAt: new Date(),
      status: 'registered'
    };

    // Register team
    tournament.registerTeam(teamData);
    await tournament.save();

    // Update user's tournament list
    user.tournaments.push({
      tournamentId: tournament._id,
      registeredAt: new Date(),
      status: 'registered'
    });
    await user.save();

    res.json({
      success: true,
      message: 'Successfully registered for tournament',
      tournament: {
        id: tournament._id,
        name: tournament.name,
        currentTeams: tournament.participants.currentTeams,
        maxTeams: tournament.participants.maxTeams
      }
    });
  } catch (error) {
    console.error('Tournament registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// @route   DELETE /api/tournaments/:id/unregister
// @desc    Unregister from tournament
// @access  Private
router.delete('/:id/unregister', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
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

    // Check if tournament has started
    if (tournament.status === 'live' || tournament.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot unregister from active or completed tournament'
      });
    }

    // Remove from tournament
    const teamIndex = tournament.participants.teams.findIndex(
      team => team.players.some(player => player.userId.toString() === user._id.toString())
    );

    if (teamIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Not registered for this tournament'
      });
    }

    tournament.participants.teams.splice(teamIndex, 1);
    tournament.participants.currentTeams -= 1;
    await tournament.save();

    // Remove from user's tournament list
    user.tournaments = user.tournaments.filter(
      t => t.tournamentId.toString() !== tournament._id.toString()
    );
    await user.save();

    res.json({
      success: true,
      message: 'Successfully unregistered from tournament'
    });
  } catch (error) {
    console.error('Tournament unregistration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/tournaments/:id/brackets
// @desc    Get tournament brackets
// @access  Public
router.get('/:id/brackets', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('brackets.matches.team1', 'username profile.displayName')
      .populate('brackets.matches.team2', 'username profile.displayName')
      .populate('brackets.matches.winner', 'username profile.displayName');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      brackets: tournament.brackets
    });
  } catch (error) {
    console.error('Get brackets error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/tournaments/:id/generate-brackets
// @desc    Generate tournament brackets
// @access  Private (Organizer only)
router.post('/:id/generate-brackets', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
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
        message: 'Only tournament organizer can generate brackets'
      });
    }

    // Generate brackets
    tournament.generateBrackets();
    await tournament.save();

    res.json({
      success: true,
      message: 'Brackets generated successfully',
      brackets: tournament.brackets
    });
  } catch (error) {
    console.error('Generate brackets error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/tournaments/:id/match/:matchId
// @desc    Update match result
// @access  Private (Organizer only)
router.put('/:id/match/:matchId', auth, [
  body('winner').notEmpty().withMessage('Winner is required'),
  body('score.team1Score').isNumeric().withMessage('Team 1 score must be a number'),
  body('score.team2Score').isNumeric().withMessage('Team 2 score must be a number')
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

    const tournament = await Tournament.findById(req.params.id);
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
        message: 'Only tournament organizer can update match results'
      });
    }

    // Find and update match
    let matchFound = false;
    for (let bracket of tournament.brackets) {
      const match = bracket.matches.find(m => m.matchId === req.params.matchId);
      if (match) {
        match.winner = req.body.winner;
        match.score = req.body.score;
        match.status = 'completed';
        match.completedAt = new Date();
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    await tournament.save();

    res.json({
      success: true,
      message: 'Match result updated successfully'
    });
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/tournaments/user/:userId
// @desc    Get user's tournaments
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('tournaments.tournamentId', 'name game status dates prizePool');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      tournaments: user.tournaments
    });
  } catch (error) {
    console.error('Get user tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

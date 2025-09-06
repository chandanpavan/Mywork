const express = require('express');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const router = express.Router();

// @route   GET /api/leaderboard/global
// @desc    Get global leaderboard
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const {
      game,
      region,
      timeframe = 'all-time',
      limit = 50,
      page = 1
    } = req.query;

    let matchFilter = { isActive: true };
    let sortField = 'stats.totalScore';

    // Apply game filter
    if (game && game !== 'overall') {
      matchFilter[`gameStats.game`] = game;
      sortField = 'gameStats.$.score';
    }

    // Apply region filter
    if (region) {
      matchFilter['profile.country'] = region;
    }

    // Build aggregation pipeline
    let pipeline = [
      { $match: matchFilter }
    ];

    // If filtering by specific game, unwind gameStats
    if (game && game !== 'overall') {
      pipeline.push(
        { $unwind: '$gameStats' },
        { $match: { 'gameStats.game': game } },
        { $sort: { 'gameStats.score': -1 } }
      );
    } else {
      pipeline.push({ $sort: { 'stats.totalScore': -1 } });
    }

    // Add pagination
    pipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    // Project required fields
    pipeline.push({
      $project: {
        username: 1,
        'profile.displayName': 1,
        'profile.avatar': 1,
        'profile.country': 1,
        stats: 1,
        gameStats: game && game !== 'overall' ? '$gameStats' : '$gameStats',
        rank: { $add: [{ $multiply: [(page - 1), limit] }, '$$ROOT._id'] }
      }
    });

    const leaderboard = await User.aggregate(pipeline);

    // Add rank numbers
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: (page - 1) * limit + index + 1
    }));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(matchFilter);

    // Get statistics
    const stats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          activeThisWeek: {
            $sum: {
              $cond: [
                { $gte: ['$lastLogin', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          },
          averageScore: { $avg: '$stats.totalScore' }
        }
      }
    ]);

    res.json({
      success: true,
      leaderboard: rankedLeaderboard,
      statistics: stats[0] || { totalPlayers: 0, activeThisWeek: 0, averageScore: 0 },
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalUsers / limit),
        hasNext: page * limit < totalUsers,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get global leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/leaderboard/game/:game
// @desc    Get game-specific leaderboard
// @access  Public
router.get('/game/:game', async (req, res) => {
  try {
    const { game } = req.params;
    const { region, limit = 50, page = 1 } = req.query;

    let matchFilter = {
      isActive: true,
      'gameStats.game': game
    };

    if (region) {
      matchFilter['profile.country'] = region;
    }

    const pipeline = [
      { $match: matchFilter },
      { $unwind: '$gameStats' },
      { $match: { 'gameStats.game': game } },
      { $sort: { 'gameStats.score': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $project: {
          username: 1,
          'profile.displayName': 1,
          'profile.avatar': 1,
          'profile.country': 1,
          gameStats: 1,
          'stats.totalScore': 1
        }
      }
    ];

    const leaderboard = await User.aggregate(pipeline);

    // Add rank numbers
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: (page - 1) * limit + index + 1,
      winRate: user.gameStats.wins + user.gameStats.losses > 0 
        ? ((user.gameStats.wins / (user.gameStats.wins + user.gameStats.losses)) * 100).toFixed(1)
        : 0
    }));

    // Get total count
    const totalUsers = await User.countDocuments(matchFilter);

    res.json({
      success: true,
      leaderboard: rankedLeaderboard,
      game,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalUsers / limit),
        hasNext: page * limit < totalUsers,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get game leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/leaderboard/tournament/:tournamentId
// @desc    Get tournament leaderboard
// @access  Public
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId)
      .populate('participants.teams.players.userId', 'username profile.displayName profile.avatar');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Sort teams by score and placement
    const sortedTeams = tournament.participants.teams
      .filter(team => team.status !== 'eliminated')
      .sort((a, b) => {
        if (a.placement && b.placement) {
          return a.placement - b.placement;
        }
        return (b.score || 0) - (a.score || 0);
      })
      .map((team, index) => ({
        ...team.toObject(),
        rank: team.placement || index + 1
      }));

    res.json({
      success: true,
      tournament: {
        id: tournament._id,
        name: tournament.name,
        game: tournament.game,
        status: tournament.status
      },
      leaderboard: sortedTeams
    });
  } catch (error) {
    console.error('Get tournament leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/leaderboard/top3/:game?
// @desc    Get top 3 players for podium display
// @access  Public
router.get('/top3/:game?', async (req, res) => {
  try {
    const { game } = req.params;
    
    let pipeline = [
      { $match: { isActive: true } }
    ];

    if (game && game !== 'overall') {
      pipeline.push(
        { $unwind: '$gameStats' },
        { $match: { 'gameStats.game': game } },
        { $sort: { 'gameStats.score': -1 } }
      );
    } else {
      pipeline.push({ $sort: { 'stats.totalScore': -1 } });
    }

    pipeline.push(
      { $limit: 3 },
      {
        $project: {
          username: 1,
          'profile.displayName': 1,
          'profile.avatar': 1,
          stats: 1,
          gameStats: game && game !== 'overall' ? '$gameStats' : undefined
        }
      }
    );

    const top3 = await User.aggregate(pipeline);

    // Format for podium display
    const podium = top3.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      displayName: user.profile?.displayName || user.username,
      avatar: user.profile?.avatar,
      score: game && game !== 'overall' 
        ? user.gameStats?.score || 0
        : user.stats?.totalScore || 0,
      wins: game && game !== 'overall'
        ? user.gameStats?.wins || 0
        : user.stats?.totalWins || 0,
      winRate: (() => {
        const stats = game && game !== 'overall' ? user.gameStats : user.stats;
        const totalGames = (stats?.wins || 0) + (stats?.losses || 0);
        return totalGames > 0 ? ((stats?.wins || 0) / totalGames * 100).toFixed(1) : 0;
      })()
    }));

    res.json({
      success: true,
      podium,
      game: game || 'overall'
    });
  } catch (error) {
    console.error('Get top 3 error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/leaderboard/user/:userId/rank
// @desc    Get user's rank and nearby players
// @access  Public
router.get('/user/:userId/rank', async (req, res) => {
  try {
    const { userId } = req.params;
    const { game } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let userScore;
    if (game && game !== 'overall') {
      const gameStats = user.gameStats.find(stat => stat.game === game);
      userScore = gameStats?.score || 0;
    } else {
      userScore = user.stats.totalScore;
    }

    // Get user's rank
    let rankQuery = { isActive: true };
    let scoreField = 'stats.totalScore';

    if (game && game !== 'overall') {
      rankQuery['gameStats.game'] = game;
      rankQuery['gameStats.score'] = { $gt: userScore };
    } else {
      rankQuery[scoreField] = { $gt: userScore };
    }

    const usersAbove = await User.countDocuments(rankQuery);
    const userRank = usersAbove + 1;

    // Get nearby players (5 above, 5 below)
    let pipeline = [
      { $match: { isActive: true } }
    ];

    if (game && game !== 'overall') {
      pipeline.push(
        { $unwind: '$gameStats' },
        { $match: { 'gameStats.game': game } },
        { $sort: { 'gameStats.score': -1 } }
      );
    } else {
      pipeline.push({ $sort: { 'stats.totalScore': -1 } });
    }

    pipeline.push(
      { $skip: Math.max(0, userRank - 6) },
      { $limit: 11 },
      {
        $project: {
          username: 1,
          'profile.displayName': 1,
          'profile.avatar': 1,
          stats: 1,
          gameStats: game && game !== 'overall' ? '$gameStats' : '$gameStats'
        }
      }
    );

    const nearbyPlayers = await User.aggregate(pipeline);

    // Add ranks
    const rankedPlayers = nearbyPlayers.map((player, index) => ({
      ...player,
      rank: Math.max(1, userRank - 5) + index,
      isCurrentUser: player._id.toString() === userId
    }));

    res.json({
      success: true,
      userRank,
      nearbyPlayers: rankedPlayers,
      game: game || 'overall'
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/leaderboard/update-ranks
// @desc    Update global ranks (admin function)
// @access  Private
router.post('/update-ranks', async (req, res) => {
  try {
    // Update overall ranks
    const users = await User.find({ isActive: true })
      .sort({ 'stats.totalScore': -1 })
      .select('_id stats');

    const bulkOps = users.map((user, index) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { 'stats.globalRank': index + 1 }
      }
    }));

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    // Update game-specific ranks
    const games = ['valorant', 'cs2', 'fortnite', 'bgmi', 'rocket-league', 'apex-legends', 'free-fire', 'cod'];
    
    for (const game of games) {
      const gameUsers = await User.aggregate([
        { $unwind: '$gameStats' },
        { $match: { 'gameStats.game': game, isActive: true } },
        { $sort: { 'gameStats.score': -1 } },
        { $project: { _id: 1, 'gameStats.game': 1 } }
      ]);

      const gameBulkOps = gameUsers.map((user, index) => ({
        updateOne: {
          filter: { 
            _id: user._id,
            'gameStats.game': game
          },
          update: { 
            $set: { 'gameStats.$.rank': index + 1 }
          }
        }
      }));

      if (gameBulkOps.length > 0) {
        await User.bulkWrite(gameBulkOps);
      }
    }

    res.json({
      success: true,
      message: 'Ranks updated successfully'
    });
  } catch (error) {
    console.error('Update ranks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

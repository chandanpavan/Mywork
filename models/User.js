const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  profile: {
    displayName: String,
    bio: String,
    country: String,
    avatar: String,
    website: String,
    phoneNumber: String,
    favoriteGames: [String],
    joinDate: {
      type: Date,
      default: Date.now
    }
  },
  stats: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    totalDeaths: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    globalRank: { type: Number, default: null },
    totalScore: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 }
  },
  gameStats: [{
    game: String,
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    rank: { type: Number, default: null },
    lastPlayed: Date
  }],
  achievements: [{
    id: String,
    name: String,
    description: String,
    icon: String,
    unlockedAt: { type: Date, default: Date.now },
    category: String
  }],
  tournaments: [{
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    registeredAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['registered', 'active', 'completed', 'eliminated'], default: 'registered' },
    placement: Number,
    score: Number
  }],
  settings: {
    emailNotifications: { type: Boolean, default: true },
    loginAlerts: { type: Boolean, default: false },
    twoFactorAuth: { type: Boolean, default: false },
    profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
    gamePreferences: {
      autoJoinTournaments: { type: Boolean, default: false },
      receiveInvites: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true }
    }
  },
  friends: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
    addedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  isEmailVerified: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'stats.totalScore': -1 });
userSchema.index({ 'stats.globalRank': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update win rate
userSchema.methods.updateWinRate = function() {
  const totalGames = this.stats.totalWins + this.stats.totalLosses;
  this.stats.winRate = totalGames > 0 ? (this.stats.totalWins / totalGames) * 100 : 0;
};

// Get user's rank in specific game
userSchema.methods.getGameRank = function(game) {
  const gameStats = this.gameStats.find(stat => stat.game === game);
  return gameStats ? gameStats.rank : null;
};

// Add achievement
userSchema.methods.addAchievement = function(achievement) {
  const exists = this.achievements.some(ach => ach.id === achievement.id);
  if (!exists) {
    this.achievements.push(achievement);
  }
};

module.exports = mongoose.model('User', userSchema);

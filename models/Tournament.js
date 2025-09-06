const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    maxlength: [100, 'Tournament name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  game: {
    type: String,
    required: [true, 'Game is required'],
    enum: ['valorant', 'cs2', 'fortnite', 'bgmi', 'rocket-league', 'apex-legends', 'free-fire', 'cod']
  },
  format: {
    type: String,
    required: [true, 'Format is required'],
    enum: ['solo', 'duo', 'squad', 'team']
  },
  prizePool: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    distribution: [{
      position: Number,
      percentage: Number,
      amount: Number
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'registration', 'upcoming', 'live', 'completed', 'cancelled'],
    default: 'draft'
  },
  dates: {
    registrationStart: { type: Date, required: true },
    registrationEnd: { type: Date, required: true },
    tournamentStart: { type: Date, required: true },
    tournamentEnd: Date
  },
  participants: {
    maxTeams: { type: Number, required: true },
    currentTeams: { type: Number, default: 0 },
    teams: [{
      teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      players: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        role: String
      }],
      registeredAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['registered', 'confirmed', 'eliminated', 'winner'], default: 'registered' },
      score: { type: Number, default: 0 },
      placement: Number
    }]
  },
  rules: {
    type: String,
    default: 'Standard tournament rules apply. Fair play is expected from all participants.'
  },
  brackets: [{
    round: Number,
    matches: [{
      matchId: String,
      team1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      team2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      score: {
        team1Score: Number,
        team2Score: Number
      },
      status: { type: String, enum: ['pending', 'live', 'completed'], default: 'pending' },
      scheduledTime: Date,
      completedAt: Date
    }]
  }],
  settings: {
    isPublic: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    allowSpectators: { type: Boolean, default: true },
    region: { type: String, enum: ['global', 'na', 'eu', 'asia', 'india', 'sa'], default: 'global' },
    skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'professional'], default: 'intermediate' }
  },
  organizer: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    contact: String
  },
  sponsors: [{
    name: String,
    logo: String,
    website: String
  }],
  stream: {
    isLive: { type: Boolean, default: false },
    streamUrl: String,
    viewers: { type: Number, default: 0 },
    streamKey: String
  },
  chat: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    isSystemMessage: { type: Boolean, default: false }
  }],
  statistics: {
    totalRegistrations: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    averageMatchDuration: Number
  }
}, {
  timestamps: true
});

// Indexes for better performance
tournamentSchema.index({ game: 1, status: 1 });
tournamentSchema.index({ 'dates.tournamentStart': 1 });
tournamentSchema.index({ 'dates.registrationEnd': 1 });
tournamentSchema.index({ status: 1, 'dates.tournamentStart': 1 });

// Virtual for registration status
tournamentSchema.virtual('registrationOpen').get(function() {
  const now = new Date();
  return now >= this.dates.registrationStart && now <= this.dates.registrationEnd && this.status === 'registration';
});

// Virtual for slots remaining
tournamentSchema.virtual('slotsRemaining').get(function() {
  return this.participants.maxTeams - this.participants.currentTeams;
});

// Virtual for progress percentage
tournamentSchema.virtual('progressPercentage').get(function() {
  return (this.participants.currentTeams / this.participants.maxTeams) * 100;
});

// Method to register a team
tournamentSchema.methods.registerTeam = function(teamData) {
  if (this.participants.currentTeams >= this.participants.maxTeams) {
    throw new Error('Tournament is full');
  }
  
  if (!this.registrationOpen) {
    throw new Error('Registration is not open');
  }
  
  this.participants.teams.push(teamData);
  this.participants.currentTeams += 1;
  this.statistics.totalRegistrations += 1;
};

// Method to update tournament status
tournamentSchema.methods.updateStatus = function() {
  const now = new Date();
  
  if (now < this.dates.registrationStart) {
    this.status = 'draft';
  } else if (now >= this.dates.registrationStart && now <= this.dates.registrationEnd) {
    this.status = 'registration';
  } else if (now > this.dates.registrationEnd && now < this.dates.tournamentStart) {
    this.status = 'upcoming';
  } else if (now >= this.dates.tournamentStart && (!this.dates.tournamentEnd || now <= this.dates.tournamentEnd)) {
    this.status = 'live';
  } else if (this.dates.tournamentEnd && now > this.dates.tournamentEnd) {
    this.status = 'completed';
  }
};

// Method to generate brackets
tournamentSchema.methods.generateBrackets = function() {
  const teams = this.participants.teams.filter(team => team.status === 'confirmed');
  const numTeams = teams.length;
  
  // Simple single elimination bracket generation
  const rounds = Math.ceil(Math.log2(numTeams));
  const brackets = [];
  
  for (let round = 1; round <= rounds; round++) {
    const matches = [];
    const teamsInRound = Math.pow(2, rounds - round + 1);
    
    for (let i = 0; i < teamsInRound / 2; i++) {
      matches.push({
        matchId: `R${round}M${i + 1}`,
        team1: round === 1 ? teams[i * 2]?.teamId : null,
        team2: round === 1 ? teams[i * 2 + 1]?.teamId : null,
        status: 'pending'
      });
    }
    
    brackets.push({
      round,
      matches
    });
  }
  
  this.brackets = brackets;
};

module.exports = mongoose.model('Tournament', tournamentSchema);

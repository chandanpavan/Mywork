const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboard');
const chatRoutes = require('./routes/chat');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static('.'));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grindzone';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join tournament room
  socket.on('join-tournament', (tournamentId) => {
    socket.join(`tournament-${tournamentId}`);
    console.log(`User ${socket.id} joined tournament ${tournamentId}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    io.to(`tournament-${data.tournamentId}`).emit('chat-message', {
      id: Date.now(),
      user: data.user,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Handle tournament updates
  socket.on('tournament-update', (data) => {
    io.to(`tournament-${data.tournamentId}`).emit('tournament-update', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/chat', chatRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/grindzone.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/tournaments', (req, res) => {
  res.sendFile(__dirname + '/tournaments.html');
});

app.get('/leaderboard', (req, res) => {
  res.sendFile(__dirname + '/leaderboard.html');
});

app.get('/profile', (req, res) => {
  res.sendFile(__dirname + '/profile.html');
});

app.get('/achievements', (req, res) => {
  res.sendFile(__dirname + '/achievements.html');
});

app.get('/stats', (req, res) => {
  res.sendFile(__dirname + '/stats.html');
});

app.get('/stream', (req, res) => {
  res.sendFile(__dirname + '/stream.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 GRINDZONE Server running on port ${PORT}`);
  console.log(`📱 Website: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

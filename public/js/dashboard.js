// Dashboard (grindzone.html) functionality
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication
  if (!utils.requireAuth()) return;

  let currentUser = null;
  let socket = null;

  // Initialize dashboard
  initializeDashboard();

  async function initializeDashboard() {
    await loadUserData();
    await loadDashboardStats();
    await loadRecentTournaments();
    await loadUpcomingMatches();
    setupRealTimeFeatures();
    setupEventListeners();
  }

  // Load current user data
  async function loadUserData() {
    try {
      const response = await api.getCurrentUser();
      
      if (response.success) {
        currentUser = response.user;
        utils.setCurrentUser(currentUser);
        displayUserWelcome(currentUser);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Display welcome message
  function displayUserWelcome(user) {
    const welcomeSection = document.getElementById('welcomeSection');
    if (welcomeSection) {
      const timeOfDay = getTimeOfDay();
      welcomeSection.innerHTML = `
        <div class="welcome-content">
          <div class="welcome-text">
            <h1>Good ${timeOfDay}, ${user.profile?.displayName || user.username}!</h1>
            <p>Ready to dominate the competition today?</p>
          </div>
          <div class="user-avatar">
            <img src="${user.profile?.avatar || '/images/default-avatar.png'}" alt="Profile">
          </div>
        </div>
      `;
    }
  }

  // Get time of day for greeting
  function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }

  // Load dashboard statistics
  async function loadDashboardStats() {
    try {
      const [userStats, userRank] = await Promise.all([
        api.getUserStats(),
        currentUser ? api.getUserRank(currentUser._id) : null
      ]);

      if (userStats.success) {
        displayDashboardStats(userStats.stats, userRank?.success ? userRank : null);
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Display dashboard statistics
  function displayDashboardStats(stats, rankData) {
    const statsContainer = document.getElementById('dashboardStats');
    if (!statsContainer) return;

    const totalWinRate = (stats.totalWins + stats.totalLosses) > 0 
      ? ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1)
      : '0.0';

    statsContainer.innerHTML = `
      <div class="stat-card primary">
        <div class="stat-icon">
          <i class="icon-trophy"></i>
        </div>
        <div class="stat-content">
          <h3>${stats.totalScore.toLocaleString()}</h3>
          <p>Total Score</p>
        </div>
      </div>
      
      <div class="stat-card success">
        <div class="stat-icon">
          <i class="icon-target"></i>
        </div>
        <div class="stat-content">
          <h3>${stats.totalWins}</h3>
          <p>Total Wins</p>
        </div>
      </div>
      
      <div class="stat-card info">
        <div class="stat-icon">
          <i class="icon-percent"></i>
        </div>
        <div class="stat-content">
          <h3>${totalWinRate}%</h3>
          <p>Win Rate</p>
        </div>
      </div>
      
      <div class="stat-card warning">
        <div class="stat-icon">
          <i class="icon-ranking"></i>
        </div>
        <div class="stat-content">
          <h3>#${rankData?.userRank || stats.globalRank || 'N/A'}</h3>
          <p>Global Rank</p>
        </div>
      </div>
    `;
  }

  // Load recent tournaments
  async function loadRecentTournaments() {
    try {
      const response = await api.getTournaments({ limit: 5, status: 'all' });
      
      if (response.success) {
        displayRecentTournaments(response.tournaments);
      }
    } catch (error) {
      console.error('Error loading recent tournaments:', error);
    }
  }

  // Display recent tournaments
  function displayRecentTournaments(tournaments) {
    const tournamentsContainer = document.getElementById('recentTournaments');
    if (!tournamentsContainer) return;

    if (tournaments.length === 0) {
      tournamentsContainer.innerHTML = '<p>No recent tournaments</p>';
      return;
    }

    const tournamentsHTML = tournaments.slice(0, 3).map(tournament => `
      <div class="tournament-item" onclick="viewTournament('${tournament._id}')">
        <div class="tournament-info">
          <h4>${tournament.name}</h4>
          <p class="tournament-game">${tournament.game.toUpperCase()}</p>
          <p class="tournament-date">${utils.formatDate(tournament.startDate)}</p>
        </div>
        <div class="tournament-status">
          <span class="status-badge status-${tournament.status}">${tournament.status}</span>
          <span class="prize-pool">${utils.formatCurrency(tournament.prizePool)}</span>
        </div>
      </div>
    `).join('');

    tournamentsContainer.innerHTML = tournamentsHTML;
  }

  // Load upcoming matches/events
  async function loadUpcomingMatches() {
    // This would typically load from a matches API
    // For now, we'll show placeholder content
    const matchesContainer = document.getElementById('upcomingMatches');
    if (matchesContainer) {
      matchesContainer.innerHTML = `
        <div class="match-item">
          <div class="match-info">
            <h4>Weekly Valorant Championship</h4>
            <p>Quarterfinals</p>
            <p class="match-time">Today, 8:00 PM</p>
          </div>
          <div class="match-action">
            <button class="btn btn-sm btn-primary">Join</button>
          </div>
        </div>
        <div class="match-item">
          <div class="match-info">
            <h4>CS2 Battle Royale</h4>
            <p>Group Stage</p>
            <p class="match-time">Tomorrow, 6:00 PM</p>
          </div>
          <div class="match-action">
            <button class="btn btn-sm btn-outline">Register</button>
          </div>
        </div>
      `;
    }
  }

  // Setup real-time features
  function setupRealTimeFeatures() {
    // Initialize Socket.IO connection
    if (window.io) {
      socket = io();
      
      socket.on('connect', () => {
        console.log('Connected to server');
        if (currentUser) {
          socket.emit('user-online', currentUser._id);
        }
      });

      socket.on('tournament-update', (data) => {
        handleTournamentUpdate(data);
      });

      socket.on('new-notification', (notification) => {
        showRealTimeNotification(notification);
      });

      socket.on('leaderboard-update', () => {
        // Refresh leaderboard data if on leaderboard page
        if (window.location.pathname.includes('leaderboard')) {
          loadDashboardStats();
        }
      });
    }
  }

  // Handle tournament updates
  function handleTournamentUpdate(data) {
    utils.showNotification(`Tournament Update: ${data.message}`, 'info');
    loadRecentTournaments();
  }

  // Show real-time notification
  function showRealTimeNotification(notification) {
    const notificationsContainer = document.getElementById('notificationsContainer');
    if (notificationsContainer) {
      const notificationElement = document.createElement('div');
      notificationElement.className = 'notification-item new';
      notificationElement.innerHTML = `
        <div class="notification-content">
          <h5>${notification.title}</h5>
          <p>${notification.message}</p>
          <small>${utils.formatDate(notification.timestamp)}</small>
        </div>
      `;
      
      notificationsContainer.insertBefore(notificationElement, notificationsContainer.firstChild);
      
      // Remove 'new' class after animation
      setTimeout(() => {
        notificationElement.classList.remove('new');
      }, 3000);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Quick action buttons
    const quickTournamentBtn = document.getElementById('quickTournamentBtn');
    if (quickTournamentBtn) {
      quickTournamentBtn.addEventListener('click', () => {
        window.location.href = '/tournaments.html';
      });
    }

    const quickLeaderboardBtn = document.getElementById('quickLeaderboardBtn');
    if (quickLeaderboardBtn) {
      quickLeaderboardBtn.addEventListener('click', () => {
        window.location.href = '/leaderboard.html';
      });
    }

    const quickProfileBtn = document.getElementById('quickProfileBtn');
    if (quickProfileBtn) {
      quickProfileBtn.addEventListener('click', () => {
        window.location.href = '/profile.html';
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadDashboardStats();
        loadRecentTournaments();
        loadUpcomingMatches();
      });
    }
  }

  // Global functions
  window.viewTournament = function(tournamentId) {
    window.location.href = `/tournament-details.html?id=${tournamentId}`;
  };

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (socket) {
      socket.disconnect();
    }
  });

  // Auto-refresh dashboard data every 2 minutes
  setInterval(() => {
    loadDashboardStats();
    loadRecentTournaments();
  }, 120000);
});

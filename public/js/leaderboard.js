// Leaderboard page functionality
document.addEventListener('DOMContentLoaded', function() {
  let currentGame = 'overall';
  let currentPage = 1;
  const itemsPerPage = 20;

  // Initialize leaderboard
  initializeLeaderboard();

  async function initializeLeaderboard() {
    await loadTop3();
    await loadLeaderboard();
    setupEventListeners();
  }

  // Load top 3 players for podium
  async function loadTop3() {
    try {
      const response = await api.getTop3(currentGame);
      if (response.success) {
        displayPodium(response.podium);
      }
    } catch (error) {
      console.error('Error loading top 3:', error);
    }
  }

  // Display podium
  function displayPodium(podium) {
    const podiumContainer = document.getElementById('podium');
    if (!podiumContainer) return;

    podiumContainer.innerHTML = podium.map((player, index) => {
      const position = index + 1;
      const height = position === 1 ? '120px' : position === 2 ? '100px' : '80px';
      
      return `
        <div class="podium-position position-${position}" style="height: ${height}">
          <div class="player-info">
            <img src="${player.avatar || '/images/default-avatar.png'}" alt="${player.displayName}" class="player-avatar">
            <h3>${player.displayName}</h3>
            <p class="score">${player.score.toLocaleString()}</p>
            <p class="wins">${player.wins} wins</p>
            <p class="winrate">${player.winRate}% WR</p>
          </div>
          <div class="position-number">${position}</div>
        </div>
      `;
    }).join('');
  }

  // Load main leaderboard
  async function loadLeaderboard() {
    try {
      const leaderboardContainer = document.getElementById('leaderboardTable');
      if (!leaderboardContainer) return;

      // Show loading
      leaderboardContainer.innerHTML = '<div class="loading">Loading leaderboard...</div>';

      let response;
      if (currentGame === 'overall') {
        response = await api.getGlobalLeaderboard({
          page: currentPage,
          limit: itemsPerPage
        });
      } else {
        response = await api.getGameLeaderboard(currentGame, {
          page: currentPage,
          limit: itemsPerPage
        });
      }

      if (response.success) {
        displayLeaderboard(response.leaderboard);
        updatePagination(response.pagination);
        updateStatistics(response.statistics);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      const leaderboardContainer = document.getElementById('leaderboardTable');
      if (leaderboardContainer) {
        leaderboardContainer.innerHTML = '<div class="error">Failed to load leaderboard</div>';
      }
    }
  }

  // Display leaderboard table
  function displayLeaderboard(players) {
    const leaderboardContainer = document.getElementById('leaderboardTable');
    if (!leaderboardContainer) return;

    const tableHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
            <th>Wins</th>
            <th>Win Rate</th>
            <th>Country</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(player => {
            const stats = currentGame !== 'overall' ? player.gameStats : player.stats;
            const winRate = stats && (stats.wins + stats.losses) > 0 
              ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
              : '0.0';
            
            return `
              <tr class="leaderboard-row">
                <td class="rank">#${player.rank}</td>
                <td class="player">
                  <div class="player-info">
                    <img src="${player.profile?.avatar || '/images/default-avatar.png'}" alt="${player.username}" class="player-avatar-small">
                    <div>
                      <div class="player-name">${player.profile?.displayName || player.username}</div>
                      <div class="player-username">@${player.username}</div>
                    </div>
                  </div>
                </td>
                <td class="score">${(stats?.score || stats?.totalScore || 0).toLocaleString()}</td>
                <td class="wins">${stats?.wins || stats?.totalWins || 0}</td>
                <td class="winrate">${winRate}%</td>
                <td class="country">${player.profile?.country || 'N/A'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    leaderboardContainer.innerHTML = tableHTML;
  }

  // Update pagination
  function updatePagination(pagination) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    const { current, total, hasNext, hasPrev } = pagination;
    
    paginationContainer.innerHTML = `
      <button ${!hasPrev ? 'disabled' : ''} onclick="changePage(${current - 1})">Previous</button>
      <span>Page ${current} of ${total}</span>
      <button ${!hasNext ? 'disabled' : ''} onclick="changePage(${current + 1})">Next</button>
    `;
  }

  // Update statistics
  function updateStatistics(statistics) {
    const statsContainer = document.getElementById('leaderboardStats');
    if (!statsContainer || !statistics) return;

    statsContainer.innerHTML = `
      <div class="stat-item">
        <h3>${statistics.totalPlayers?.toLocaleString() || 0}</h3>
        <p>Total Players</p>
      </div>
      <div class="stat-item">
        <h3>${statistics.activeThisWeek?.toLocaleString() || 0}</h3>
        <p>Active This Week</p>
      </div>
      <div class="stat-item">
        <h3>${Math.round(statistics.averageScore || 0).toLocaleString()}</h3>
        <p>Average Score</p>
      </div>
    `;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Game filter buttons
    const gameButtons = document.querySelectorAll('.game-filter-btn');
    gameButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        if (game !== currentGame) {
          // Update active button
          gameButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          currentGame = game;
          currentPage = 1;
          loadTop3();
          loadLeaderboard();
        }
      });
    });

    // Search functionality
    const searchInput = document.getElementById('playerSearch');
    if (searchInput) {
      const debouncedSearch = utils.debounce(handleSearch, 300);
      searchInput.addEventListener('input', debouncedSearch);
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshLeaderboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadTop3();
        loadLeaderboard();
      });
    }
  }

  // Handle search
  async function handleSearch(event) {
    const query = event.target.value.trim();
    if (query.length < 2) {
      loadLeaderboard();
      return;
    }

    try {
      const response = await api.searchUsers(query, 20);
      if (response.success) {
        displaySearchResults(response.users);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  // Display search results
  function displaySearchResults(users) {
    const leaderboardContainer = document.getElementById('leaderboardTable');
    if (!leaderboardContainer) return;

    const tableHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Wins</th>
            <th>Win Rate</th>
            <th>Country</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => {
            const stats = user.stats;
            const winRate = (stats.totalWins + stats.totalLosses) > 0 
              ? ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1)
              : '0.0';
            
            return `
              <tr class="leaderboard-row">
                <td class="player">
                  <div class="player-info">
                    <img src="${user.profile?.avatar || '/images/default-avatar.png'}" alt="${user.username}" class="player-avatar-small">
                    <div>
                      <div class="player-name">${user.profile?.displayName || user.username}</div>
                      <div class="player-username">@${user.username}</div>
                    </div>
                  </div>
                </td>
                <td class="score">${stats.totalScore.toLocaleString()}</td>
                <td class="wins">${stats.totalWins}</td>
                <td class="winrate">${winRate}%</td>
                <td class="country">${user.profile?.country || 'N/A'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    leaderboardContainer.innerHTML = tableHTML;
  }

  // Global functions for pagination
  window.changePage = function(page) {
    if (page < 1) return;
    currentPage = page;
    loadLeaderboard();
  };

  // Auto-refresh every 30 seconds
  setInterval(() => {
    loadTop3();
    loadLeaderboard();
  }, 30000);
});

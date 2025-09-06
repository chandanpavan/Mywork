// Tournament page functionality
document.addEventListener('DOMContentLoaded', function() {
  let currentFilters = {
    status: 'all',
    game: 'all',
    type: 'all'
  };

  // Initialize tournaments page
  initializeTournaments();

  async function initializeTournaments() {
    await loadTournaments();
    setupEventListeners();
    setupCreateTournamentModal();
  }

  // Load tournaments with current filters
  async function loadTournaments() {
    try {
      const tournamentsContainer = document.getElementById('tournamentsContainer');
      if (!tournamentsContainer) return;

      // Show loading
      tournamentsContainer.innerHTML = '<div class="loading">Loading tournaments...</div>';

      const response = await api.getTournaments(currentFilters);
      
      if (response.success) {
        displayTournaments(response.tournaments);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
      const tournamentsContainer = document.getElementById('tournamentsContainer');
      if (tournamentsContainer) {
        tournamentsContainer.innerHTML = '<div class="error">Failed to load tournaments</div>';
      }
    }
  }

  // Display tournaments
  function displayTournaments(tournaments) {
    const tournamentsContainer = document.getElementById('tournamentsContainer');
    if (!tournamentsContainer) return;

    if (tournaments.length === 0) {
      tournamentsContainer.innerHTML = '<div class="no-tournaments">No tournaments found</div>';
      return;
    }

    const tournamentsHTML = tournaments.map(tournament => {
      const startDate = new Date(tournament.startDate);
      const registrationEnd = new Date(tournament.registrationDeadline);
      const now = new Date();
      
      const canRegister = tournament.status === 'upcoming' && 
                         now < registrationEnd && 
                         tournament.participants.teams.length < tournament.maxParticipants;

      const isRegistered = tournament.participants.teams.some(team => 
        team.players.some(player => player.userId === utils.getCurrentUser()?._id)
      );

      return `
        <div class="tournament-card" data-tournament-id="${tournament._id}">
          <div class="tournament-header">
            <img src="/images/${tournament.game}-banner.jpg" alt="${tournament.game}" class="tournament-banner" onerror="this.src='/images/default-tournament.jpg'">
            <div class="tournament-status status-${tournament.status}">${tournament.status.toUpperCase()}</div>
          </div>
          
          <div class="tournament-content">
            <h3 class="tournament-title">${tournament.name}</h3>
            <p class="tournament-description">${tournament.description}</p>
            
            <div class="tournament-details">
              <div class="detail-item">
                <i class="icon-game"></i>
                <span>${tournament.game.toUpperCase()}</span>
              </div>
              <div class="detail-item">
                <i class="icon-calendar"></i>
                <span>${utils.formatDate(startDate)}</span>
              </div>
              <div class="detail-item">
                <i class="icon-trophy"></i>
                <span>${utils.formatCurrency(tournament.prizePool)}</span>
              </div>
              <div class="detail-item">
                <i class="icon-users"></i>
                <span>${tournament.participants.teams.length}/${tournament.maxParticipants}</span>
              </div>
            </div>

            <div class="tournament-actions">
              ${isRegistered ? 
                `<button class="btn btn-danger" onclick="unregisterFromTournament('${tournament._id}')">Unregister</button>` :
                canRegister ? 
                  `<button class="btn btn-primary" onclick="registerForTournament('${tournament._id}')">Register</button>` :
                  `<button class="btn btn-secondary" disabled>Registration Closed</button>`
              }
              <button class="btn btn-outline" onclick="viewTournament('${tournament._id}')">View Details</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    tournamentsContainer.innerHTML = tournamentsHTML;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filterType = btn.dataset.filter;
        const filterValue = btn.dataset.value;
        
        // Update active button
        document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentFilters[filterType] = filterValue;
        loadTournaments();
      });
    });

    // Create tournament button
    const createBtn = document.getElementById('createTournamentBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        if (!utils.requireAuth()) return;
        openCreateTournamentModal();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshTournaments');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadTournaments);
    }
  }

  // Setup create tournament modal
  function setupCreateTournamentModal() {
    const modal = document.getElementById('createTournamentModal');
    const form = document.getElementById('createTournamentForm');
    const closeBtn = document.querySelector('.modal-close');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeCreateTournamentModal);
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeCreateTournamentModal();
        }
      });
    }

    if (form) {
      form.addEventListener('submit', handleCreateTournament);
    }
  }

  // Open create tournament modal
  function openCreateTournamentModal() {
    const modal = document.getElementById('createTournamentModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  // Close create tournament modal
  function closeCreateTournamentModal() {
    const modal = document.getElementById('createTournamentModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Handle create tournament form submission
  async function handleCreateTournament(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const tournamentData = {
      name: formData.get('name'),
      description: formData.get('description'),
      game: formData.get('game'),
      type: formData.get('type'),
      format: formData.get('format'),
      maxParticipants: parseInt(formData.get('maxParticipants')),
      prizePool: parseFloat(formData.get('prizePool')),
      entryFee: parseFloat(formData.get('entryFee')),
      startDate: formData.get('startDate'),
      registrationDeadline: formData.get('registrationDeadline'),
      rules: formData.get('rules').split('\n').filter(rule => rule.trim())
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      utils.showLoading(submitBtn);
      
      const response = await api.createTournament(tournamentData);
      
      if (response.success) {
        utils.showNotification('Tournament created successfully!', 'success');
        closeCreateTournamentModal();
        e.target.reset();
        loadTournaments();
      }
    } catch (error) {
      utils.showNotification(error.message || 'Failed to create tournament', 'error');
    } finally {
      utils.hideLoading(submitBtn, originalText);
    }
  }

  // Global functions for tournament actions
  window.registerForTournament = async function(tournamentId) {
    if (!utils.requireAuth()) return;

    try {
      const response = await api.registerForTournament(tournamentId);
      
      if (response.success) {
        utils.showNotification('Successfully registered for tournament!', 'success');
        loadTournaments();
      }
    } catch (error) {
      utils.showNotification(error.message || 'Failed to register for tournament', 'error');
    }
  };

  window.unregisterFromTournament = async function(tournamentId) {
    if (!utils.requireAuth()) return;

    if (!confirm('Are you sure you want to unregister from this tournament?')) {
      return;
    }

    try {
      const response = await api.unregisterFromTournament(tournamentId);
      
      if (response.success) {
        utils.showNotification('Successfully unregistered from tournament', 'success');
        loadTournaments();
      }
    } catch (error) {
      utils.showNotification(error.message || 'Failed to unregister from tournament', 'error');
    }
  };

  window.viewTournament = function(tournamentId) {
    window.location.href = `/tournament-details.html?id=${tournamentId}`;
  };

  // Auto-refresh tournaments every 60 seconds
  setInterval(loadTournaments, 60000);
});

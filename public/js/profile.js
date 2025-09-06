// Profile page functionality
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication
  if (!utils.requireAuth()) return;

  let currentUser = null;
  let isEditing = false;

  // Initialize profile page
  initializeProfile();

  async function initializeProfile() {
    await loadUserProfile();
    await loadUserStats();
    await loadUserAchievements();
    setupEventListeners();
  }

  // Load user profile data
  async function loadUserProfile() {
    try {
      const response = await api.getUserProfile();
      
      if (response.success) {
        currentUser = response.user;
        displayProfile(currentUser);
        utils.setCurrentUser(currentUser);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      utils.showNotification('Failed to load profile data', 'error');
    }
  }

  // Display profile information
  function displayProfile(user) {
    // Profile header
    const profileHeader = document.getElementById('profileHeader');
    if (profileHeader) {
      profileHeader.innerHTML = `
        <div class="profile-avatar-container">
          <img src="${user.profile?.avatar || '/images/default-avatar.png'}" alt="Profile" class="profile-avatar" id="profileAvatar">
          <button class="avatar-edit-btn" id="avatarEditBtn" style="display: none;">
            <i class="icon-camera"></i>
          </button>
        </div>
        <div class="profile-info">
          <h1 class="profile-name" id="profileName">${user.profile?.displayName || user.username}</h1>
          <p class="profile-username">@${user.username}</p>
          <p class="profile-bio" id="profileBio">${user.profile?.bio || 'No bio available'}</p>
          <div class="profile-details">
            <span class="detail-item">
              <i class="icon-location"></i>
              <span id="profileCountry">${user.profile?.country || 'Not specified'}</span>
            </span>
            <span class="detail-item">
              <i class="icon-calendar"></i>
              <span>Joined ${utils.formatDate(user.createdAt)}</span>
            </span>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-primary" id="editProfileBtn">Edit Profile</button>
          <button class="btn btn-success" id="saveProfileBtn" style="display: none;">Save Changes</button>
          <button class="btn btn-secondary" id="cancelEditBtn" style="display: none;">Cancel</button>
        </div>
      `;
    }

    // Profile stats overview
    const statsOverview = document.getElementById('statsOverview');
    if (statsOverview) {
      const stats = user.stats;
      statsOverview.innerHTML = `
        <div class="stat-card">
          <h3>${stats.totalScore.toLocaleString()}</h3>
          <p>Total Score</p>
        </div>
        <div class="stat-card">
          <h3>${stats.totalWins}</h3>
          <p>Total Wins</p>
        </div>
        <div class="stat-card">
          <h3>${stats.totalMatches}</h3>
          <p>Matches Played</p>
        </div>
        <div class="stat-card">
          <h3>${stats.globalRank || 'Unranked'}</h3>
          <p>Global Rank</p>
        </div>
      `;
    }
  }

  // Load user statistics
  async function loadUserStats() {
    try {
      const response = await api.getUserStats();
      
      if (response.success) {
        displayGameStats(response.stats.gameStats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Display game-specific statistics
  function displayGameStats(gameStats) {
    const gameStatsContainer = document.getElementById('gameStats');
    if (!gameStatsContainer) return;

    if (!gameStats || gameStats.length === 0) {
      gameStatsContainer.innerHTML = '<p>No game statistics available</p>';
      return;
    }

    const statsHTML = gameStats.map(stat => {
      const winRate = (stat.wins + stat.losses) > 0 
        ? ((stat.wins / (stat.wins + stat.losses)) * 100).toFixed(1)
        : '0.0';

      return `
        <div class="game-stat-card">
          <div class="game-header">
            <img src="/images/${stat.game}-banner.jpg" alt="${stat.game}" class="game-icon" onerror="this.src='/images/default-game.png'">
            <h3>${stat.game.toUpperCase()}</h3>
          </div>
          <div class="game-stats">
            <div class="stat-item">
              <span class="stat-value">${stat.score.toLocaleString()}</span>
              <span class="stat-label">Score</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stat.wins}</span>
              <span class="stat-label">Wins</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stat.losses}</span>
              <span class="stat-label">Losses</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${winRate}%</span>
              <span class="stat-label">Win Rate</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">#${stat.rank || 'N/A'}</span>
              <span class="stat-label">Rank</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    gameStatsContainer.innerHTML = statsHTML;
  }

  // Load user achievements
  async function loadUserAchievements() {
    if (!currentUser) return;

    const achievementsContainer = document.getElementById('achievements');
    if (!achievementsContainer) return;

    const achievements = currentUser.achievements || [];
    
    if (achievements.length === 0) {
      achievementsContainer.innerHTML = '<p>No achievements unlocked yet</p>';
      return;
    }

    const achievementsHTML = achievements.map(achievement => `
      <div class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">
          <i class="icon-trophy"></i>
        </div>
        <div class="achievement-info">
          <h4>${achievement.title}</h4>
          <p>${achievement.description}</p>
          ${achievement.unlocked ? 
            `<span class="unlock-date">Unlocked ${utils.formatDate(achievement.unlockedAt)}</span>` :
            '<span class="locked-text">Locked</span>'
          }
        </div>
      </div>
    `).join('');

    achievementsContainer.innerHTML = achievementsHTML;
  }

  // Setup event listeners
  function setupEventListeners() {
    const editBtn = document.getElementById('editProfileBtn');
    const saveBtn = document.getElementById('saveProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');

    if (editBtn) {
      editBtn.addEventListener('click', toggleEditMode);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveProfile);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEdit);
    }

    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', handleSettingsUpdate);
    }
  }

  // Toggle edit mode
  function toggleEditMode() {
    isEditing = !isEditing;
    
    const editBtn = document.getElementById('editProfileBtn');
    const saveBtn = document.getElementById('saveProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const avatarEditBtn = document.getElementById('avatarEditBtn');

    if (isEditing) {
      // Show edit controls
      editBtn.style.display = 'none';
      saveBtn.style.display = 'inline-block';
      cancelBtn.style.display = 'inline-block';
      avatarEditBtn.style.display = 'block';

      // Make fields editable
      makeFieldsEditable();
    } else {
      // Hide edit controls
      editBtn.style.display = 'inline-block';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      avatarEditBtn.style.display = 'none';

      // Make fields read-only
      makeFieldsReadOnly();
    }
  }

  // Make profile fields editable
  function makeFieldsEditable() {
    const profileName = document.getElementById('profileName');
    const profileBio = document.getElementById('profileBio');
    const profileCountry = document.getElementById('profileCountry');

    if (profileName) {
      profileName.innerHTML = `<input type="text" id="editDisplayName" value="${currentUser.profile?.displayName || currentUser.username}" class="edit-input">`;
    }

    if (profileBio) {
      profileBio.innerHTML = `<textarea id="editBio" class="edit-textarea" placeholder="Tell us about yourself...">${currentUser.profile?.bio || ''}</textarea>`;
    }

    if (profileCountry) {
      profileCountry.innerHTML = `<input type="text" id="editCountry" value="${currentUser.profile?.country || ''}" class="edit-input" placeholder="Country">`;
    }
  }

  // Make profile fields read-only
  function makeFieldsReadOnly() {
    const profileName = document.getElementById('profileName');
    const profileBio = document.getElementById('profileBio');
    const profileCountry = document.getElementById('profileCountry');

    if (profileName) {
      profileName.textContent = currentUser.profile?.displayName || currentUser.username;
    }

    if (profileBio) {
      profileBio.textContent = currentUser.profile?.bio || 'No bio available';
    }

    if (profileCountry) {
      profileCountry.textContent = currentUser.profile?.country || 'Not specified';
    }
  }

  // Save profile changes
  async function saveProfile() {
    const displayName = document.getElementById('editDisplayName')?.value;
    const bio = document.getElementById('editBio')?.value;
    const country = document.getElementById('editCountry')?.value;

    const profileData = {
      profile: {
        displayName: displayName || currentUser.username,
        bio: bio || '',
        country: country || ''
      }
    };

    try {
      const response = await api.updateProfile(profileData);
      
      if (response.success) {
        currentUser = response.user;
        utils.setCurrentUser(currentUser);
        utils.showNotification('Profile updated successfully!', 'success');
        toggleEditMode();
        displayProfile(currentUser);
      }
    } catch (error) {
      utils.showNotification(error.message || 'Failed to update profile', 'error');
    }
  }

  // Cancel edit
  function cancelEdit() {
    toggleEditMode();
    displayProfile(currentUser);
  }

  // Handle settings update
  async function handleSettingsUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const settings = {
      notifications: {
        email: formData.get('emailNotifications') === 'on',
        push: formData.get('pushNotifications') === 'on',
        tournaments: formData.get('tournamentNotifications') === 'on'
      },
      privacy: {
        profileVisibility: formData.get('profileVisibility'),
        showStats: formData.get('showStats') === 'on'
      }
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      utils.showLoading(submitBtn);
      
      const response = await api.updateSettings(settings);
      
      if (response.success) {
        utils.showNotification('Settings updated successfully!', 'success');
      }
    } catch (error) {
      utils.showNotification(error.message || 'Failed to update settings', 'error');
    } finally {
      utils.hideLoading(submitBtn, originalText);
    }
  }
});

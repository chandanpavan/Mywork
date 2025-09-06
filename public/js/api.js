// API Configuration and Utilities
class API {
  constructor() {
    this.baseURL = window.location.origin + '/api';
    this.token = localStorage.getItem('authToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Remove authentication token
  removeToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Get headers with authentication
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic API request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Authentication methods
  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async register(username, email, password) {
    const response = await this.post('/auth/register', { username, email, password });
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    try {
      await this.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.removeToken();
    }
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  // User methods
  async getUserProfile() {
    return this.get('/users/profile');
  }

  async updateProfile(profileData) {
    return this.put('/users/profile', profileData);
  }

  async getUserStats() {
    return this.get('/users/stats');
  }

  async updateStats(statsData) {
    return this.put('/users/stats', statsData);
  }

  async updateSettings(settings) {
    return this.put('/users/settings', { settings });
  }

  async searchUsers(query, limit = 10) {
    return this.get(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Tournament methods
  async getTournaments(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/tournaments?${params}`);
  }

  async getTournament(id) {
    return this.get(`/tournaments/${id}`);
  }

  async createTournament(tournamentData) {
    return this.post('/tournaments', tournamentData);
  }

  async registerForTournament(id) {
    return this.post(`/tournaments/${id}/register`);
  }

  async unregisterFromTournament(id) {
    return this.delete(`/tournaments/${id}/unregister`);
  }

  async getTournamentBrackets(id) {
    return this.get(`/tournaments/${id}/brackets`);
  }

  // Leaderboard methods
  async getGlobalLeaderboard(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/leaderboard/global?${params}`);
  }

  async getGameLeaderboard(game, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/leaderboard/game/${game}?${params}`);
  }

  async getTournamentLeaderboard(tournamentId) {
    return this.get(`/leaderboard/tournament/${tournamentId}`);
  }

  async getTop3(game = 'overall') {
    return this.get(`/leaderboard/top3/${game}`);
  }

  async getUserRank(userId, game = 'overall') {
    const params = game !== 'overall' ? `?game=${game}` : '';
    return this.get(`/leaderboard/user/${userId}/rank${params}`);
  }

  // Chat methods
  async getTournamentChat(tournamentId, page = 1, limit = 50) {
    return this.get(`/chat/tournament/${tournamentId}?page=${page}&limit=${limit}`);
  }

  async sendChatMessage(tournamentId, message) {
    return this.post(`/chat/tournament/${tournamentId}`, { message });
  }

  async getOnlineUsers(tournamentId) {
    return this.get(`/chat/tournament/${tournamentId}/online`);
  }
}

// Create global API instance
window.api = new API();

// Utility functions
window.utils = {
  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  // Format date
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format currency
  formatCurrency(amount, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  },

  // Redirect to login if not authenticated
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login';
      return false;
    }
    return true;
  },

  // Get user data from localStorage
  getCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  },

  // Save user data to localStorage
  setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  },

  // Remove user data
  clearCurrentUser() {
    localStorage.removeItem('currentUser');
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Loading state management
  showLoading(element) {
    if (element) {
      element.disabled = true;
      element.innerHTML = '<span class="loading-spinner"></span> Loading...';
    }
  },

  hideLoading(element, originalText) {
    if (element) {
      element.disabled = false;
      element.innerHTML = originalText;
    }
  }
};

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

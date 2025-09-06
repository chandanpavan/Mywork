// Authentication handling for login page
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is already logged in
  if (utils.isAuthenticated()) {
    window.location.href = '/grindzone.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginContainer = document.getElementById('loginContainer');
  const registerContainer = document.getElementById('registerContainer');

  // Tab switching
  if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      if (loginContainer) loginContainer.style.display = 'block';
      if (registerContainer) registerContainer.style.display = 'none';
    });

    registerTab.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      if (registerContainer) registerContainer.style.display = 'block';
      if (loginContainer) loginContainer.style.display = 'none';
    });
  }

  // Login form handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      try {
        utils.showLoading(submitBtn);
        
        const response = await api.login(email, password);
        
        if (response.success) {
          utils.setCurrentUser(response.user);
          utils.showNotification('Login successful! Welcome back.', 'success');
          
          // Redirect after short delay
          setTimeout(() => {
            window.location.href = '/grindzone.html';
          }, 1000);
        }
      } catch (error) {
        utils.showNotification(error.message || 'Login failed. Please try again.', 'error');
      } finally {
        utils.hideLoading(submitBtn, originalText);
      }
    });
  }

  // Register form handler
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('registerUsername').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      // Client-side validation
      if (password !== confirmPassword) {
        utils.showNotification('Passwords do not match', 'error');
        return;
      }

      if (password.length < 6) {
        utils.showNotification('Password must be at least 6 characters long', 'error');
        return;
      }

      try {
        utils.showLoading(submitBtn);
        
        const response = await api.register(username, email, password);
        
        if (response.success) {
          utils.setCurrentUser(response.user);
          utils.showNotification('Registration successful! Welcome to GRINDZONE.', 'success');
          
          // Redirect after short delay
          setTimeout(() => {
            window.location.href = '/grindzone.html';
          }, 1000);
        }
      } catch (error) {
        utils.showNotification(error.message || 'Registration failed. Please try again.', 'error');
      } finally {
        utils.hideLoading(submitBtn, originalText);
      }
    });
  }

  // Password visibility toggle
  const togglePasswordBtns = document.querySelectorAll('.toggle-password');
  togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      btn.textContent = type === 'password' ? '👁️' : '🙈';
    });
  });
});

// Logout function (can be called from any page)
async function logout() {
  try {
    await api.logout();
    utils.clearCurrentUser();
    utils.showNotification('Logged out successfully', 'success');
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
    // Clear local data even if API call fails
    utils.clearCurrentUser();
    api.removeToken();
    window.location.href = '/login.html';
  }
}

// Check authentication status on protected pages
function checkAuth() {
  if (!utils.isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Update navigation based on auth status
function updateNavigation() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userProfile = document.getElementById('userProfile');
  
  if (utils.isAuthenticated()) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) {
      logoutBtn.style.display = 'block';
      logoutBtn.addEventListener('click', logout);
    }
    
    // Update user profile display
    const currentUser = utils.getCurrentUser();
    if (userProfile && currentUser) {
      userProfile.innerHTML = `
        <img src="${currentUser.profile?.avatar || '/images/default-avatar.png'}" alt="Profile" class="nav-avatar">
        <span>${currentUser.profile?.displayName || currentUser.username}</span>
      `;
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userProfile) userProfile.innerHTML = '';
  }
}

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', updateNavigation);

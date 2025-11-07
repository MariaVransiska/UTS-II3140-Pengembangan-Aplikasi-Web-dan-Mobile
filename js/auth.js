class AuthManager {
  constructor() {
    this.apiBaseUrl = '/api'; 
    this.token = localStorage.getItem('authToken');
    this.user = null;
    this.init();
  }

  init() {
    if (this.token) {
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          console.error('Error parsing user data:', error);
          this.logout();
        }
      }
    }
    this.updateUI();
  }

  async apiRequest(endpoint, options = {}) {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  async register(userData) {
    try {
      const response = await this.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (response.success) {
        this.token = response.data.token;
        this.user = response.data.user;
        localStorage.setItem('authToken', this.token);
        localStorage.setItem('userData', JSON.stringify(this.user));
        this.updateUI();
        return response;
      }
    } catch (error) {
      console.error('Backend registration failed, using local storage:', error);

      return this.registerLocal(userData);
    }
  }

  registerLocal(userData) {
    try {
      const existingUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
      const existingUser = existingUsers.find(u => u.email === userData.email || u.nim === userData.nim);
      
      if (existingUser) {
        throw new Error(existingUser.email === userData.email ? 'Email sudah terdaftar' : 'NIM sudah terdaftar');
      }

      const newUser = {
        _id: 'local_' + Date.now(),
        name: userData.name,
        email: userData.email,
        nim: userData.nim,
        kelas: userData.kelas,
        gender: userData.gender,
        role: 'student',
        isActive: true,
        lastLogin: new Date().toISOString(),
        progress: {
          quizScores: [],
          assignments: [],
          journalEntries: [],
          materialsViewed: [],
          videosWatched: []
        },
        statistics: {
          totalQuizAttempts: 0,
          averageQuizScore: 0,
          totalStudyTime: 0,
          streakDays: 0,
          lastActiveDate: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const localToken = 'local_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      existingUsers.push(newUser);
      localStorage.setItem('localUsers', JSON.stringify(existingUsers));
      localStorage.setItem(`password_${userData.email}`, userData.password); // Store password for login
      localStorage.setItem('authToken', localToken);
      localStorage.setItem('userData', JSON.stringify(newUser));

      this.token = localToken;
      this.user = newUser;
      this.updateUI();

      return {
        success: true,
        message: 'Registrasi berhasil (mode offline)',
        data: {
          user: newUser,
          token: localToken
        }
      };
    } catch (error) {
      console.error('Local registration error:', error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await this.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success) {
        this.token = response.data.token;
        this.user = response.data.user;
        
        // Save auth data
        localStorage.setItem('authToken', this.token);
        localStorage.setItem('userData', JSON.stringify(this.user));
        
        // ✅ NEW: Save progress dari backend
        if (this.user.progress) {
          localStorage.setItem('userProgress', JSON.stringify(this.user.progress));
        }
        
        // ✅ NEW: Save statistics dari backend
        if (this.user.statistics) {
          localStorage.setItem('userStatistics', JSON.stringify(this.user.statistics));
        }
        
        this.updateUI();
        
        // ✅ NEW: Trigger event untuk refresh progress UI
        window.dispatchEvent(new CustomEvent('progressLoaded', { 
          detail: { 
            progress: this.user.progress,
            statistics: this.user.statistics
          }
        }));
        
        return response;
      }
    } catch (error) {
      console.error('Backend login failed, trying local storage:', error);
      
      return this.loginLocal(email, password);
    }
  }

  loginLocal(email, password) {
    try {
      const users = JSON.parse(localStorage.getItem('localUsers') || '[]');
      const user = users.find(u => u.email === email);
      
      if (!user) {
        throw new Error('Email atau password salah');
      }

      const storedPassword = localStorage.getItem(`password_${user.email}`);
      if (!storedPassword || storedPassword !== password) {
        throw new Error('Email atau password salah');
      }

      user.lastLogin = new Date().toISOString();
      user.statistics.lastActiveDate = new Date().toISOString();
      
      const updatedUsers = users.map(u => u.email === email ? user : u);
      localStorage.setItem('localUsers', JSON.stringify(updatedUsers));

      const localToken = 'local_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      localStorage.setItem('authToken', localToken);
      localStorage.setItem('userData', JSON.stringify(user));
      
      // ✅ NEW: Save progress untuk local login
      if (user.progress) {
        localStorage.setItem('userProgress', JSON.stringify(user.progress));
      }
      
      // ✅ NEW: Save statistics untuk local login
      if (user.statistics) {
        localStorage.setItem('userStatistics', JSON.stringify(user.statistics));
      }

      this.token = localToken;
      this.user = user;
      this.updateUI();
      
      // ✅ NEW: Trigger event untuk refresh progress UI
      window.dispatchEvent(new CustomEvent('progressLoaded', { 
        detail: { 
          progress: user.progress,
          statistics: user.statistics
        }
      }));

      return {
        success: true,
        message: 'Login berhasil',
        data: {
          user: user,
          token: localToken
        }
      };
    } catch (error) {
      console.error('Local login error:', error);
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    this.updateUI();
  }

  async validateToken() {
    try {
      const response = await this.apiRequest('/auth/me');
      if (response.success) {
        this.user = response.data.user;
        localStorage.setItem('userData', JSON.stringify(this.user));
        return true;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      this.logout();
      return false;
    }
  }

  isAuthenticated() {
    if (!this.token) {
      console.log('Auth check: No token');
      return false;
    }
    
    if (!this.user) {
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
          console.log('Auth check: User data loaded from localStorage');
        } catch (error) {
          console.error('Error parsing user data:', error);
          this.logout();
          return false;
        }
      }
    }
    
    const isAuth = !!this.token && !!this.user;
    console.log('Auth check:', { token: !!this.token, user: !!this.user, isAuth });
    return isAuth;
  }

  isProfileComplete() {
    if (!this.user) return false;
    
    return true;
  }

  updateUI() {
    const authElements = document.querySelectorAll('[data-auth]');
    const guestElements = document.querySelectorAll('[data-guest]');
    const userElements = document.querySelectorAll('[data-user]');
    const profileCompleteElements = document.querySelectorAll('[data-profile-complete]');
    const profileIncompleteElements = document.querySelectorAll('[data-profile-incomplete]');

    if (this.isAuthenticated()) {
      authElements.forEach(el => el.style.display = 'block');
      guestElements.forEach(el => el.style.display = 'none');
      
      const profileComplete = this.isProfileComplete();
      
      if (profileComplete) {
        profileCompleteElements.forEach(el => el.style.display = 'block');
        profileIncompleteElements.forEach(el => el.style.display = 'none');
      } else {
        profileCompleteElements.forEach(el => el.style.display = 'none');
        profileIncompleteElements.forEach(el => el.style.display = 'block');
      }
      
      userElements.forEach(el => {
        if (el.dataset.user === 'name') {
          el.textContent = this.user.name || 'Belum diisi';
        } else if (el.dataset.user === 'email') {
          el.textContent = this.user.email;
        } else if (el.dataset.user === 'nim') {
          el.textContent = this.user.nim || 'Belum diisi';
        } else if (el.dataset.user === 'kelas') {
          el.textContent = this.user.kelas || 'Belum diisi';
        } else if (el.dataset.user === 'gender') {
          el.textContent = this.user.gender === 'female' ? 'Perempuan' : 
                          this.user.gender === 'male' ? 'Laki-laki' : 'Belum diisi';
        }
      });

      this.updateNavigation();
    } else {
      authElements.forEach(el => el.style.display = 'none');
      guestElements.forEach(el => el.style.display = 'block');
      profileCompleteElements.forEach(el => el.style.display = 'none');
      profileIncompleteElements.forEach(el => el.style.display = 'none');
    }
  }

  updateNavigation() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const existingLogout = nav.querySelector('.logout-btn');
    if (existingLogout) {
      existingLogout.remove();
    }

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'logout-btn';
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      this.logout();
      window.location.href = 'index.html';
    };
    nav.appendChild(logoutBtn);

    const navLinks = nav.querySelectorAll('a:not(.logout-btn)');
    const profileComplete = this.isProfileComplete();
    
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      
      if (href === 'index.html' || href === 'profile.html') {
        return;
      }
      
      if (!profileComplete && href !== 'index.html' && href !== 'profile.html') {
        link.style.opacity = '0.5';
        link.style.pointerEvents = 'none';
        link.title = 'Lengkapi profil terlebih dahulu';
      } else {
        link.style.opacity = '1';
        link.style.pointerEvents = 'auto';
        link.title = '';
      }
    });
  }

  async saveQuizResults(quizData) {
    try {
      const response = await this.apiRequest('/progress/quiz', {
        method: 'POST',
        body: JSON.stringify(quizData)
      });
      return response;
    } catch (error) {
      console.error('Save quiz results error:', error);
      throw error;
    }
  }

  async saveAssignment(assignmentData) {
    try {
      const response = await this.apiRequest('/progress/assignment', {
        method: 'POST',
        body: JSON.stringify(assignmentData)
      });
      return response;
    } catch (error) {
      console.error('Save assignment error:', error);
      throw error;
    }
  }

  async saveJournalEntry(entryData) {
    try {
      const response = await this.apiRequest('/progress/journal', {
        method: 'POST',
        body: JSON.stringify(entryData)
      });
      return response;
    } catch (error) {
      console.error('Save journal entry error:', error);
      throw error;
    }
  }

  async getUserProgress() {
    try {
      const response = await this.apiRequest('/progress/overview');
      return response;
    } catch (error) {
      console.error('Get user progress error:', error);
      throw error;
    }
  }

  async trackMaterialView(materialData) {
    try {
      const response = await this.apiRequest('/progress/material-viewed', {
        method: 'POST',
        body: JSON.stringify(materialData)
      });
      return response;
    } catch (error) {
      console.error('Track material view error:', error);
    }
  }

  async trackVideoWatch(videoData) {
    try {
      const response = await this.apiRequest('/progress/video-watched', {
        method: 'POST',
        body: JSON.stringify(videoData)
      });
      return response;
    } catch (error) {
      console.error('Track video watch error:', error);
    }
  }
}

const authManager = new AuthManager();

class AuthUI {
  constructor() {
    this.authManager = authManager;
    this.init();
  }

  init() {
    this.createAuthModal();
    this.bindEvents();
  }

  createAuthModal() {
    const modalHTML = `
      <div id="auth-modal" class="auth-modal" style="display: none;">
        <div class="auth-modal-content">
          <span class="auth-close">&times;</span>
          
          <!-- Login Form -->
          <div id="login-form" class="auth-form">
            <h2>Login</h2>
            <form id="login-submit">
              <div class="form-group">
                <label for="login-email">Email:</label>
                <input type="email" id="login-email" required>
              </div>
              <div class="form-group">
                <label for="login-password">Password:</label>
                <input type="password" id="login-password" required>
              </div>
              <button type="submit">Login</button>
            </form>
            <p>Belum punya akun? <a href="#" id="show-register">Daftar di sini</a></p>
          </div>

          <!-- Register Form -->
          <div id="register-form" class="auth-form" style="display: none;">
            <h2>Daftar</h2>
            <form id="register-submit">
              <div class="form-group">
                <label for="register-name">Nama:</label>
                <input type="text" id="register-name" required>
              </div>
              <div class="form-group">
                <label for="register-email">Email:</label>
                <input type="email" id="register-email" required>
              </div>
              <div class="form-group">
                <label for="register-password">Password:</label>
                <input type="password" id="register-password" required minlength="6">
              </div>
              <div class="form-group">
                <label for="register-nim">NIM:</label>
                <input type="text" id="register-nim" required pattern="[0-9]{10}" title="NIM harus 10 digit angka">
              </div>
              <div class="form-group">
                <label for="register-kelas">Kelas:</label>
                <select id="register-kelas" required>
                  <option value="">Pilih Kelas</option>
                  <option value="K1">K1</option>
                  <option value="K2">K2</option>
                  <option value="K3">K3</option>
                </select>
              </div>
              <div class="form-group">
                <label for="register-gender">Gender:</label>
                <select id="register-gender" required>
                  <option value="">Pilih Gender</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </div>
              <button type="submit">Daftar</button>
            </form>
            <p>Sudah punya akun? <a href="#" id="show-login">Login di sini</a></p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  bindEvents() {
    document.querySelector('.auth-close').onclick = () => {
      this.hideModal();
    };

    document.getElementById('show-register').onclick = (e) => {
      e.preventDefault();
      this.showRegisterForm();
    };

    document.getElementById('show-login').onclick = (e) => {
      e.preventDefault();
      this.showLoginForm();
    };

    document.getElementById('login-submit').onsubmit = async (e) => {
      e.preventDefault();
      await this.handleLogin();
    };

    document.getElementById('register-submit').onsubmit = async (e) => {
      e.preventDefault();
      await this.handleRegister();
    };

    document.getElementById('auth-modal').onclick = (e) => {
      if (e.target.id === 'auth-modal') {
        this.hideModal();
      }
    };
  }

  showModal() {
    document.getElementById('auth-modal').style.display = 'block';
  }

  hideModal() {
    document.getElementById('auth-modal').style.display = 'none';
  }

  showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
  }

  showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
  }

  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await this.authManager.login(email, password);
      this.hideModal();
      this.showMessage('Login berhasil!', 'success');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  async handleRegister() {
    const userData = {
      name: document.getElementById('register-name').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
      nim: document.getElementById('register-nim').value,
      kelas: document.getElementById('register-kelas').value,
      gender: document.getElementById('register-gender').value
    };

    try {
      await this.authManager.register(userData);
      this.hideModal();
      this.showMessage('Registrasi berhasil!', 'success');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message auth-message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}

const authUI = new AuthUI();

const authStyles = `
  .auth-modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
  }

  .auth-modal-content {
    background-color: #fff;
    margin: 5% auto;
    padding: 20px;
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    position: relative;
  }

  .auth-close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
  }

  .auth-close:hover {
    color: #000;
  }

  .auth-form h2 {
    margin-top: 0;
    text-align: center;
    color: var(--brand);
  }

  .form-group {
    margin-bottom: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .auth-form button {
    width: 100%;
    padding: 12px;
    background: var(--brand);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    margin-top: 10px;
  }

  .auth-form button:hover {
    background: var(--brand-600);
  }

  .auth-form p {
    text-align: center;
    margin-top: 15px;
  }

  .auth-form a {
    color: var(--brand);
    text-decoration: none;
  }

  .auth-form a:hover {
    text-decoration: underline;
  }

  .auth-message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 1001;
  }

  .auth-message-success {
    background-color: #10b981;
  }

  .auth-message-error {
    background-color: #ef4444;
  }

  [data-auth] {
    display: none;
  }

  [data-guest] {
    display: block;
  }

  [data-profile-complete] {
    display: none;
  }

  [data-profile-incomplete] {
    display: none;
  }


  .logout-btn {
    background: rgba(255,255,255,0.1) !important;
    border: 1px solid rgba(255,255,255,0.3);
  }

  .logout-btn:hover {
    background: rgba(255,255,255,0.2) !important;
  }

  .profile-warning {
    background: #fef3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    color: #856404;
  }

  .profile-warning h3 {
    margin: 0 0 8px 0;
    color: #856404;
  }

  .profile-warning p {
    margin: 0;
    font-size: 0.9em;
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = authStyles;
document.head.appendChild(styleSheet);

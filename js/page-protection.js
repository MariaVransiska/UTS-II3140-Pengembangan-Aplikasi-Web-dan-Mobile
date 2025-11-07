class PageProtection {
  constructor() {
    this.authManager = authManager;
    this.init();
  }

  init() {
    setTimeout(() => {
      this.checkPageAccess();
    }, 500);
  }

  checkPageAccess() {
    const currentPage = this.getCurrentPage();

    if (currentPage === 'index' || currentPage === 'profile') {
      return;
    }

    if (!this.authManager || typeof this.authManager.isAuthenticated !== 'function') {
      console.log('AuthManager not ready, retrying...');
      setTimeout(() => {
        this.checkPageAccess();
      }, 200);
      return;
    }

    const isAuthenticated = this.authManager.isAuthenticated();
    console.log('Page protection check:', { currentPage, isAuthenticated });
    
    if (!isAuthenticated) {
      this.redirectToLogin();
      return;
    }

    console.log('Page access granted for:', currentPage);
  }

  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename.replace('.html', '');
  }

  redirectToLogin() {
    const currentPage = this.getCurrentPage();
    
    const message = document.createElement('div');
    message.className = 'access-denied-message';
    message.innerHTML = `
      <div class="access-denied-content">
        <h2>🔒 Akses Ditolak</h2>
        <p>Anda harus login terlebih dahulu untuk mengakses halaman ini.</p>
        <button onclick="window.location.href='login.html'">Login / Daftar</button>
        <button onclick="window.location.href='index.html'">Kembali ke Home</button>
      </div>
    `;
    
    document.body.innerHTML = '';
    document.body.appendChild(message);
  }

  showProfileIncompleteMessage() {
    const currentPage = this.getCurrentPage();
    
    const message = document.createElement('div');
    message.className = 'access-denied-message';
    message.innerHTML = `
      <div class="access-denied-content">
        <h2>📝 Profil Belum Lengkap</h2>
        <p>Silakan lengkapi profil Anda terlebih dahulu untuk mengakses halaman ini.</p>
        <button onclick="window.location.href='profile.html'">Lengkapi Profil</button>
        <button onclick="window.location.href='index.html'">Kembali ke Home</button>
      </div>
    `;
    
    document.body.innerHTML = '';
    document.body.appendChild(message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const initPageProtection = () => {
    if (typeof authManager !== 'undefined' && authManager) {
      window.pageProtection = new PageProtection();
    } else {
      setTimeout(initPageProtection, 100);
    }
  };
  
  initPageProtection();
});

const protectionStyles = `
  .access-denied-message {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      to bottom,
      rgba(8,110,112,0.22) 0%,
      rgba(8,110,112,0.14) 4%,
      #ffffff 20%,
      #ffffff 30%,
      #fbfdfd 60%,
      #f3fbfb 68%,
      rgba(14,165,166,0.54) 96%,
      #0ea5a6 100%
    );
    padding: 20px;
  }

  .access-denied-content {
    background: white;
    padding: 40px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08);
    text-align: center;
    max-width: 400px;
    width: 100%;
  }

  .access-denied-content h2 {
    margin: 0 0 16px 0;
    color: var(--text);
  }

  .access-denied-content p {
    margin: 0 0 24px 0;
    color: var(--muted);
    line-height: 1.5;
  }

  .access-denied-content button {
    margin: 8px;
    padding: 12px 24px;
    background: var(--brand);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s ease;
  }

  .access-denied-content button:hover {
    background: var(--brand-600);
  }

  .access-denied-content button:last-child {
    background: #6b7280;
  }

  .access-denied-content button:last-child:hover {
    background: #4b5563;
  }
`;

const protectionStyleSheet = document.createElement('style');
protectionStyleSheet.textContent = protectionStyles;
document.head.appendChild(protectionStyleSheet);

class ProgressManager {
  constructor() {
    this.authManager = authManager;
    this.init();
  }

  init() {
    if (this.authManager.isAuthenticated()) {
      this.loadProgressOverview();
    }
  }

  async loadProgressOverview() {
    try {
      const response = await this.authManager.getUserProgress();
      if (response.success) {
        this.displayProgressOverview(response.data);
      }
    } catch (error) {
      console.error('Failed to load progress overview from server, using local data:', error);
      
      this.loadLocalProgressOverview();
    }
  }

  loadLocalProgressOverview() {
    try {
      const quizResults = JSON.parse(localStorage.getItem('localQuizResults') || '[]');
      const assignments = JSON.parse(localStorage.getItem('localAssignments') || '[]');
      const journalEntries = JSON.parse(localStorage.getItem('localJournalEntries') || '[]');
      
      const overview = {
        quiz: {
          totalAttempts: quizResults.length,
          averageScore: quizResults.length > 0 
            ? quizResults.reduce((sum, quiz) => sum + quiz.score, 0) / quizResults.length 
            : 0,
          lastAttempt: quizResults.length > 0 
            ? quizResults[quizResults.length - 1].completedAt 
            : null
        },
        assignments: {
          totalSubmitted: assignments.length,
          pending: assignments.filter(a => a.status === 'submitted').length,
          graded: assignments.filter(a => a.status === 'graded').length
        },
        journal: {
          totalEntries: journalEntries.length,
          lastEntry: journalEntries.length > 0 
            ? journalEntries[journalEntries.length - 1].createdAt 
            : null
        },
        materials: {
          totalViewed: 0,
          totalTimeSpent: 0
        },
        videos: {
          totalWatched: 0,
          averageCompletion: 0
        }
      };

      this.displayProgressOverview(overview);
    } catch (error) {
      console.error('Failed to load local progress overview:', error);
    }
  }

  displayProgressOverview(data) {
    const container = document.getElementById('progress-overview');
    if (!container) return;

    const overviewHTML = `
      <div class="progress-cards">
        <div class="progress-card">
          <h3>📝 Quiz</h3>
          <div class="progress-stats">
            <div class="stat">
              <span class="stat-value">${data.quiz.totalAttempts}</span>
              <span class="stat-label">Total Percobaan</span>
            </div>
            <div class="stat">
              <span class="stat-value">${Math.round(data.quiz.averageScore)}%</span>
              <span class="stat-label">Rata-rata Nilai</span>
            </div>
          </div>
        </div>

        <div class="progress-card">
          <h3>📋 Tugas</h3>
          <div class="progress-stats">
            <div class="stat">
              <span class="stat-value">${data.assignments.totalSubmitted}</span>
              <span class="stat-label">Total Dikirim</span>
            </div>
            <div class="stat">
              <span class="stat-value">${data.assignments.graded}</span>
              <span class="stat-label">Sudah Dinilai</span>
            </div>
          </div>
        </div>

        <div class="progress-card">
          <h3>📖 Jurnal</h3>
          <div class="progress-stats">
            <div class="stat">
              <span class="stat-value">${data.journal.totalEntries}</span>
              <span class="stat-label">Total Entri</span>
            </div>
            <div class="stat">
              <span class="stat-value">${data.materials.totalTimeSpent}</span>
              <span class="stat-label">Menit Belajar</span>
            </div>
          </div>
        </div>

        <div class="progress-card">
          <h3>🎥 Video</h3>
          <div class="progress-stats">
            <div class="stat">
              <span class="stat-value">${data.videos.totalWatched}</span>
              <span class="stat-label">Video Ditonton</span>
            </div>
            <div class="stat">
              <span class="stat-value">${Math.round(data.videos.averageCompletion)}%</span>
              <span class="stat-label">Rata-rata Selesai</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = overviewHTML;
  }

  trackMaterialView(materialId, title) {
    if (this.authManager.isAuthenticated()) {
      this.authManager.trackMaterialView({
        materialId,
        title,
        timeSpent: 5 // Default 5 minutes
      });
    }
  }

  trackVideoWatch(videoId, title, completionPercentage = 100) {
    if (this.authManager.isAuthenticated()) {
      this.authManager.trackVideoWatch({
        videoId,
        title,
        completionPercentage
      });
    }
  }
}

const progressManager = new ProgressManager();

const progressStyles = `
  .progress-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .progress-card {
    background: var(--card);
    border-radius: 12px;
    padding: 20px;
    box-shadow: var(--shadow);
    border: 1px solid #e5e7eb;
  }

  .progress-card h3 {
    margin: 0 0 16px 0;
    color: var(--text);
    font-size: 1.1em;
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .stat {
    text-align: center;
    flex: 1;
  }

  .stat-value {
    display: block;
    font-size: 1.5em;
    font-weight: 700;
    color: var(--brand);
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 0.85em;
    color: var(--muted);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .progress-cards {
      grid-template-columns: 1fr;
    }
    
    .progress-stats {
      flex-direction: column;
      gap: 8px;
    }
  }
`;

const progressStyleSheet = document.createElement('style');
progressStyleSheet.textContent = progressStyles;
document.head.appendChild(progressStyleSheet);

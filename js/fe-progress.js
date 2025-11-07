class ProgressManager {
  constructor() {
    this.apiBaseUrl = '/api';
    this.progress = this.loadProgress();
    this.statistics = this.loadStatistics();
    this.init();
  }

  init() {
    // Listen for progress loaded event dari login
    window.addEventListener('progressLoaded', (event) => {
      this.progress = event.detail.progress || this.loadProgress();
      this.statistics = event.detail.statistics || this.loadStatistics();
      this.updateUI();
    });
    
    // Initial UI update
    this.updateUI();
  }

  loadProgress() {
    const stored = localStorage.getItem('userProgress');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing progress:', error);
      }
    }
    
    return {
      quizScores: [],
      assignments: [],
      journalEntries: [],
      materialsViewed: [],
      videosWatched: []
    };
  }

  loadStatistics() {
    const stored = localStorage.getItem('userStatistics');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing statistics:', error);
      }
    }
    
    return {
      totalQuizAttempts: 0,
      averageQuizScore: 0,
      totalStudyTime: 0,
      streakDays: 0
    };
  }

  async saveQuizScore(score, maxScore) {
    const token = localStorage.getItem('authToken');
    
    try {
      // Try backend first
      const response = await fetch(`${this.apiBaseUrl}/progress/quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score, maxScore })
      });

      if (!response.ok) throw new Error('Backend save failed');
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // ✅ Update progress dengan data dari backend
        if (data.data.quizResult) {
          this.progress.quizScores = this.progress.quizScores || [];
          this.progress.quizScores.push(data.data.quizResult);
        }
        
        // ✅ Update statistics dari backend
        if (data.data.statistics) {
          this.statistics = data.data.statistics;
        }
        
        // ✅ Save to localStorage
        localStorage.setItem('userProgress', JSON.stringify(this.progress));
        localStorage.setItem('userStatistics', JSON.stringify(this.statistics));
        
        console.log('✅ Quiz saved to backend:', data.data);
        
        this.updateUI();
        return data;
      }
    } catch (error) {
      console.error('Save to backend failed, using localStorage:', error);
    }
    
    // Fallback: save locally
    const quizScore = {
      quizId: Date.now().toString(),
      score,
      maxScore,
      percentage: Math.round((score / maxScore) * 100),
      date: new Date().toISOString()
    };
    
    this.progress.quizScores.push(quizScore);
    
    // Update statistics
    this.statistics.totalQuizAttempts = this.progress.quizScores.length;
    this.statistics.averageQuizScore = this.calculateAverageScore();
    
    localStorage.setItem('userProgress', JSON.stringify(this.progress));
    localStorage.setItem('userStatistics', JSON.stringify(this.statistics));
    
    this.updateUI();
    
    return { 
      success: true, 
      message: 'Quiz score saved locally',
      data: { quizScore, statistics: this.statistics }
    };
  }

  async saveAssignment(title, fileName, fileData) {
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/progress/assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, fileName, fileData })
      });

      if (!response.ok) throw new Error('Backend save failed');
      
      const data = await response.json();
      
      if (data.success && data.data) {
        this.progress.assignments.push(data.data.assignment);
        localStorage.setItem('userProgress', JSON.stringify(this.progress));
        this.updateUI();
        return data;
      }
    } catch (error) {
      console.error('Save to backend failed, using localStorage:', error);
    }
    
    // Fallback: save locally
    const assignment = {
      assignmentId: Date.now().toString(),
      title,
      fileName,
      fileData,
      submittedAt: new Date().toISOString()
    };
    
    this.progress.assignments.push(assignment);
    localStorage.setItem('userProgress', JSON.stringify(this.progress));
    this.updateUI();
    
    return { 
      success: true,
      message: 'Assignment saved locally',
      data: { assignment }
    };
  }

  async saveJournalEntry(title, content) {
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/progress/journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content })
      });

      if (!response.ok) throw new Error('Backend save failed');
      
      const data = await response.json();
      
      if (data.success && data.data) {
        this.progress.journalEntries.push(data.data.entry);
        localStorage.setItem('userProgress', JSON.stringify(this.progress));
        this.updateUI();
        return data;
      }
    } catch (error) {
      console.error('Save to backend failed, using localStorage:', error);
    }
    
    // Fallback: save locally
    const entry = {
      entryId: Date.now().toString(),
      title,
      content,
      date: new Date().toISOString()
    };
    
    this.progress.journalEntries.push(entry);
    localStorage.setItem('userProgress', JSON.stringify(this.progress));
    this.updateUI();
    
    return { 
      success: true,
      message: 'Journal entry saved locally',
      data: { entry }
    };
  }

  async trackMaterialView(materialId, title = '') {
    const token = localStorage.getItem('authToken');
    
    // Check if already viewed
    if (this.progress.materialsViewed.includes(materialId)) {
      return;
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/progress/material-viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ materialId, title })
      });

      if (!response.ok) throw new Error('Backend save failed');
      
      const data = await response.json();
      
      if (data.success) {
        this.progress.materialsViewed.push(materialId);
        localStorage.setItem('userProgress', JSON.stringify(this.progress));
        this.updateUI();
        return data;
      }
    } catch (error) {
      console.error('Track material failed, using localStorage:', error);
    }
    
    // Fallback: save locally
    this.progress.materialsViewed.push(materialId);
    localStorage.setItem('userProgress', JSON.stringify(this.progress));
    this.updateUI();
    
    return { success: true, message: 'Material tracked locally' };
  }

  async trackVideoWatch(videoId, title = '') {
    const token = localStorage.getItem('authToken');
    
    // Check if already watched
    if (this.progress.videosWatched.includes(videoId)) {
      return;
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/progress/video-watched`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId, title })
      });

      if (!response.ok) throw new Error('Backend save failed');
      
      const data = await response.json();
      
      if (data.success) {
        this.progress.videosWatched.push(videoId);
        localStorage.setItem('userProgress', JSON.stringify(this.progress));
        this.updateUI();
        return data;
      }
    } catch (error) {
      console.error('Track video failed, using localStorage:', error);
    }
    
    // Fallback: save locally
    this.progress.videosWatched.push(videoId);
    localStorage.setItem('userProgress', JSON.stringify(this.progress));
    this.updateUI();
    
    return { success: true, message: 'Video tracked locally' };
  }

  getQuizScores() {
    return this.progress.quizScores || [];
  }

  getAssignments() {
    return this.progress.assignments || [];
  }

  getJournalEntries() {
    return this.progress.journalEntries || [];
  }

  getStatistics() {
    return this.statistics;
  }

  calculateAverageScore() {
    const scores = this.progress.quizScores || [];
    if (scores.length === 0) return 0;
    
    const total = scores.reduce((sum, quiz) => sum + (quiz.percentage || 0), 0);
    return Math.round(total / scores.length);
  }

  updateUI() {
    // Update dashboard if elements exist
    this.updateDashboard();
    this.updateQuizHistory();
  }

  updateDashboard() {
    const totalQuiz = document.getElementById('total-quiz');
    const avgScore = document.getElementById('average-score');
    const totalAssignments = document.getElementById('total-assignments');
    const totalJournals = document.getElementById('total-journals');
    
    if (totalQuiz) {
      totalQuiz.textContent = this.progress.quizScores?.length || 0;
    }
    
    if (avgScore) {
      const average = this.statistics.averageQuizScore || this.calculateAverageScore();
      avgScore.textContent = average + '%';  // ✅ Add % sign
    }
    
    if (totalAssignments) {
      totalAssignments.textContent = this.progress.assignments?.length || 0;
    }
    
    if (totalJournals) {
      totalJournals.textContent = this.progress.journalEntries?.length || 0;
    }
  }

  updateQuizHistory() {
    const quizList = document.getElementById('quiz-list');
    if (!quizList) return;
    
    const quizScores = this.getQuizScores();
    
    if (quizScores.length === 0) {
      quizList.innerHTML = '<p class="text-muted">Belum ada quiz yang dikerjakan.</p>';
      return;
    }
    
    // Sort by date, newest first
    const sorted = [...quizScores].sort((a, b) => {
      const dateA = new Date(a.completedAt || a.date);
      const dateB = new Date(b.completedAt || b.date);
      return dateB - dateA;
    });
    
    quizList.innerHTML = sorted.map((quiz, index) => {
      const score = quiz.score || 0;
      const maxScore = quiz.maxScore || 20;
      const percentage = quiz.percentage || Math.round((score / maxScore) * 100);
      const scoreColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
      const date = new Date(quiz.completedAt || quiz.date);
      
      return `
        <div class="quiz-item card mb-2 p-3">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">Quiz #${sorted.length - index}</h6>
              <p class="mb-0"><strong>Skor:</strong> ${score}/${maxScore} <span style="color: ${scoreColor}; font-weight: 600;">(${percentage}%)</span></p>
            </div>
            <div class="text-end">
              <small class="text-muted">${date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</small>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Global instance
window.progressManager = new ProgressManager();

const progressStyles = `
  .quiz-item {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .quiz-item:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }

  .text-muted {
    color: #6b7280;
  }

  .card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .mb-2 {
    margin-bottom: 0.5rem;
  }

  .p-3 {
    padding: 1rem;
  }

  .d-flex {
    display: flex;
  }

  .justify-content-between {
    justify-content: space-between;
  }

  .align-items-center {
    align-items: center;
  }

  .mb-1 {
    margin-bottom: 0.25rem;
  }

  .mb-0 {
    margin-bottom: 0;
  }

  .text-end {
    text-align: right;
  }

  @media (max-width: 640px) {
    .quiz-item .d-flex {
      flex-direction: column;
      gap: 8px;
    }
    
    .text-end {
      text-align: left;
    }
  }
`;

const progressStyleSheet = document.createElement('style');
progressStyleSheet.textContent = progressStyles;
document.head.appendChild(progressStyleSheet);

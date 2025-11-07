const bcrypt = require('bcryptjs');

// PostgreSQL User Model
class UserModel {
  constructor(db) {
    this.db = db;
    this.initTable();
  }

  async initTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nim VARCHAR(50) UNIQUE NOT NULL,
        kelas VARCHAR(50) NOT NULL,
        gender VARCHAR(20) NOT NULL,
        progress JSONB DEFAULT '{
          "quizScores": [],
          "assignments": [],
          "journalEntries": [],
          "materialsViewed": [],
          "videosWatched": []
        }'::jsonb,
        statistics JSONB DEFAULT '{
          "totalQuizAttempts": 0,
          "averageQuizScore": 0,
          "totalStudyTime": 0,
          "streakDays": 0
        }'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_nim ON users(nim);
    `;
    
    try {
      await this.db.query(createTableQuery);
    } catch (error) {
      console.error('Error creating users table:', error);
    }
  }

  async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const query = `
      INSERT INTO users (name, email, password, nim, kelas, gender, progress, statistics)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      userData.name,
      userData.email,
      hashedPassword,
      userData.nim,
      userData.kelas,
      userData.gender,
      JSON.stringify({
        quizScores: [],
        assignments: [],
        journalEntries: [],
        materialsViewed: [],
        videosWatched: []
      }),
      JSON.stringify({
        totalQuizAttempts: 0,
        averageQuizScore: 0,
        totalStudyTime: 0,
        streakDays: 0
      })
    ];
    
    const result = await this.db.query(query, values);
    return this.formatUser(result.rows[0]);
  }

  async findOne(query) {
    let whereClause = '';
    const values = [];
    let paramIndex = 1;

    if (query.email) {
      whereClause = `WHERE email = $${paramIndex}`;
      values.push(query.email);
      paramIndex++;
    } else if (query.nim) {
      whereClause = `WHERE nim = $${paramIndex}`;
      values.push(query.nim);
      paramIndex++;
    } else if (query._id || query.id) {
      whereClause = `WHERE id = $${paramIndex}`;
      values.push(query._id || query.id);
    }

    const sql = `SELECT * FROM users ${whereClause} LIMIT 1`;
    const result = await this.db.query(sql, values);
    
    if (result.rows.length === 0) return null;
    return this.formatUser(result.rows[0]);
  }

  async findById(id, options = {}) {
    const selectPassword = options && options.select && (
      options.select.includes('+password') || 
      options.select === '+password'
    );
    const selectClause = selectPassword ? '*' : 'id, name, email, nim, kelas, gender, progress, statistics, created_at, updated_at, last_login';
    
    const query = `SELECT ${selectClause} FROM users WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) return null;
    return this.formatUser(result.rows[0]);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (key === 'password') {
        // Password will be hashed separately
        return;
      }
      if (key === 'progress' || key === 'statistics') {
        updates.push(`${key} = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(updateData[key]));
      } else {
        updates.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
      }
      paramIndex++;
    });

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    if (result.rows.length === 0) return null;
    return this.formatUser(result.rows[0]);
  }

  async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const query = `
      UPDATE users 
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.db.query(query, [hashedPassword, id]);
    if (result.rows.length === 0) return null;
    return this.formatUser(result.rows[0]);
  }

  async comparePassword(user, candidatePassword) {
    return await bcrypt.compare(candidatePassword, user.password);
  }

  async updateLastLogin(id) {
    const query = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.formatUser(result.rows[0]);
  }

  formatUser(row) {
    if (!row) return null;
    
    const user = {
      _id: row.id.toString(),
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      password: row.password,
      nim: row.nim,
      kelas: row.kelas,
      gender: row.gender,
      progress: typeof row.progress === 'string' ? JSON.parse(row.progress) : row.progress,
      statistics: typeof row.statistics === 'string' ? JSON.parse(row.statistics) : row.statistics,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    };
    
    // Add methods
    user.save = async function() {
      const model = await getUserModel();
      return await model.findByIdAndUpdate(this.id, this);
    };
    
    user.comparePassword = async function(candidatePassword) {
      const model = await getUserModel();
      return await model.comparePassword(user, candidatePassword);
    };
    
    user.updateLastLogin = async function() {
      const model = await getUserModel();
      return await model.updateLastLogin(this.id);
    };
    
    return user;
  }
}

// Get user model instance
let userModelInstance = null;

const getUserModel = async () => {
  if (!userModelInstance) {
    const { getConnection } = require('../db');
    const db = await getConnection();
    userModelInstance = new UserModel(db);
  }
  return userModelInstance;
};

module.exports = { getUserModel, UserModel };

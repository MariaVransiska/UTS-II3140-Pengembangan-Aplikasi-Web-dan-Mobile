const bcrypt = require('bcryptjs');

// Supabase User Model
class UserModel {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const { data, error } = await this.supabase
      .from('users')
      .insert([{
        name: userData.name,
        email: userData.email,
        password_hash: hashedPassword,
        nim: userData.nim,
        kelas: userData.kelas,
        gender: userData.gender,
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
          streakDays: 0
        }
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email atau NIM sudah terdaftar');
      }
      throw error;
    }
    
    return this.formatUser(data);
  }

  async findOne(query) {
    let queryBuilder = this.supabase.from('users').select('*');

    if (query.email) {
      queryBuilder = queryBuilder.eq('email', query.email);
    } else if (query.nim) {
      queryBuilder = queryBuilder.eq('nim', query.nim);
    } else if (query._id || query.id) {
      queryBuilder = queryBuilder.eq('id', query._id || query.id);
    }

    const { data, error } = await queryBuilder.single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    return data ? this.formatUser(data) : null;
  }

  async findById(id, options = {}) {
    const selectPassword = options && options.select && (
      options.select.includes('+password') || 
      options.select === '+password'
    );
    
    const selectClause = selectPassword ? '*' : 'id, name, email, nim, kelas, gender, progress, statistics, created_at, updated_at, last_login';
    
    const { data, error } = await this.supabase
      .from('users')
      .select(selectClause)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data ? this.formatUser(data) : null;
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const updates = {};

    Object.keys(updateData).forEach(key => {
      if (key === 'password') {
        // Password will be hashed separately
        return;
      }
      updates[key] = updateData[key];
    });

    console.log(' UserModel.findByIdAndUpdate called');
    console.log('   User ID:', id);
    console.log('   Updates:', updates);

    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase update error:', error);
      throw error;
    }
    
    console.log('✅ Supabase update success:', data);
    return data ? this.formatUser(data) : null;
  }

  async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const { data, error } = await this.supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data ? this.formatUser(data) : null;
  }

  async comparePassword(user, candidatePassword) {
    const passwordToCompare = user.password_hash || user.password;
    return await bcrypt.compare(candidatePassword, passwordToCompare);
  }

  async updateLastLogin(id) {
    const { data, error } = await this.supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data ? this.formatUser(data) : null;
  }

  formatUser(row) {
    if (!row) return null;
    
    const user = {
      _id: row.id.toString(),
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      password: row.password_hash || row.password, // Support both field names
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
    const { connectToDatabase } = require('../db');
    const supabase = await connectToDatabase();
    userModelInstance = new UserModel(supabase);
  }
  return userModelInstance;
};

module.exports = { getUserModel, UserModel };

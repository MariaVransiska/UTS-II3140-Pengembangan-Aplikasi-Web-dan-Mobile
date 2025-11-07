// Helper functions for progress operations that work with both MongoDB and PostgreSQL
const { getDbType } = require('../db');
const { getUserModel } = require('../models/user');

// Update progress array in user
async function updateProgressArray(userId, arrayPath, newItem, dbType, db) {
  if (dbType === 'postgres') {
    // For PostgreSQL, use JSONB operations
    const pathParts = arrayPath.split('.');
    const arrayName = pathParts[pathParts.length - 1];
    
    // Get current progress
    const result = await db.query('SELECT progress FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User tidak ditemukan');
    }
    
    let progress = typeof result.rows[0].progress === 'string' 
      ? JSON.parse(result.rows[0].progress) 
      : result.rows[0].progress;
    
    // Update the array
    if (!progress[arrayName]) {
      progress[arrayName] = [];
    }
    progress[arrayName].push(newItem);
    
    // Update in database
    await db.query(
      'UPDATE users SET progress = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(progress), userId]
    );
    
    return newItem;
  } else {
    // MongoDB - use Mongoose
    const User = await getUserModel();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }
    
    const pathParts = arrayPath.split('.');
    let target = user;
    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }
    target[pathParts[pathParts.length - 1]].push(newItem);
    await user.save();
    
    return newItem;
  }
}

// Update statistics
async function updateStatistics(userId, updates, dbType, db) {
  if (dbType === 'postgres') {
    const result = await db.query('SELECT statistics FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User tidak ditemukan');
    }
    
    let statistics = typeof result.rows[0].statistics === 'string'
      ? JSON.parse(result.rows[0].statistics)
      : result.rows[0].statistics;
    
    Object.assign(statistics, updates);
    
    await db.query(
      'UPDATE users SET statistics = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(statistics), userId]
    );
  } else {
    const User = await getUserModel();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }
    
    Object.assign(user.statistics, updates);
    await user.save();
  }
}

// Find and update item in array
async function updateArrayItem(userId, arrayPath, itemId, updates, dbType, db) {
  if (dbType === 'postgres') {
    const pathParts = arrayPath.split('.');
    const arrayName = pathParts[pathParts.length - 1];
    
    const result = await db.query('SELECT progress FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User tidak ditemukan');
    }
    
    let progress = typeof result.rows[0].progress === 'string'
      ? JSON.parse(result.rows[0].progress)
      : result.rows[0].progress;
    
    const array = progress[arrayName] || [];
    const itemIndex = array.findIndex(item => {
      const idField = arrayName === 'quizScores' ? 'quizId' :
                     arrayName === 'assignments' ? 'assignmentId' :
                     arrayName === 'journalEntries' ? 'entryId' :
                     arrayName === 'materialsViewed' ? 'materialId' :
                     'videoId';
      return item[idField] === itemId;
    });
    
    if (itemIndex === -1) {
      throw new Error('Item tidak ditemukan');
    }
    
    Object.assign(array[itemIndex], updates);
    progress[arrayName] = array;
    
    await db.query(
      'UPDATE users SET progress = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(progress), userId]
    );
    
    return array[itemIndex];
  } else {
    const User = await getUserModel();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }
    
    const pathParts = arrayPath.split('.');
    let target = user;
    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }
    const array = target[pathParts[pathParts.length - 1]];
    
    const idField = arrayPath.includes('quizScores') ? 'quizId' :
                   arrayPath.includes('assignments') ? 'assignmentId' :
                   arrayPath.includes('journalEntries') ? 'entryId' :
                   arrayPath.includes('materialsViewed') ? 'materialId' :
                   'videoId';
    
    const item = array.id ? array.id(itemId) : array.find(item => item[idField] === itemId);
    if (!item) {
      throw new Error('Item tidak ditemukan');
    }
    
    Object.assign(item, updates);
    await user.save();
    
    return item;
  }
}

// Delete item from array
async function deleteArrayItem(userId, arrayPath, itemId, dbType, db) {
  if (dbType === 'postgres') {
    const pathParts = arrayPath.split('.');
    const arrayName = pathParts[pathParts.length - 1];
    
    const result = await db.query('SELECT progress FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User tidak ditemukan');
    }
    
    let progress = typeof result.rows[0].progress === 'string'
      ? JSON.parse(result.rows[0].progress)
      : result.rows[0].progress;
    
    const array = progress[arrayName] || [];
    const idField = arrayName === 'quizScores' ? 'quizId' :
                   arrayName === 'assignments' ? 'assignmentId' :
                   arrayName === 'journalEntries' ? 'entryId' :
                   arrayName === 'materialsViewed' ? 'materialId' :
                   'videoId';
    
    progress[arrayName] = array.filter(item => item[idField] !== itemId);
    
    await db.query(
      'UPDATE users SET progress = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(progress), userId]
    );
  } else {
    const User = await getUserModel();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }
    
    const pathParts = arrayPath.split('.');
    let target = user;
    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }
    const array = target[pathParts[pathParts.length - 1]];
    
    const item = array.id ? array.id(itemId) : null;
    if (item) {
      item.remove();
    } else {
      const idField = arrayPath.includes('quizScores') ? 'quizId' :
                     arrayPath.includes('assignments') ? 'assignmentId' :
                     arrayPath.includes('journalEntries') ? 'entryId' :
                     arrayPath.includes('materialsViewed') ? 'materialId' :
                     'videoId';
      const index = array.findIndex(item => item[idField] === itemId);
      if (index !== -1) {
        array.splice(index, 1);
      }
    }
    
    await user.save();
  }
}

module.exports = {
  updateProgressArray,
  updateStatistics,
  updateArrayItem,
  deleteArrayItem
};


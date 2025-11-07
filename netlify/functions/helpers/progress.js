// Helper functions for progress operations with PostgreSQL
const { getConnection } = require('../db');
const { getUserModel } = require('../models/user');

// Update progress array in user
async function updateProgressArray(userId, arrayPath, newItem) {
  const db = await getConnection();
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
}

// Update statistics
async function updateStatistics(userId, updates) {
  const db = await getConnection();
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
}

// Find and update item in array
async function updateArrayItem(userId, arrayPath, itemId, updates) {
  const db = await getConnection();
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
}

// Delete item from array
async function deleteArrayItem(userId, arrayPath, itemId) {
  const db = await getConnection();
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
}

module.exports = {
  updateProgressArray,
  updateStatistics,
  updateArrayItem,
  deleteArrayItem
};


// Helper functions for progress operations with Supabase (PostgreSQL)
const { connectToDatabase, getDbType } = require('./index');
const { getUserModel } = require('../models/user');

// Update progress array in user
async function updateProgressArray(userId, arrayPath, newItem, dbType, db) {
  const supabase = await connectToDatabase();
  const pathParts = arrayPath.split('.');
  const arrayName = pathParts[pathParts.length - 1];
  
  // Get current user
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('progress')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    throw new Error('User tidak ditemukan');
  }
  
  // Parse progress (might be string or object)
  let progress = typeof user.progress === 'string' 
    ? JSON.parse(user.progress) 
    : user.progress;
  
  // Initialize array if not exists
  if (!progress[arrayName]) {
    progress[arrayName] = [];
  }
  
  // Add new item
  progress[arrayName].push(newItem);
  
  // Update in database
  const { data, error } = await supabase
    .from('users')
    .update({ progress })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  
  return newItem;
}

// Update statistics
async function updateStatistics(userId, updates, dbType, db) {
  const supabase = await connectToDatabase();
  
  // Get current statistics
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('statistics')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    throw new Error('User tidak ditemukan');
  }
  
  let statistics = typeof user.statistics === 'string'
    ? JSON.parse(user.statistics)
    : user.statistics;
  
  // Merge updates
  Object.assign(statistics, updates);
  
  // Update in database
  const { error } = await supabase
    .from('users')
    .update({ statistics })
    .eq('id', userId);
  
  if (error) throw error;
}

// Find and update item in array
async function updateArrayItem(userId, arrayPath, itemId, updates, dbType, db) {
  const supabase = await connectToDatabase();
  const pathParts = arrayPath.split('.');
  const arrayName = pathParts[pathParts.length - 1];
  
  // Get current progress
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('progress')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    throw new Error('User tidak ditemukan');
  }
  
  let progress = typeof user.progress === 'string'
    ? JSON.parse(user.progress)
    : user.progress;
  
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
  
  // Update in database
  const { data, error } = await supabase
    .from('users')
    .update({ progress })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  
  return array[itemIndex];
}

// Delete item from array
async function deleteArrayItem(userId, arrayPath, itemId, dbType, db) {
  const supabase = await connectToDatabase();
  const pathParts = arrayPath.split('.');
  const arrayName = pathParts[pathParts.length - 1];
  
  // Get current progress
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('progress')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    throw new Error('User tidak ditemukan');
  }
  
  let progress = typeof user.progress === 'string'
    ? JSON.parse(user.progress)
    : user.progress;
  
  const array = progress[arrayName] || [];
  const idField = arrayName === 'quizScores' ? 'quizId' :
                 arrayName === 'assignments' ? 'assignmentId' :
                 arrayName === 'journalEntries' ? 'entryId' :
                 arrayName === 'materialsViewed' ? 'materialId' :
                 'videoId';
  
  progress[arrayName] = array.filter(item => item[idField] !== itemId);
  
  // Update in database
  const { error } = await supabase
    .from('users')
    .update({ progress })
    .eq('id', userId);
  
  if (error) throw error;
}

module.exports = {
  updateProgressArray,
  updateStatistics,
  updateArrayItem,
  deleteArrayItem
};


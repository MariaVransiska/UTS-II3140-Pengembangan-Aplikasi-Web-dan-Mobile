const jwt = require('jsonwebtoken');
const { connectToDatabase, getDbType } = require('./db/index');
const { getUserModel } = require('./models/user');
const { updateProgressArray, updateStatistics, updateArrayItem, deleteArrayItem } = require('./db/progress');

const authenticateToken = (event) => {
  const token = event.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token tidak ditemukan');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (error) {
    throw new Error('Token tidak valid');
  }
};

exports.handler = async (event, context) => {
  // Connect to Supabase
  const supabase = await connectToDatabase();
  
  const { httpMethod, path, body } = event;
  
  // Clean path (remove function prefix if present)
  let cleanPath = path || '';
  cleanPath = cleanPath.replace('/.netlify/functions/server', '');
  cleanPath = cleanPath.replace('/api/progress', '');
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Parse body if present
  let data = {};
  if (body) {
    try {
      data = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      // Body might already be parsed
      data = body;
    }
  }
  
  try {
    switch (httpMethod) {
      case 'POST':
        if (cleanPath.endsWith('/quiz') || cleanPath === '/quiz') {
          return await handleSaveQuizResults(data, event);
        } else if (cleanPath.endsWith('/assignment') || cleanPath === '/assignment') {
          return await handleSaveAssignment(data, event);
        } else if (cleanPath.endsWith('/journal') || cleanPath === '/journal') {
          return await handleSaveJournalEntry(data, event);
        } else if (cleanPath.endsWith('/material-viewed') || cleanPath === '/material-viewed') {
          return await handleMaterialViewed(data, event);
        } else if (cleanPath.endsWith('/video-watched') || cleanPath === '/video-watched') {
          return await handleVideoWatched(data, event);
        }
        break;
      case 'GET':
        if (cleanPath.endsWith('/overview') || cleanPath === '/overview') {
          return await handleGetProgressOverview(event);
        } else if (cleanPath.endsWith('/quiz') || cleanPath === '/quiz') {
          return await handleGetQuizHistory(event);
        } else if (cleanPath.endsWith('/assignment') || cleanPath === '/assignment') {
          return await handleGetAssignments(event);
        } else if (cleanPath.endsWith('/journal') || cleanPath === '/journal') {
          return await handleGetJournalEntries(event);
        }
        break;
      case 'PUT':
        if (cleanPath.includes('/journal/')) {
          const entryId = cleanPath.split('/journal/')[1];
          data.entryId = entryId;
          return await handleUpdateJournalEntry(data, event);
        } else if (cleanPath.includes('/assignment/')) {
          const assignmentId = cleanPath.split('/assignment/')[1];
          data.assignmentId = assignmentId;
          return await handleUpdateAssignment(data, event);
        }
        break;
      case 'DELETE':
        if (cleanPath.includes('/journal/')) {
          const entryId = cleanPath.split('/journal/')[1];
          data.entryId = entryId;
          return await handleDeleteJournalEntry(data, event);
        } else if (cleanPath.includes('/assignment/')) {
          const assignmentId = cleanPath.split('/assignment/')[1];
          data.assignmentId = assignmentId;
          return await handleDeleteAssignment(data, event);
        }
        break;
      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
          },
          body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    // If no route matched
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Endpoint not found', path: cleanPath })
    };
  } catch (error) {
    console.error('Progress handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error' })
    };
  }
};

async function handleSaveQuizResults(data, event) {
  const userId = authenticateToken(event);
  const { quizId, score, maxScore, answers, completedAt } = data;
  
  // Default maxScore to 20 if not provided
  const totalQuestions = maxScore || 20;
  
  // Calculate percentage
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  const quizResult = {
    quizId: quizId || 'main-quiz',
    score,
    maxScore: totalQuestions,
    percentage,
    answers: answers || [],
    completedAt: completedAt ? new Date(completedAt) : new Date()
  };
  
  // Add quiz result
  await updateProgressArray(userId, 'progress.quizScores', quizResult);
  
  // Update statistics
  const User = await getUserModel();
  const user = await User.findById(userId);
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
    };
  }
  
  const quizScores = user.progress.quizScores || [];
  
  // ✅ Calculate average based on PERCENTAGE, not raw score
  const totalPercentage = quizScores.reduce((sum, quiz) => {
    const quizPercentage = quiz.percentage || 
      (quiz.maxScore ? Math.round((quiz.score / quiz.maxScore) * 100) : 0);
    return sum + quizPercentage;
  }, 0);
  
  const averageScore = quizScores.length > 0 ? Math.round(totalPercentage / quizScores.length) : 0;
  
  const updatedStatistics = {
    totalQuizAttempts: quizScores.length,
    averageQuizScore: averageScore
  };
  
  await updateStatistics(userId, updatedStatistics);
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Hasil quiz berhasil disimpan',
      data: { 
        quizResult,
        statistics: updatedStatistics,
        progress: {
          quizScores: quizScores
        }
      }
    })
  };
}

async function handleSaveAssignment(data, event) {
  const userId = authenticateToken(event);
  const { assignmentId, title, files, status } = data;
  
  const assignment = {
    assignmentId: assignmentId || `assignment_${Date.now()}`,
    title: title || 'Tugas Tanpa Judul',
    files: files || [],
    status: status || 'submitted',
    submittedAt: new Date()
  };
  
  await updateProgressArray(userId, 'progress.assignments', assignment);
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Tugas berhasil disimpan',
      data: { assignment }
    })
  };
}

async function handleSaveJournalEntry(data, event) {
  const userId = authenticateToken(event);
  const { entryId, content, tags } = data;
  
  const journalEntry = {
    entryId: entryId || `entry_${Date.now()}`,
    content: content || '',
    tags: tags || [],
    createdAt: new Date()
  };
  
  await updateProgressArray(userId, 'progress.journalEntries', journalEntry);
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Jurnal berhasil disimpan',
      data: { journalEntry }
    })
  };
}

async function handleMaterialViewed(data, event) {
  const userId = authenticateToken(event);
  const { materialId, title, timeSpent } = data;
  
  const material = {
    materialId: materialId || `material_${Date.now()}`,
    title: title || 'Materi Tanpa Judul',
    timeSpent: timeSpent || 0,
    viewedAt: new Date()
  };
  
  await updateProgressArray(userId, 'progress.materialsViewed', material);
  
  // Update total study time
  const User = await getUserModel();
  const user = await User.findById(userId);
  if (user) {
    const currentTime = user.statistics.totalStudyTime || 0;
    await updateStatistics(userId, {
      totalStudyTime: currentTime + (timeSpent || 0)
    });
  }
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Progress materi berhasil disimpan',
      data: { material }
    })
  };
}

async function handleVideoWatched(data, event) {
  const userId = authenticateToken(event);
  const { videoId, title, completionPercentage } = data;
  
  const video = {
    videoId: videoId || `video_${Date.now()}`,
    title: title || 'Video Tanpa Judul',
    completionPercentage: completionPercentage || 0,
    watchedAt: new Date()
  };
  
  await updateProgressArray(userId, 'progress.videosWatched', video);
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Progress video berhasil disimpan',
      data: { video }
    })
  };
}

async function handleGetProgressOverview(event) {
  const userId = authenticateToken(event);
  
  const User = await getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      data: {
        progress: user.progress,
        statistics: user.statistics
      }
    })
  };
}

async function handleGetQuizHistory(event) {
  const userId = authenticateToken(event);
  
  const User = await getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      data: {
        quizScores: user.progress.quizScores || []
      }
    })
  };
}

async function handleGetAssignments(event) {
  const userId = authenticateToken(event);
  
  const User = await getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      data: {
        assignments: user.progress.assignments || []
      }
    })
  };
}

async function handleGetJournalEntries(event) {
  const userId = authenticateToken(event);
  
  const User = await getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      data: {
        journalEntries: user.progress.journalEntries || []
      }
    })
  };
}

async function handleUpdateAssignment(data, event) {
  const userId = authenticateToken(event);
  const { assignmentId, title, files, status } = data;
  
  const updates = {};
  if (title) updates.title = title;
  if (files) updates.files = files;
  if (status) updates.status = status;
  
  try {
    const assignment = await updateArrayItem(userId, 'progress.assignments', assignmentId, updates);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Assignment berhasil diperbarui',
        data: { assignment }
      })
    };
  } catch (error) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Assignment tidak ditemukan' })
    };
  }
}

async function handleUpdateJournalEntry(data, event) {
  const userId = authenticateToken(event);
  const { entryId, content, tags } = data;
  
  const updates = {};
  if (content) updates.content = content;
  if (tags) updates.tags = tags;
  
  try {
    const journalEntry = await updateArrayItem(userId, 'progress.journalEntries', entryId, updates);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Journal entry berhasil diperbarui',
        data: { journalEntry }
      })
    };
  } catch (error) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Journal entry tidak ditemukan' })
    };
  }
}

async function handleDeleteAssignment(data, event) {
  const userId = authenticateToken(event);
  const { assignmentId } = data;
  
  try {
    await deleteArrayItem(userId, 'progress.assignments', assignmentId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Assignment berhasil dihapus'
      })
    };
  } catch (error) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Assignment tidak ditemukan' })
    };
  }
}

async function handleDeleteJournalEntry(data, event) {
  const userId = authenticateToken(event);
  const { entryId } = data;
  
  try {
    await deleteArrayItem(userId, 'progress.journalEntries', entryId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Journal entry berhasil dihapus'
      })
    };
  } catch (error) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Journal entry tidak ditemukan' })
    };
  }
}

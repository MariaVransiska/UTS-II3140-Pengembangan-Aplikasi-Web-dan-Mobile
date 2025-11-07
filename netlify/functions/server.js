// Main server function for Netlify Functions
exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // Get path from event
  // Netlify Functions path format: /.netlify/functions/server/api/auth/register
  const path = event.path || event.rawPath || '';
  
  // Remove function prefix if present
  let cleanPath = path.replace('/.netlify/functions/server', '');
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Route to appropriate handler
  if (cleanPath.startsWith('/api/auth')) {
    const authHandler = require('./auth');
    return await authHandler.handler(event, context);
  } else if (cleanPath.startsWith('/api/progress')) {
    const progressHandler = require('./progress');
    return await progressHandler.handler(event, context);
  } else if (cleanPath === '/health' || cleanPath === '/api/health') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Virtual Lab API',
        version: '1.0.0'
      })
    };
  } else {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Endpoint not found',
        path: cleanPath,
        availableEndpoints: [
          '/api/auth/register',
          '/api/auth/login',
          '/api/auth/me',
          '/api/auth/profile',
          '/api/auth/password',
          '/api/auth/logout',
          '/api/progress/quiz',
          '/api/progress/assignment',
          '/api/progress/journal',
          '/api/progress/material-viewed',
          '/api/progress/video-watched',
          '/api/progress/overview',
          '/health'
        ]
      })
    };
  }
};

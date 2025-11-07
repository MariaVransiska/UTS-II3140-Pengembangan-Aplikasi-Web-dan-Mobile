// Main server function for Netlify Functions
exports.handler = async (event, context) => {
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

  const path = event.path || event.rawPath || '';
  let cleanPath = path.replace('/.netlify/functions/server', '');
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

  const authHandler = require('./auth');
  const progressHandler = require('./progress');




  if (cleanPath.startsWith('/api/auth')) {
    return await authHandler.handler(event, context);
  }
  if (cleanPath.startsWith('/api/progress')) {
    return await progressHandler.handler(event, context);
  }

  if (cleanPath === '/health' || cleanPath === '/api/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }),
    };
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, message: 'Endpoint not found', path: cleanPath }),
  };
};

// PostgreSQL database connection
const { Pool } = require('pg');

let connection = null;

// Initialize PostgreSQL connection
const connectDB = async () => {
  if (!connection) {
    connection = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : false,
    });
    
    // Test connection
    try {
      await connection.query('SELECT NOW()');
      console.log('PostgreSQL connected');
    } catch (error) {
      console.error('PostgreSQL connection error:', error);
      throw error;
    }
  }
  
  return connection;
};

// Get connection
const getConnection = async () => {
  if (!connection) {
    await connectDB();
  }
  return connection;
};

module.exports = {
  connectDB,
  getConnection,
  connection
};

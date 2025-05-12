const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration for connection pool
const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'employee_management',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 30, // Close connections after 30 seconds of inactivity
  connect_timeout: 10, // Give up connecting after 10 seconds
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Use connection string if provided
if (process.env.POSTGRES_URL) {
  console.log('Using POSTGRES_URL for database connection');
}

// Create SQL connection with error handling and retry logic
const createSqlConnection = () => {
  try {
    const sql = process.env.POSTGRES_URL
      ? postgres(process.env.POSTGRES_URL, { ssl: { rejectUnauthorized: false } })
      : postgres(connectionConfig);

    console.log('Database connection pool initialized');
    return sql;
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  }
};

// Initialize connection
const sql = createSqlConnection();

// Test the connection
const testConnection = async () => {
  try {
    const result = await sql`SELECT 1 as connection_test`;
    console.log('Database connection successful:', result[0].connection_test === 1 ? 'OK' : 'FAILED');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    console.log('Retrying database connection in 5 seconds...');
    setTimeout(testConnection, 5000); // Retry after 5 seconds
    return false;
  }
};

// Perform connection test on startup
testConnection();

// Schedule periodic health checks
setInterval(async () => {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('Attempting to reconnect to database...');
    // In a production environment, you might want to implement more sophisticated
    // reconnection logic here or use a connection manager library
  }
}, 60000); // Check every minute

module.exports = {
  sql,
  testConnection, // Export the testConnection function
};

const postgres = require("postgres")
const fs = require("fs")
const path = require("path")

// Load environment variables
require("dotenv").config()

// Log database connection details (without sensitive info)
console.log("Database connection details:")
console.log(`- Host: ${process.env.DB_HOST || "localhost"}`)
console.log(`- Database: ${process.env.DB_NAME || "employee_management"}`)
console.log(`- SSL: ${process.env.DB_SSL === "true" ? "enabled" : "disabled"}`)
console.log(`- Using connection URL: ${process.env.POSTGRES_URL ? "yes" : "no"}`)

// Configuration for connection pool
const connectionConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "employee_management",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 10, // Reduced from 20 to 10 for better stability
  idle_timeout: 30, // Close connections after 30 seconds of inactivity
  connect_timeout: 30, // Increased from 10 to 30 seconds
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
}

// Create SQL connection with error handling and retry logic
const createSqlConnection = () => {
  try {
    let sql

    if (process.env.POSTGRES_URL) {
      console.log("Using POSTGRES_URL for database connection")
      sql = postgres(process.env.POSTGRES_URL, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 30,
        connect_timeout: 30,
        debug: process.env.NODE_ENV !== "production",
      })
    } else {
      console.log("Using individual connection parameters")
      sql = postgres(connectionConfig)
    }

    console.log("Database connection pool initialized")
    return sql
  } catch (error) {
    console.error("Failed to initialize database connection:", error)

    // Don't exit in development mode
    if (process.env.NODE_ENV === "production") {
      process.exit(1)
    } else {
      console.error("Running in development mode - continuing with limited functionality")
      // Return a mock SQL object that logs errors instead of crashing
      return {
        async query() {
          console.error("Database not connected - query failed")
          return []
        },
        async end() {
          console.log("Mock SQL connection ended")
        },
      }
    }
  }
}

// Initialize connection
const sql = createSqlConnection()

// Test the connection
const testConnection = async () => {
  try {
    console.log("Testing database connection...")
    const result = await sql`SELECT 1 as connection_test`
    console.log("Database connection successful:", result[0].connection_test === 1 ? "OK" : "FAILED")
    return true
  } catch (error) {
    console.error("Database connection test failed:", error)
    console.log("Retrying database connection in 5 seconds...")

    // Only retry in production
    if (process.env.NODE_ENV === "production") {
      setTimeout(testConnection, 5000) // Retry after 5 seconds
    }
    return false
  }
}

// Export the pool for session store
const pool = {
  query: (text, params) => {
    return sql.unsafe(text, params)
  },
}

module.exports = {
  sql,
  pool,
  testConnection,
}

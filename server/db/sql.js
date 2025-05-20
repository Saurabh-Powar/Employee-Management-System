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
console.log(`- Environment: ${process.env.NODE_ENV || "development"}`)
console.log(`- Mock data: ${process.env.USE_MOCK_DATA === "true" ? "enabled" : "disabled"}`)

// Maximum number of connection attempts
const MAX_RETRIES = 5
// Delay between retries in milliseconds (starting with 2 seconds)
const INITIAL_RETRY_DELAY = 2000
let retryCount = 0
let sql = null

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
  // Add connection error handling
  onnotice: (notice) => console.log("Database notice:", notice),
  onparameter: (parameter) => console.log("Database parameter:", parameter),
  debug: process.env.NODE_ENV !== "production",
  connection: {
    application_name: "employee_management_system",
  },
  types: {
    // Add custom type parsers if needed
  },
}

// Create a mock SQL object for when the database is unavailable
const createMockSql = () => {
  console.log("Creating mock SQL interface for development")

  // In-memory storage for mock data
  const mockData = {
    users: [
      { id: 1, email: "admin@example.com", password: "$2b$10$mockhashedpassword", role: "admin" },
      { id: 2, email: "manager@example.com", password: "$2b$10$mockhashedpassword", role: "manager" },
      { id: 3, email: "employee1@example.com", password: "$2b$10$mockhashedpassword", role: "employee" },
    ],
    employees: [
      { id: 1, user_id: 1, first_name: "Admin", last_name: "User", position: "System Administrator", department: "IT" },
      {
        id: 2,
        user_id: 2,
        first_name: "Manager",
        last_name: "User",
        position: "Department Manager",
        department: "Operations",
        manager_id: 1,
      },
      {
        id: 3,
        user_id: 3,
        first_name: "John",
        last_name: "Doe",
        position: "Software Developer",
        department: "Engineering",
        manager_id: 2,
      },
    ],
    attendance: [],
    leaves: [],
    tasks: [],
    salaries: [],
    shifts: [],
    notifications: [],
  }

  // Helper to simulate SQL query execution
  const mockQuery = (strings, ...values) => {
    const query = strings.join("?")
    console.log(`MOCK SQL: ${query}`, values)

    // Very basic query parser for development mode
    if (query.includes("SELECT") && query.includes("FROM users")) {
      if (query.includes("WHERE")) {
        const emailIndex = values.findIndex((v) => typeof v === "string" && v.includes("@"))
        if (emailIndex !== -1) {
          const email = values[emailIndex]
          return mockData.users.filter((u) => u.email === email)
        }
      }
      return mockData.users
    }

    if (query.includes("SELECT") && query.includes("FROM employees")) {
      return mockData.employees
    }

    // Default return empty array
    return []
  }

  // Create a mock SQL interface
  const mockSql = (...args) => mockQuery(...args)

  // Add methods that might be called
  mockSql.unsafe = (text, params) => {
    console.log(`MOCK SQL UNSAFE: ${text}`, params)
    return { rows: [] }
  }

  mockSql.begin = async (callback) => {
    console.log("MOCK SQL BEGIN TRANSACTION")
    try {
      await callback(mockSql)
      console.log("MOCK SQL COMMIT")
    } catch (error) {
      console.log("MOCK SQL ROLLBACK", error)
      throw error
    }
  }

  mockSql.end = async () => {
    console.log("MOCK SQL CONNECTION ENDED")
    return true
  }

  return mockSql
}

// Create SQL connection with error handling and retry logic
const createSqlConnection = (retry = false) => {
  // If we're in development mode and using mock data, return a mock SQL interface
  if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true") {
    console.log("Using mock database in development mode")
    return createMockSql()
  }

  try {
    if (retry) {
      console.log(`Retrying database connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`)
    }

    if (process.env.POSTGRES_URL) {
      console.log("Using POSTGRES_URL for database connection")
      return postgres(process.env.POSTGRES_URL, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 30,
        connect_timeout: 30,
        debug: process.env.NODE_ENV !== "production",
        onnotice: (notice) => console.log("Database notice:", notice),
        onparameter: (parameter) => console.log("Database parameter:", parameter),
        connection: {
          application_name: "employee_management_system",
        },
      })
    } else {
      console.log("Using individual connection parameters")
      return postgres(connectionConfig)
    }
  } catch (error) {
    console.error("Failed to initialize database connection:", error)

    if (retryCount < MAX_RETRIES) {
      retryCount++
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1) // Exponential backoff
      console.log(`Will retry in ${retryDelay / 1000} seconds...`)

      setTimeout(() => {
        sql = createSqlConnection(true)
      }, retryDelay)

      // Return a temporary mock SQL object until the retry succeeds
      return createMockSql()
    }

    // Don't exit in development mode
    if (process.env.NODE_ENV === "production") {
      console.error("Maximum retry attempts reached. Exiting...")
      process.exit(1)
    } else {
      console.error("Running in development mode - continuing with limited functionality")
      return createMockSql()
    }
  }
}

// Initialize connection
sql = createSqlConnection()

// Test the connection
const testConnection = async () => {
  // If we're in development mode and using mock data, return true
  if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true") {
    console.log("Using mock database - skipping connection test")
    return true
  }

  try {
    console.log("Testing database connection...")
    const result = await sql`SELECT 1 as connection_test`
    console.log("Database connection successful:", result[0].connection_test === 1 ? "OK" : "FAILED")
    return true
  } catch (error) {
    console.error("Database connection test failed:", error)

    if (retryCount < MAX_RETRIES) {
      retryCount++
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1) // Exponential backoff
      console.log(`Will retry in ${retryDelay / 1000} seconds...`)

      return new Promise((resolve) => {
        setTimeout(async () => {
          sql = createSqlConnection(true)
          resolve(await testConnection())
        }, retryDelay)
      })
    }

    console.error("Maximum retry attempts reached.")

    if (process.env.NODE_ENV === "production") {
      console.error("Exiting in production mode due to database connection failure.")
      process.exit(1)
    } else {
      console.warn("Running in development mode with limited functionality.")
      console.warn("Consider setting USE_MOCK_DATA=true in your .env file for development.")
      return false
    }
  }
}

// Handle connection errors
process.on("unhandledRejection", (reason, promise) => {
  if (reason && reason.code === "CONNECTION_ENDED") {
    console.error("Database connection ended unexpectedly. Attempting to reconnect...")
    sql = createSqlConnection(true)
  } else {
    console.error("Unhandled Rejection at:", promise, "reason:", reason)
  }
})

// Export the pool for session store
const pool = {
  query: (text, params) => {
    try {
      return sql.unsafe(text, params)
    } catch (error) {
      console.error("Database query error:", error)
      throw error
    }
  },
}

module.exports = {
  sql,
  pool,
  testConnection,
  reconnect: () => {
    console.log("Manually reconnecting to database...")
    sql = createSqlConnection(true)
    return testConnection()
  },
}

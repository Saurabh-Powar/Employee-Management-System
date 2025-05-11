const { Pool } = require("pg")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Get database connection string with fallback
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/employee_management"

console.log("Attempting to connect to database...")
console.log(
  `Using ${process.env.POSTGRES_URL ? "POSTGRES_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : "default local connection"}`,
)

// Create a connection pool with retry logic
const createPool = () => {
  return new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000, // Increased timeout for connection
  })
}

const pool = createPool()

// Test the connection with better error handling
const testConnection = async () => {
  let retries = 5
  while (retries > 0) {
    try {
      const client = await pool.connect()
      console.log("✅ Successfully connected to the database")
      client.release()
      return true
    } catch (err) {
      retries--
      console.error(`❌ Database connection attempt failed (${5 - retries}/5):`, err.message)

      // Provide more helpful error messages based on error type
      if (err.code === "ECONNREFUSED") {
        console.error("The database server appears to be down or unreachable.")
        console.error("Check that your database is running and accessible from this machine.")
      } else if (err.code === "ECONNRESET") {
        console.error("The connection was reset by the database server.")
        console.error("This could be due to network issues or server configuration.")
      } else if (err.code === "ETIMEDOUT") {
        console.error("Connection attempt timed out.")
        console.error("Check network connectivity and firewall settings.")
      } else if (err.code === "28P01") {
        console.error("Authentication failed. Check your database credentials.")
      } else if (err.code === "3D000") {
        console.error("Database does not exist. Check your database name.")
      }

      if (retries > 0) {
        console.log(`Retrying connection in 3 seconds... (${retries} attempts remaining)`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } else {
        console.error("All connection attempts failed.")
        console.error("Please check your database configuration and ensure the database server is running.")
        console.error(
          "You can set the DATABASE_URL or POSTGRES_URL environment variable to specify the connection string.",
        )

        if (process.env.NODE_ENV !== "production") {
          console.log("Since you're in development mode, you can continue with limited functionality.")
          return false
        }
      }
    }
  }
  return false
}

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err)
  if (process.env.NODE_ENV === "production") {
    process.exit(-1)
  }
})

// Export the pool and a query helper function with error handling
module.exports = {
  pool,
  testConnection,
  query: async (text, params) => {
    try {
      return await pool.query(text, params)
    } catch (err) {
      console.error("Database query error:", err.message)
      console.error("Query:", text)
      throw err
    }
  },
}

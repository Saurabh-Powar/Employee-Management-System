const express = require("express")
const cors = require("cors")
const session = require("express-session")
const http = require("http")
const path = require("path")
const dotenv = require("dotenv")
const pgSession = require("connect-pg-simple")(session)
const { pool, testConnection } = require("./db/sql")
const websocket = require("./websocket")
const createTables = require("./db/migrate")

// Load environment variables
dotenv.config()

// Create Express app
const app = express()
const PORT = process.env.PORT || 5000

// Create HTTP server
const server = http.createServer(app)

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Add cache control headers
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  next()
})

// Configure CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
)

// Initialize database tables before setting up session
const initializeDatabase = async () => {
  try {
    // Test database connection first
    const connected = await testConnection()

    if (connected) {
      // Only try to create tables if we have a database connection
      await createTables()
      console.log("Database tables created successfully")
    } else if (process.env.NODE_ENV === "production") {
      console.error("Cannot start server without database connection in production mode")
      process.exit(1)
    } else {
      console.warn("⚠️ Starting with limited functionality due to database connection issues")
      console.warn("Some features that require database access will not work")
    }

    // Session configuration - use memory store if database is not available
    if (connected) {
      app.use(
        session({
          store: new pgSession({
            pool,
            tableName: "user_sessions",
            createTableIfMissing: true,
          }),
          secret: process.env.SESSION_SECRET || "your-secret-key",
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 1 day
          },
        }),
      )
    } else {
      // Fallback to memory store if database is not available (development only)
      console.warn("⚠️ Using memory store for sessions - all sessions will be lost on server restart")
      app.use(
        session({
          secret: process.env.SESSION_SECRET || "your-secret-key",
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 1 day
          },
        }),
      )
    }

    // Initialize WebSocket server BEFORE setting up routes
    websocket.init(server)

    // Make WebSocket server available to the app
    app.set("wsServer", websocket)

    // API routes - set up after WebSocket is initialized
    app.use("/api/auth", require("./routes/authRoutes"))
    app.use("/api/employees", require("./routes/employeesRoutes"))
    app.use("/api/attendance", require("./routes/attendanceRoutes"))
    app.use("/api/leaves", require("./routes/leavesRoutes"))
    app.use("/api/tasks", require("./routes/tasksRoutes"))
    app.use("/api/shifts", require("./routes/shiftsRoutes"))
    app.use("/api/salaries", require("./routes/salariesRoutes"))
    app.use("/api/notifications", require("./routes/notificationsRoutes"))
    app.use("/api/performance", require("./routes/performanceRoutes"))

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        websocket: websocket.io ? "connected" : "disconnected",
        database: connected ? "connected" : "disconnected",
        environment: process.env.NODE_ENV || "development",
      })
    })

    // Start server only after everything is initialized
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`Health check available at http://localhost:${PORT}/api/health`)
    })
  } catch (err) {
    console.error("Error initializing application:", err)
    if (process.env.NODE_ENV === "production") {
      process.exit(1)
    } else {
      console.error("Starting server with limited functionality...")
      // Start server anyway in development mode
      server.listen(PORT, () => {
        console.log(`Server running with limited functionality on port ${PORT}`)
      })
    }
  }
}

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")))

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!", details: err.message })
})

// Initialize database and start server
initializeDatabase()

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...")
  server.close(() => {
    console.log("Server shut down")
    process.exit(0)
  })
})

module.exports = app

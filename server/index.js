const express = require("express")
const cors = require("cors")
const session = require("express-session")
const http = require("http")
const path = require("path")
const dotenv = require("dotenv")
const url = require("url")
const pgSession = require("connect-pg-simple")(session)
const { pool, testConnection } = require("./db/sql")
const websocket = require("./websocket")
const jwt = require("jsonwebtoken")
const { initialize } = require("./db/migrate")
const fs = require("fs")

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
    // Check if we should use mock data in development
    const useMockData = process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true"

    // Test database connection first (skip if using mock data)
    const connected = useMockData ? true : await testConnection()

    // Session configuration - use memory store if database is not available
    if (connected) {
      // Only use pgSession if we're not using mock data
      if (!useMockData) {
        app.use(
          session({
            store: new pgSession({
              pool,
              tableName: "user_sessions",
              createTableIfMissing: true,
              errorLog: (err) => console.error("Session store error:", err), // Log session store errors
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
        // Use memory store for mock data mode
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

      // Only try to create tables if we have a database connection and not using mock data
      if (!useMockData) {
        try {
          await initialize()
          console.log("Database tables created successfully")
        } catch (dbError) {
          console.error("Error creating database tables:", dbError)
          if (process.env.NODE_ENV === "production") {
            console.error("Cannot start server without database tables in production mode")
            process.exit(1)
          } else {
            console.warn("⚠️ Starting with limited functionality due to database table creation issues")
            console.warn("Consider setting USE_MOCK_DATA=true in your .env file for development.")
          }
        }
      }
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

      if (process.env.NODE_ENV === "production") {
        console.error("Cannot start server without database connection in production mode")
        process.exit(1)
      } else {
        console.warn("⚠️ Starting with limited functionality due to database connection issues")
        console.warn("Consider setting USE_MOCK_DATA=true in your .env file for development.")
      }
    }

    // Initialize WebSocket server BEFORE setting up routes
    websocket.initializeWebSocketServer(server)

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
        mockData: useMockData ? "enabled" : "disabled",
      })
    })

    // Database reconnection endpoint (for admin use)
    app.post("/api/admin/reconnect-db", async (req, res) => {
      try {
        const result = await testConnection()
        res.json({
          success: result,
          message: result ? "Database reconnected successfully" : "Database reconnection failed",
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error reconnecting to database",
          error: process.env.NODE_ENV === "production" ? "Server error" : error.message,
        })
      }
    })

    // Start server only after everything is initialized
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`Health check available at http://localhost:${PORT}/api/health`)
      const generateToken = (user) => {
        return jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
        )
      }
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
  // Check if the client/dist directory exists
  const distPath = path.join(__dirname, "../client/dist")

  if (fs.existsSync(distPath)) {
    console.log(`Serving static files from: ${distPath}`)
    app.use(express.static(distPath))

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"))
    })
  } else {
    console.warn(`Warning: Production build directory not found at ${distPath}`)
    console.warn("Static file serving is disabled. Run 'npm run build' in the client directory first.")

    // Add a fallback route that explains the issue
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next() // Let API routes handle API requests
      }

      res.status(503).send(`
        <html>
          <head><title>Server Configuration Error</title></head>
          <body>
            <h1>Server Configuration Error</h1>
            <p>The production build directory was not found.</p>
            <p>Please run 'npm run build' in the client directory and restart the server.</p>
          </body>
        </html>
      `)
    })
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Something went wrong!",
    details: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  })
})

// Initialize database and start server
initializeDatabase()

server.on("upgrade", (request, socket, head) => {
  const { pathname, query } = url.parse(request.url, true)
  console.log("WebSocket request received:", { pathname, query })

  if (pathname === "/ws") {
    const { userId, token } = query
    console.log("WebSocket authentication details:", { userId, token })
    // Authentication logic here...
    try {
      if (!token) {
        console.error("WebSocket connection rejected: Missing token")
        socket.destroy()
        return
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")

      // Check if the userId matches the token's user ID
      if (decoded.id !== Number.parseInt(userId, 10)) {
        console.error("WebSocket connection rejected: Invalid user ID")
        socket.destroy()
        return
      }

      console.log("WebSocket connection authenticated for user:", decoded)

      // Pass the connection to the WebSocket server
      websocket.io.handleUpgrade(request, socket, head, (ws) => {
        websocket.io.emit("connection", ws, request)
      })
    } catch (err) {
      console.error("WebSocket connection rejected:", err.message)
      socket.destroy()
    }
  }
})

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...")
  server.close(() => {
    console.log("Server shut down")
    process.exit(0)
  })
})

module.exports = app

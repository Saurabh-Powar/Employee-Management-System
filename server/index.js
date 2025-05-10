const express = require("express")
const cors = require("cors")
const session = require("express-session")
const http = require("http")
const path = require("path")
const dotenv = require("dotenv")
const pgSession = require("connect-pg-simple")(session)
const pool = require("./db/sql")
const websocket = require("./websocket")

// Load environment variables
dotenv.config()

// Create Express app
const app = express()
const PORT = process.env.PORT || 5000

// Create HTTP server
const server = http.createServer(app)

// Initialize WebSocket server
websocket.init(server)

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configure CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
)

// Session configuration
app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
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

// API routes
app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/employees", require("./routes/employeesRoutes"))
app.use("/api/attendance", require("./routes/attendanceRoutes"))
app.use("/api/leaves", require("./routes/leavesRoutes"))
app.use("/api/tasks", require("./routes/tasksRoutes"))
app.use("/api/shifts", require("./routes/shiftsRoutes"))
app.use("/api/salaries", require("./routes/salariesRoutes"))
app.use("/api/notifications", require("./routes/notificationsRoutes"))
app.use("/api/performance", require("./routes/performanceRoutes"))

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
  res.status(500).json({ error: "Something went wrong!" })
})

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
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

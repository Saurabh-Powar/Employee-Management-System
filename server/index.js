const express = require("express")
const session = require("express-session")
const cors = require("cors")
const createTables = require("./db/migrate")
const authRoutes = require("./routes/authRoutes")
const employeesRoutes = require("./routes/employeesRoutes")
const attendanceRoutes = require("./routes/attendanceRoutes")
const leavesRoutes = require("./routes/leavesRoutes")
const performanceRoutes = require("./routes/performanceRoutes")
const salariesRoutes = require("./routes/salariesRoutes")
const notificationsRoutes = require("./routes/notificationsRoutes")
const tasksRoutes = require("./routes/tasksRoutes")
const shiftsRoutes = require("./routes/shiftsRoutes")

// Load environment variables
const PORT = process.env.PORT || 5000
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000"
const SESSION_SECRET = process.env.SESSION_SECRET || "your_session_secret"

const app = express()

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
)

// Session configuration
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
)

// Create database tables if they don't exist
createTables()
  .then(() => {
    console.log("Database tables created successfully")
  })
  .catch((err) => {
    console.error("Error creating database tables:", err)
  })

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/employees", employeesRoutes)
app.use("/api/attendance", attendanceRoutes)
app.use("/api/leaves", leavesRoutes)
app.use("/api/performance", performanceRoutes)
app.use("/api/salaries", salariesRoutes)
app.use("/api/notifications", notificationsRoutes)
app.use("/api/tasks", tasksRoutes)
app.use("/api/shifts", shiftsRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

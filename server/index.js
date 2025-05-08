const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const createTables = require("./db/migrate")
const session = require("express-session")
const passport = require("passport")
require("dotenv").config()

const authRoutes = require("./routes/authRoutes")
const employeesRoutes = require("./routes/employeesRoutes")
const attendanceRoutes = require("./routes/attendanceRoutes")
const leavesRoutes = require("./routes/leavesRoutes")
const performanceRoutes = require("./routes/performanceRoutes")
const salariesRoutes = require("./routes/salariesRoutes")
const notificationsRoutes = require("./routes/notificationsRoutes")
const tasksRoutes = require("./routes/tasksRoutes")

const app = express()
const PORT = process.env.PORT || 5000

// ✅ 1. CORS (allow frontend + send credentials)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
)

// ✅ 2. bodyParser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// ✅ 3. Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "yoursecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true in production with https
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  }),
)

// ✅ 4. Passport
app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/employees", employeesRoutes)
app.use("/api/attendance", attendanceRoutes)
app.use("/api/leaves", leavesRoutes)
app.use("/api/performance", performanceRoutes)
app.use("/api/salaries", salariesRoutes)
app.use("/api/notifications", notificationsRoutes)
app.use("/api/tasks", tasksRoutes)

// Create tables and start the server
createTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Could not start the server:", err)
    process.exit(1) // Exit with error code
  })

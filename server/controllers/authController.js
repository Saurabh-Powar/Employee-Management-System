const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const db = require("../db/sql")

// Get JWT secret from environment variables or use a default (for development only)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h"

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )
}

const authController = {
  // Login user
  login: async (req, res) => {
    try {
      const { email, password } = req.body

      console.log("Login attempt with:", { email })

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" })
      }

      // Query the database to get the user details
      const userResult = await db.query("SELECT * FROM users WHERE email = $1", [email])

      if (userResult.rows.length === 0) {
        console.log(`Login failed: User with email '${email}' not found`)
        return res.status(401).json({ message: "Invalid credentials" })
      }

      const user = userResult.rows[0]

      // Compare password with hashed password in the database
      const passwordMatch = await bcrypt.compare(password, user.password)

      if (!passwordMatch) {
        console.log(`Login failed: Incorrect password for user '${email}'`)
        return res.status(401).json({ message: "Invalid credentials" })
      }

      // Generate JWT token
      const token = generateToken(user)

      // Store user info in the session
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      }

      // Save the session
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err)
          return res.status(500).json({ message: "Login failed due to session error" })
        }

        console.log(`User '${email}' logged in successfully with role: ${user.role}`)

        // Return user data and token
        res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          token,
          message: "Login successful",
        })
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ message: "Login failed due to server error", error: error.message })
    }
  },

  // Logout user
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err)
        return res.status(500).json({ message: "Logout failed", error: err.message })
      }

      // Clear the session cookie
      res.clearCookie("connect.sid", { path: "/" })
      res.json({ message: "Logged out successfully" })
    })
  },

  // Check authentication status
  checkAuth: (req, res) => {
    // First check session-based authentication
    if (req.session.user) {
      const token = generateToken(req.session.user)

      return res.json({
        message: "Authenticated",
        user: req.session.user,
        token,
      })
    }

    // Then check JWT token
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, JWT_SECRET)

        return res.json({
          message: "Authenticated",
          user: {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
          },
          token, // Return the same token for continued use
        })
      } catch (error) {
        console.error("JWT verification failed:", error)
        return res.status(401).json({ message: "Invalid token" })
      }
    }

    return res.status(401).json({ message: "Not authenticated" })
  },

  // Refresh user data
  refreshUser: (req, res) => {
    if (req.session.user) {
      return res.json({ user: req.session.user })
    }

    // Check JWT token if no session
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, JWT_SECRET)

        return res.json({
          user: {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
          },
        })
      } catch (error) {
        console.error("JWT verification failed:", error)
        return res.status(401).json({ message: "Invalid token" })
      }
    }

    return res.status(401).json({ message: "Not authenticated" })
  },
}

module.exports = authController

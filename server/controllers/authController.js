const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { sql } = require("../db/sql")

// Login controller
const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }

  try {
    console.log(`Login attempt with: ${JSON.stringify({ email })}`)

    // Check if we're using mock data in development
    if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true") {
      // Mock authentication for development
      if (email === "admin@example.com" && password === "admin123") {
        const mockUser = {
          id: 1,
          email: "admin@example.com",
          role: "admin",
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: mockUser.id, email: mockUser.email, role: mockUser.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
        )

        // Set session
        req.session.user = mockUser

        return res.json({
          user: {
            id: mockUser.id,
            email: mockUser.email,
            role: mockUser.role,
          },
          token,
        })
      } else if (email === "manager@example.com" && password === "manager123") {
        const mockUser = {
          id: 2,
          email: "manager@example.com",
          role: "manager",
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: mockUser.id, email: mockUser.email, role: mockUser.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
        )

        // Set session
        req.session.user = mockUser

        return res.json({
          user: {
            id: mockUser.id,
            email: mockUser.email,
            role: mockUser.role,
          },
          token,
        })
      } else if (email === "employee1@example.com" && password === "employee123") {
        const mockUser = {
          id: 3,
          email: "employee1@example.com",
          role: "employee",
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: mockUser.id, email: mockUser.email, role: mockUser.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
        )

        // Set session
        req.session.user = mockUser

        return res.json({
          user: {
            id: mockUser.id,
            email: mockUser.email,
            role: mockUser.role,
          },
          token,
        })
      }

      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Find user by email
    const users = await sql`
      SELECT u.id, u.email, u.password, u.role
      FROM users u
      WHERE u.email = ${email}
    `

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = users[0]

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
    )

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    }

    // Return user info and token
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({ error: "Server error", details: error.message })
  }
}

// Logout controller
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.status(500).json({ error: "Failed to logout" })
    }
    res.clearCookie("connect.sid")
    return res.json({ message: "Logged out successfully" })
  })
}

// Check if user is authenticated
const checkAuth = (req, res) => {
  // Check if user is in session
  if (req.session && req.session.user) {
    return res.json({
      isAuthenticated: true,
      user: req.session.user,
    })
  }

  // Check if token is provided
  const token = req.headers.authorization?.split(" ")[1]

  if (!token) {
    return res.json({ isAuthenticated: false })
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")

    // Set session
    req.session.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    }

    return res.json({
      isAuthenticated: true,
      user: req.session.user,
    })
  } catch (error) {
    console.error("Token verification error:", error)
    return res.json({ isAuthenticated: false })
  }
}

// Refresh user data
const refreshUser = async (req, res) => {
  try {
    // Get user ID from session or token
    let userId

    if (req.session && req.session.user) {
      userId = req.session.user.id
    } else {
      const token = req.headers.authorization?.split(" ")[1]

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" })
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
        userId = decoded.id
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" })
      }
    }

    // Check if we're using mock data in development
    if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true") {
      // Return mock user data based on userId
      if (userId === 1) {
        return res.json({
          user: {
            id: 1,
            email: "admin@example.com",
            role: "admin",
            employee: {
              id: 1,
              first_name: "Admin",
              last_name: "User",
              position: "System Administrator",
              department: "IT",
            },
          },
        })
      } else if (userId === 2) {
        return res.json({
          user: {
            id: 2,
            email: "manager@example.com",
            role: "manager",
            employee: {
              id: 2,
              first_name: "Manager",
              last_name: "User",
              position: "Department Manager",
              department: "Operations",
            },
          },
        })
      } else if (userId === 3) {
        return res.json({
          user: {
            id: 3,
            email: "employee1@example.com",
            role: "employee",
            employee: {
              id: 3,
              first_name: "John",
              last_name: "Doe",
              position: "Software Developer",
              department: "Engineering",
            },
          },
        })
      }

      return res.status(404).json({ error: "User not found" })
    }

    // Get user data from database
    const users = await sql`
      SELECT u.id, u.email, u.role, 
             e.id as employee_id, e.first_name, e.last_name, 
             e.position, e.department, e.hire_date, e.manager_id
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.id = ${userId}
    `

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    // Format user data
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      employee: user.employee_id
        ? {
            id: user.employee_id,
            first_name: user.first_name,
            last_name: user.last_name,
            position: user.position,
            department: user.department,
            hire_date: user.hire_date,
            manager_id: user.manager_id,
          }
        : null,
    }

    return res.json({ user: userData })
  } catch (error) {
    console.error("Refresh user error:", error)
    return res.status(500).json({ error: "Server error", details: error.message })
  }
}

// Get user data from session or token
const getUser = async (req, res) => {
  try {
    // Get user ID from session or token
    let userId

    if (req.session && req.session.user) {
      userId = req.session.user.id
    } else {
      const token = req.headers.authorization?.split(" ")[1]

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" })
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
        userId = decoded.id
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" })
      }
    }

    // Check if we're using mock data in development
    if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true") {
      // Return mock user data based on userId
      if (userId === 1) {
        return res.json({
          user: {
            id: 1,
            email: "admin@example.com",
            role: "admin",
          },
        })
      } else if (userId === 2) {
        return res.json({
          user: {
            id: 2,
            email: "manager@example.com",
            role: "manager",
          },
        })
      } else if (userId === 3) {
        return res.json({
          user: {
            id: 3,
            email: "employee1@example.com",
            role: "employee",
          },
        })
      }

      return res.status(404).json({ error: "User not found" })
    }

    // Get user data from database
    const users = await sql`
      SELECT id, email, role
      FROM users
      WHERE id = ${userId}
    `

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    return res.json({ user })
  } catch (error) {
    console.error("Get user error:", error)
    return res.status(500).json({ error: "Server error", details: error.message })
  }
}

module.exports = {
  login,
  logout,
  checkAuth,
  refreshUser,
  getUser,
}

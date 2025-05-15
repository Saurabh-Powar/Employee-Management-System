const jwt = require("jsonwebtoken")

// Get JWT secret from environment variables or use a default (for development only)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
  // First check session-based authentication
  if (req.session && req.session.user) {
    return next()
  }

  // Then check JWT token
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, JWT_SECRET)

      // Set user in request for downstream middleware/routes
      req.user = decoded
      return next()
    } catch (error) {
      console.error("JWT verification failed:", error)
      return res.status(401).json({ message: "Invalid token" })
    }
  }

  console.warn("Unauthenticated access attempt.")
  return res.status(401).json({ message: "Authentication required" })
}

// Middleware to check if the user has admin role
const isAdmin = (req, res, next) => {
  // Get user from session or JWT
  const user = req.session?.user || req.user

  if (user && user.role === "admin") {
    return next()
  }

  console.warn("Unauthorized admin access attempt.")
  return res.status(403).json({ message: "Access denied: Admin role required" })
}

// Middleware to check if the user has manager role
const isManager = (req, res, next) => {
  // Get user from session or JWT
  const user = req.session?.user || req.user

  if (user && (user.role === "manager" || user.role === "admin")) {
    return next()
  }

  console.warn("Unauthorized manager access attempt.")
  return res.status(403).json({ message: "Access denied: Manager role required" })
}

// Middleware to check if the user has employee role
const isEmployee = (req, res, next) => {
  // Get user from session or JWT
  const user = req.session?.user || req.user

  if (user && (user.role === "employee" || user.role === "manager" || user.role === "admin")) {
    return next()
  }

  console.warn("Unauthorized employee access attempt.")
  return res.status(403).json({ message: "Access denied: Employee role required" })
}

// Middleware to check if the user is accessing their own data or has admin/manager role
const isSelfOrManagerOrAdmin = (req, res, next) => {
  // Get user from session or JWT
  const user = req.session?.user || req.user

  if (!user) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const requestedId = Number.parseInt(req.params.employeeId || req.params.id, 10)

  if (user.role === "admin" || user.role === "manager" || user.id === requestedId) {
    return next()
  }

  console.warn(`Unauthorized access attempt: ${user.role} trying to access ID ${requestedId}`)
  return res.status(403).json({ message: "Access denied: You can only access your own data" })
}

module.exports = {
  isAuthenticated,
  isManager,
  isAdmin,
  isEmployee,
  isSelfOrManagerOrAdmin,
}

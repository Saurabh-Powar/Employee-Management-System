const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")
const auth = require("../middleware/authMiddleware")

// Login route
router.post("/login", authController.login)

// Logout route (requires authentication)
router.post("/logout", auth.isAuthenticated, authController.logout)

// Get authenticated user's session data
router.get("/session", auth.isAuthenticated, authController.getUser)
router.get("/user", auth.isAuthenticated, authController.getUser)

// Check authentication status
router.get("/check", authController.checkAuth)

// Route for refreshing user session details
router.get("/refresh-user", auth.isAuthenticated, authController.refreshUser)

module.exports = router

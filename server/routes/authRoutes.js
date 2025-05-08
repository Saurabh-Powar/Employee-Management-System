const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")
const auth = require("../middleware/authMiddleware")

// Login route
router.post("/login", authController.login)

// Logout route (requires authentication)
router.post("/logout", auth.isAuthenticated, authController.logout)

// Get authenticated user's session data
// Both `/session` and `/user` return the same user data for flexibility on the frontend
router.get("/session", auth.isAuthenticated, authController.getUser)
router.get("/user", auth.isAuthenticated, authController.getUser)

// Optional: route for refreshing user session details explicitly (used in frontend refreshUser call)
router.get("/refresh-user", auth.isAuthenticated, authController.refreshUser)

module.exports = router

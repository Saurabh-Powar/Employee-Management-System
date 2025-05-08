const express = require("express")
const router = express.Router()
const notificationsController = require("../controllers/notificationsController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware: Allow Admin or the user themselves
const canAccessOwnOrAdmin = (req, res, next) => {
  const requestedUserId = Number.parseInt(req.params.userId || req.body.user_id, 10)
  const sessionUser = req.session?.user

  if (sessionUser?.id === requestedUserId || sessionUser?.role === "admin") {
    return next()
  }

  return res.status(403).json({ message: "Unauthorized access to notifications" })
}

// Middleware: Allow Admin or Manager
const isAdminOrManager = (req, res, next) => {
  const role = req.session?.user?.role
  if (role === "admin" || role === "manager") {
    return next()
  }
  return res.status(403).json({ message: "Only Admins or Managers can perform this action" })
}

// Get all notifications for a specific user (Admin or the user)
router.get("/:userId", isAuthenticated, canAccessOwnOrAdmin, notificationsController.getUserNotifications)

// Create a new notification (Admin or Manager)
router.post("/", isAuthenticated, isAdminOrManager, notificationsController.createNotification)

// Mark a notification as read (Admin or the user themselves)
router.put("/:id/read", isAuthenticated, notificationsController.markNotificationAsRead)

// Mark all notifications as read (for the current user)
router.put("/read-all", isAuthenticated, notificationsController.markAllNotificationsAsRead)

// Mark a notification as unread (Admin or the user themselves)
router.put("/:id/unread", isAuthenticated, notificationsController.markNotificationAsUnread)

module.exports = router

const express = require("express")
const router = express.Router()
const notificationsController = require("../controllers/notificationsController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware: Allow Admin or the user themselves
const canAccessOwnOrAdmin = (req, res, next) => {
  const requestedUserId = Number.parseInt(req.params.employeeId || req.params.userId || req.body.employee_id, 10)
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

// Get all notifications for a specific employee
router.get("/:employeeId", isAuthenticated, canAccessOwnOrAdmin, notificationsController.getEmployeeNotifications)

// Create a new notification (Admin or Manager)
router.post("/", isAuthenticated, isAdminOrManager, notificationsController.createNotification)

// Mark a notification as read
router.put("/:notificationId/read", isAuthenticated, notificationsController.markAsRead)

// Mark all notifications as read for an employee
router.put("/read-all/:employeeId", isAuthenticated, canAccessOwnOrAdmin, notificationsController.markAllAsRead)

// Delete a notification
router.delete("/:notificationId", isAuthenticated, isAdminOrManager, notificationsController.deleteNotification)

// Get unread notification count
router.get("/unread/:employeeId", isAuthenticated, canAccessOwnOrAdmin, notificationsController.getUnreadCount)

module.exports = router

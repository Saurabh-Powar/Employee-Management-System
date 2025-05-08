const express = require("express")
const router = express.Router()
const tasksController = require("../controllers/tasksController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware for Admin or Manager access
const isAdminOrManager = (req, res, next) => {
  const role = req.session?.user?.role
  if (role === "admin" || role === "manager") {
    return next()
  }
  return res.status(403).json({ message: "Access denied: Admin or Manager role required" })
}

// Get all tasks (Admin and Manager only)
router.get("/", isAuthenticated, isAdminOrManager, tasksController.getAlltasks)

// Get tasks for a specific employee
router.get("/:employeeId", isAuthenticated, tasksController.getEmployeetasks)

// Create a new task (Admin and Manager only)
router.post("/", isAuthenticated, isAdminOrManager, tasksController.createTask)

// Update task status
router.put("/:id/status", isAuthenticated, tasksController.updatetaskstatus)

// Delete a task (Admin and Manager only)
router.delete("/:id", isAuthenticated, isAdminOrManager, tasksController.deleteTask)

// Start task timer
router.post("/:taskId/timer/start", isAuthenticated, tasksController.startTaskTimer)

// Stop task timer
router.post("/:taskId/timer/stop", isAuthenticated, tasksController.stopTaskTimer)

// Get task timer history
router.get("/:taskId/timer/history", isAuthenticated, tasksController.getTaskTimerHistory)

module.exports = router

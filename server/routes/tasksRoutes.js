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
router.get("/", isAuthenticated, isAdminOrManager, tasksController.getAllTasks)

// Get tasks for a specific employee
router.get("/employee/:employeeId", isAuthenticated, tasksController.getEmployeeTasks)

// Get tasks for a specific manager
router.get("/manager/:managerId", isAuthenticated, tasksController.getManagerTasks)

// Create a new task (Admin and Manager only)
router.post("/", isAuthenticated, isAdminOrManager, tasksController.createTask)

// Update task status
router.put("/:taskId/status", isAuthenticated, tasksController.updateTaskStatus)

// Update task details
router.put("/:taskId", isAuthenticated, isAdminOrManager, tasksController.updateTask)

// Delete a task (Admin and Manager only)
router.delete("/:taskId", isAuthenticated, isAdminOrManager, tasksController.deleteTask)

// Get task by ID
router.get("/:taskId", isAuthenticated, tasksController.getTaskById)

// Start task timer
router.post("/:taskId/timer/start", isAuthenticated, tasksController.startTaskTimer)

// Stop task timer
router.post("/:taskId/timer/stop", isAuthenticated, tasksController.stopTaskTimer)

// Get task timer history
router.get("/:taskId/timer/history", isAuthenticated, tasksController.getTaskTimerHistory)

module.exports = router

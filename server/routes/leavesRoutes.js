const express = require("express")
const router = express.Router()
const leavesController = require("../controllers/leavesController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware for Admin or Manager access
const isAdminOrManager = (req, res, next) => {
  const role = req.session?.user?.role
  if (role === "admin" || role === "manager") {
    return next()
  }
  return res.status(403).json({ message: "Only Admins or Managers can perform this action" })
}

// Update middleware to properly handle the employee ID checks
const canAccessLeave = (req, res, next) => {
  const requestedId = Number.parseInt(req.params.employeeId, 10)
  const user = req.session?.user

  if (!user) {
    return res.status(401).json({ message: "Authentication required" })
  }

  // Allow admin and managers to access any employee's leave
  if (user.role === "admin" || user.role === "manager") {
    return next()
  }

  // Allow employees to access only their own leave
  if (user.role === "employee" && user.id === requestedId) {
    return next()
  }

  return res.status(403).json({ message: "Unauthorized access to leave data" })
}

// Get all leave requests (Admins and Managers)
router.get("/", isAuthenticated, isAdminOrManager, leavesController.getAllLeaves)

// Get leave requests for a specific employee (Admins, Managers, or Self)
router.get("/:employeeId", isAuthenticated, canAccessLeave, leavesController.getLeavesByEmployee)

// Create a new leave request (All authenticated users can request leave)
router.post("/", isAuthenticated, leavesController.createLeave)

// Update leave status (Approve/Reject) — Admins and Managers only
router.put("/:id", isAuthenticated, isAdminOrManager, leavesController.updateLeaveStatus)

module.exports = router

const express = require("express")
const router = express.Router()
const performanceController = require("../controllers/performanceController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware to check if user is manager or admin
const checkManagerOrAdmin = (req, res, next) => {
  const user = req.session.user

  // Ensure that user is defined
  if (!user) {
    return res.status(401).json({ message: "User not logged in" })
  }

  // Check if the user is manager or admin
  if (user.role === "manager" || user.role === "admin") {
    return next()
  }

  res.status(403).json({ message: "Unauthorized access to performance evaluations" })
}

// Get all performance evaluations (only accessible by managers or admins)
router.get("/", isAuthenticated, checkManagerOrAdmin, performanceController.getAllPerformanceEvaluations)

// Get performance evaluations for a specific employee (accessible by manager, admin, or the employee themselves)
router.get(
  "/:employeeId",
  isAuthenticated,
  (req, res, next) => {
    const requestedId = Number.parseInt(req.params.employeeId, 10)
    const user = req.session.user

    // Ensure that user is defined
    if (!user) {
      return res.status(401).json({ message: "User not logged in" })
    }

    // Allow managers, admins, or the employee themselves to view performance evaluations
    if (user.role === "manager" || user.role === "admin" || user.id === requestedId) {
      return next()
    }

    res.status(403).json({ message: "Unauthorized access to performance data" })
  },
  performanceController.getEmployeePerformanceEvaluations,
)

// Create a new performance evaluation (only accessible by managers or admins)
router.post("/", isAuthenticated, checkManagerOrAdmin, performanceController.createPerformanceEvaluation)

module.exports = router

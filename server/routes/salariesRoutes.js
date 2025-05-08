const express = require("express")
const router = express.Router()
const salariesController = require("../controllers/salariesController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Middleware to check if user is manager or admin
const checkManagerOrAdmin = (req, res, next) => {
  const user = req.session.user
  if (user && (user.role === "manager" || user.role === "admin")) {
    return next()
  }
  res.status(403).json({ message: "Unauthorized to access salary data" })
}

// Get all salary records (Only accessible by managers or admins)
router.get("/", isAuthenticated, checkManagerOrAdmin, salariesController.getAllSalaryRecords)

// Get salary records for a specific employee (Accessible by managers or the employee themselves)
router.get(
  "/:employeeId",
  isAuthenticated,
  (req, res, next) => {
    const sessionUser = req.session.user
    const { employeeId } = req.params

    // Ensure the user is either a manager or the employee themselves
    if (sessionUser && (sessionUser.role === "manager" || sessionUser.id == employeeId)) {
      return next()
    }

    res.status(403).json({ message: "Unauthorized to view this salary data" })
  },
  salariesController.getEmployeeSalaryRecords,
)

// Create a new salary record (Only accessible by managers or admins)
router.post("/", isAuthenticated, checkManagerOrAdmin, salariesController.createSalaryRecord)

// Update salary record status (Only accessible by managers or admins)
router.put("/:id", isAuthenticated, checkManagerOrAdmin, salariesController.updateSalaryRecordStatus)

module.exports = router

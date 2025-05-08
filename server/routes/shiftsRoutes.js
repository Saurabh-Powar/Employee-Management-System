const express = require("express")
const router = express.Router()
const shiftsController = require("../controllers/shiftsController")
const { isAuthenticated } = require("../middleware/authMiddleware")

// Get all shifts (admin and manager only)
router.get("/", isAuthenticated, shiftsController.getAllShifts)

// Get shift for a specific employee
router.get("/:employeeId", isAuthenticated, shiftsController.getEmployeeShift)

// Create or update shift (admin and manager only)
router.post("/", isAuthenticated, shiftsController.createOrUpdateShift)

// Delete shift (admin and manager only)
router.delete("/:employeeId", isAuthenticated, shiftsController.deleteShift)

module.exports = router

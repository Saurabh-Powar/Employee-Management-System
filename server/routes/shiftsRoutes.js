const express = require("express")
const router = express.Router()
const shiftsController = require("../controllers/shiftsController")
const { isAuthenticated, isManager, isAdmin, isSelfOrManagerOrAdmin } = require("../middleware/authMiddleware")

// Get all shifts (admin and manager only)
router.get("/", isAuthenticated, shiftsController.getAllShifts)

// Get shift for a specific employee
router.get("/:employeeId", isAuthenticated, isSelfOrManagerOrAdmin, shiftsController.getEmployeeShift)

// Create a new shift (admin and manager only)
router.post(
  "/",
  isAuthenticated,
  (req, res, next) => {
    if (req.session.user.role === "admin" || req.session.user.role === "manager") {
      next()
    } else {
      res.status(403).json({ message: "Only managers and admins can create shifts" })
    }
  },
  shiftsController.createShift,
)

// Update a shift (admin and manager only)
router.put(
  "/:employeeId",
  isAuthenticated,
  (req, res, next) => {
    if (req.session.user.role === "admin" || req.session.user.role === "manager") {
      next()
    } else {
      res.status(403).json({ message: "Only managers and admins can update shifts" })
    }
  },
  shiftsController.updateShift,
)

// Delete a shift (admin and manager only)
router.delete(
  "/:employeeId",
  isAuthenticated,
  (req, res, next) => {
    if (req.session.user.role === "admin" || req.session.user.role === "manager") {
      next()
    } else {
      res.status(403).json({ message: "Only managers and admins can delete shifts" })
    }
  },
  shiftsController.deleteShift,
)

module.exports = router

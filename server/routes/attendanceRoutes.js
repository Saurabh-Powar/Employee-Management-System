const express = require("express")
const router = express.Router()
const attendanceController = require("../controllers/attendanceController")
const auth = require("../middleware/authMiddleware")

// Get all attendance records (Manager only — Admin can be added later if needed)
router.get("/", auth.isAuthenticated, auth.isManager, attendanceController.getAllAttendance)

// Get attendance for a specific employee (Employee can see their own, manager can see any employee's, admin sees all)
router.get(
  "/:employeeId",
  auth.isAuthenticated,
  auth.isSelfOrManagerOrAdmin,
  attendanceController.getEmployeeAttendance,
)

// Get today's attendance status for an employee/manager (used to prevent duplicate check-in/absent)
router.get("/today/:employeeId", auth.isAuthenticated, auth.isSelfOrManagerOrAdmin, attendanceController.getTodayStatus)

// Get total work days for an employee
router.get(
  "/workdays/:employeeId",
  auth.isAuthenticated,
  auth.isSelfOrManagerOrAdmin,
  attendanceController.getTotalWorkDays,
)

// Mark check-in (only once per day, both employee and manager allowed)
router.post("/checkin", auth.isAuthenticated, attendanceController.checkIn)

// Mark check-out (only after check-in, and only once per day, both employee and manager allowed)
router.put("/checkout", auth.isAuthenticated, attendanceController.checkOut)

// Mark as absent (disables other actions for the day, both employee and manager allowed)
router.post("/absent", auth.isAuthenticated, attendanceController.markAbsent)

// Add a new route for correcting attendance records
router.post(
  "/correct",
  auth.isAuthenticated,
  (req, res, next) => {
    if (req.session.user.role === "manager" || req.session.user.role === "admin") {
      return next()
    }
    return res.status(403).json({ message: "Only managers and admins can correct attendance records" })
  },
  attendanceController.correctAttendance,
)

module.exports = router

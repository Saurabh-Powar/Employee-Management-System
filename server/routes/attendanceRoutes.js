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

// Get attendance by date range
router.get("/range", auth.isAuthenticated, auth.isManager, attendanceController.getAttendanceByDateRange)

// Get employee attendance statistics
router.get(
  "/stats/:employeeId",
  auth.isAuthenticated,
  auth.isSelfOrManagerOrAdmin,
  attendanceController.getEmployeeStats,
)

// Mark check-in (only once per day, both employee and manager allowed)
router.post("/checkin", auth.isAuthenticated, attendanceController.checkIn)

// Mark check-out (only after check-in, and only once per day, both employee and manager allowed)
router.put("/checkout", auth.isAuthenticated, attendanceController.checkOut)

// Update attendance record (manager only)
router.put("/:attendanceId", auth.isAuthenticated, auth.isManager, attendanceController.updateAttendance)

// Delete attendance record (manager only)
router.delete("/:attendanceId", auth.isAuthenticated, auth.isManager, attendanceController.deleteAttendance)

// Create a new attendance record (manager only)
router.post("/", auth.isAuthenticated, auth.isManager, attendanceController.createAttendance)

module.exports = router

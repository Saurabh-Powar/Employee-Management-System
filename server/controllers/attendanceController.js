const db = require("../db/sql")

const ATTENDANCE_STATUS = {
  CHECK_IN: "check-in",
  CHECK_OUT: "check-out",
  ABSENT: "absent",
}

// Helper function to check if an attendance record exists for today
const checkAttendanceExistence = async (employee_id, date) => {
  const result = await db.query("SELECT * FROM attendance WHERE employee_id = $1 AND date = $2", [employee_id, date])
  return result.rows[0]
}

const attendanceController = {
  // Get all attendance records (for admin and manager)
  getAllAttendance: async (req, res) => {
    try {
      // Verify user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      // Admin sees all attendance records
      if (req.session.user.role === "admin") {
        const result = await db.query(`
          SELECT a.*, e.first_name, e.last_name, e.position, e.department 
          FROM attendance a
          JOIN employees e ON a.employee_id = e.id
          ORDER BY a.date DESC
        `)
        return res.json(result.rows)
      }

      // Manager sees their team's attendance records
      if (req.session.user.role === "manager") {
        const result = await db.query(`
          SELECT a.*, e.first_name, e.last_name, e.position, e.department 
          FROM attendance a
          JOIN employees e ON a.employee_id = e.id
          ORDER BY a.date DESC
        `)
        return res.json(result.rows)
      }

      // Employees should not reach this endpoint
      return res.status(403).json({ message: "Unauthorized access" })
    } catch (error) {
      console.error("Error fetching attendance records:", error)
      res.status(500).json({ message: "Failed to fetch attendance records" })
    }
  },

  // Get attendance records for a specific employee
  getEmployeeAttendance: async (req, res) => {
    const { employeeId } = req.params
    const sessionUser = req.session.user

    // Validate access rights
    if (!sessionUser) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Employees can only view their own attendance
    if (sessionUser.role === "employee" && sessionUser.id !== Number.parseInt(employeeId, 10)) {
      return res.status(403).json({ message: "You can only view your own attendance" })
    }

    try {
      const result = await db.query(
        `
        SELECT a.*, e.first_name, e.last_name 
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.employee_id = $1
        ORDER BY a.date DESC
      `,
        [employeeId],
      )

      res.json(result.rows)
    } catch (error) {
      console.error("Error fetching employee attendance:", error)
      res.status(500).json({ message: "Failed to fetch employee attendance" })
    }
  },

  // Get today's attendance status for an employee
  getTodayStatus: async (req, res) => {
    const sessionUser = req.session.user
    const { employeeId } = req.params

    if (!sessionUser) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    // If the user is a manager or admin, return today's attendance for all employees
    if (sessionUser.role === "manager" || sessionUser.role === "admin") {
      try {
        const today = new Date().toISOString().split("T")[0]
        const result = await db.query(
          `
          SELECT a.*, e.first_name, e.last_name 
          FROM attendance a
          JOIN employees e ON a.employee_id = e.id
          WHERE a.date = $1
        `,
          [today],
        )
        return res.status(200).json(result.rows)
      } catch (error) {
        console.error("Error fetching today's attendance:", error)
        return res.status(500).json({
          message: "Failed to fetch today's attendance records",
          details: error.message,
        })
      }
    }

    // If the user is an employee, return only their attendance for today
    if (sessionUser.role === "employee") {
      try {
        const today = new Date().toISOString().split("T")[0]
        const result = await db.query("SELECT * FROM attendance WHERE employee_id = $1 AND date = $2", [
          employeeId,
          today,
        ])

        if (result.rows.length === 0) {
          return res.status(200).json({ status: null, message: "No attendance record for today" })
        }
        return res.status(200).json(result.rows[0])
      } catch (error) {
        console.error("Error fetching employee's today's attendance:", error)
        return res.status(500).json({
          message: "Failed to fetch today's attendance record",
          details: error.message,
        })
      }
    }

    return res.status(403).json({ message: "Unauthorized access" })
  },

  // Check in an employee (employee and manager only)
  checkIn: async (req, res) => {
    const sessionUser = req.session.user
    const { employeeId } = req.body

    // Verify user is authenticated
    if (!sessionUser) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Only employees and managers can check in
    if (sessionUser.role !== "employee" && sessionUser.role !== "manager" && sessionUser.role !== "admin") {
      return res.status(403).json({ message: "Only employees and managers can check in" })
    }

    // For employee role, verify they're checking in themselves
    if (sessionUser.role === "employee") {
      // Get the employee record for the current user
      const employeeResult = await db.query("SELECT id FROM employees WHERE user_id = $1", [sessionUser.id])
      
      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ message: "Employee record not found" })
      }
      
      const userEmployeeId = employeeResult.rows[0].id
      
      if (Number(employeeId) !== userEmployeeId) {
        return res.status(403).json({ message: "You can only check in yourself" })
      }
    }

    const date = new Date().toISOString().split("T")[0]
    const check_in = new Date().toISOString()

    try {
      const existing = await checkAttendanceExistence(employeeId, date)

      if (existing) {
        const existingStatus = existing.status
        if (existingStatus === ATTENDANCE_STATUS.ABSENT) {
          return res.status(400).json({ message: "You are marked absent today" })
        } else if (existingStatus === ATTENDANCE_STATUS.CHECK_IN || existingStatus === ATTENDANCE_STATUS.CHECK_OUT) {
          return res.status(400).json({ message: "Already checked in today" })
        }
      }

      const result = await db.query(
        "INSERT INTO attendance (employee_id, date, check_in, status) VALUES ($1, $2, $3, $4) RETURNING *",
        [employeeId, date, check_in, ATTENDANCE_STATUS.CHECK_IN],
      )
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error checking in employee:", error)
      res.status(500).json({ message: "Failed to check in employee" })
    }
  },

  // Check out an employee (employee and manager only)
  checkOut: async (req, res) => {
    const sessionUser = req.session.user
    const { employeeId } = req.body

    // Verify user is authenticated
    if (!sessionUser) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Only employees and managers can check out
    if (sessionUser.role !== "employee" && sessionUser.role !== "manager" && sessionUser.role !== "admin") {
      return res.status(403).json({ message: "Only employees and managers can check out" })
    }

    // For employee role, verify they're checking out themselves
    if (sessionUser.role === "employee") {
      // Get the employee record for the current user
      const employeeResult = await db.query("SELECT id FROM employees WHERE user_id = $1", [sessionUser.id])
      
      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ message: "Employee record not found" })
      }
      
      const userEmployeeId = employeeResult.rows[0].id
      
      if (Number(employeeId) !== userEmployeeId) {
        return res.status(403).json({ message: "You can only check out yourself" })
      }
    }

    const date = new Date().toISOString().split("T")[0]
    const check_out = new Date().toISOString()

    try {
      const existing = await checkAttendanceExistence(employeeId, date)

      if (!existing) {
        return res.status(400).json({ message: "Check-in first before check-out" })
      }

      const attendance = existing

      if (attendance.status === ATTENDANCE_STATUS.ABSENT) {
        return res.status(400).json({ message: "You are marked absent today" })
      }

      if (attendance.check_out) {
        return res.status(400).json({ message: "Already checked out today" })
      }

      // Calculate hours worked - FIX: Calculate in hours and minutes correctly
      const checkInTime = new Date(attendance.check_in)
      const checkOutTime = new Date(check_out)

      // Calculate difference in milliseconds
      const diffMs = checkOutTime - checkInTime

      // Convert to hours with precision
      const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2)

      const result = await db.query(
        "UPDATE attendance SET check_out = $1, hours_worked = $2, status = $3 WHERE employee_id = $4 AND date = $5 RETURNING *",
        [check_out, diffHours, ATTENDANCE_STATUS.CHECK_OUT, employeeId, date],
      )

      res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error checking out employee:", error)
      res.status(500).json({ message: "Failed to check out employee" })
    }
  },

  // Mark Absent for an employee (employee and manager only)
  markAbsent: async (req, res) => {
    const sessionUser = req.session.user
    const { employeeId } = req.body

    // Verify user is authenticated
    if (!sessionUser) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Only employees and managers can mark absent
    if (sessionUser.role !== "employee" && sessionUser.role !== "manager" && sessionUser.role !== "admin") {
      return res.status(403).json({ message: "Only employees and managers can mark absent" })
    }

    // For employee role, verify they're marking themselves absent
    if (sessionUser.role === "employee") {
      // Get the employee record for the current user
      const employeeResult = await db.query("SELECT id FROM employees WHERE user_id = $1", [sessionUser.id])
      
      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ message: "Employee record not found" })
      }
      
      const userEmployeeId = employeeResult.rows[0].id
      
      if (Number(employeeId) !== userEmployeeId) {
        return res.status(403).json({ message: "You can only mark yourself absent" })
      }
    }

    const date = new Date().toISOString().split("T")[0]

    try {
      const existing = await checkAttendanceExistence(employeeId, date)

      if (existing) {
        return res.status(400).json({ message: "Attendance already marked for today" })
      }

      const result = await db.query(
        "INSERT INTO attendance (employee_id, date, status) VALUES ($1, $2, $3) RETURNING *",
        [employeeId, date, ATTENDANCE_STATUS.ABSENT],
      )
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error marking absent employee:", error)
      res.status(500).json({ message: "Failed to mark absent employee" })
    }
  },

  // Get total work days for an employee
  getTotalWorkDays: async (req, res) => {
    const { employeeId } = req.params
    const sessionUser = req.session.user

    // Validate access rights
    if (!sessionUser) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Employees can only view their own data
    if (sessionUser.role === "employee" && sessionUser.id !== Number.parseInt(employeeId, 10)) {
      return res.status(403).json({ message: "You can only view your own work days" })
    }

    try {
      // Get total hours worked
      const result = await db.query(
        `
        SELECT SUM(hours_worked) as total_hours
        FROM attendance
        WHERE employee_id = $1 AND status = $2
      `,
        [employeeId, ATTENDANCE_STATUS.CHECK_OUT],
      )

      const totalHours = Number.parseFloat(result.rows[0]?.total_hours || 0)
      const workDays = Math.floor(totalHours / 8) // Assuming 8 hours = 1 work day

      // Get count of days present
      const daysResult = await db.query(
        `
        SELECT COUNT(*) as days_present
        FROM attendance
        WHERE employee_id = $1 AND status = $2
      `,
        [employeeId, ATTENDANCE_STATUS.CHECK_OUT],
      )

      const daysPresent = Number.parseInt(daysResult.rows[0]?.days_present || 0)

      res.json({
        employeeId,
        totalHours,
        workDays,
        daysPresent,
      })
    } catch (error) {
      console.error("Error calculating work days:", error)
      res.status(500).json({ message: "Failed to calculate work days" })
    }
  },

  // Add a new function to correct attendance records (for managers)
  correctAttendance: async (req, res) => {
    const sessionUser = req.session.user
    const { attendanceId, employeeId, date, checkIn, checkOut, status, reason } = req.body

    // Only managers and admins can correct attendance
    if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
      return res.status(403).json({ message: "Only managers and admins can correct attendance records" })
    }

    // Validate status
    const validStatuses = ["present", "absent", "late", "on-leave", "half-day", "check-in", "check-out"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" })
    }

    try {
      // Check if the attendance record exists
      let existingRecord = null

      if (attendanceId) {
        const existingResult = await db.query("SELECT * FROM attendance WHERE id = $1", [attendanceId])
        existingRecord = existingResult.rows[0]
      } else if (employeeId && date) {
        const existingResult = await db.query("SELECT * FROM attendance WHERE employee_id = $1 AND date = $2", [
          employeeId,
          date,
        ])
        existingRecord = existingResult.rows[0]
      }

      let result

      // If record exists, update it
      if (existingRecord) {
        // Calculate hours worked if both check-in and check-out are provided
        let hoursWorked = null
        if (checkIn && checkOut && status !== "absent") {
          const checkInTime = new Date(checkIn)
          const checkOutTime = new Date(checkOut)
          const diffMs = checkOutTime - checkInTime
          hoursWorked = (diffMs / (1000 * 60 * 60)).toFixed(2)
        }

        result = await db.query(
          `UPDATE attendance 
           SET check_in = $1, check_out = $2, status = $3, hours_worked = $4, 
               corrected_by = $5, correction_time = NOW(), correction_reason = $6
           WHERE id = $7 RETURNING *`,
          [checkIn, checkOut, status, hoursWorked, sessionUser.id, reason, existingRecord.id],
        )
      } else {
        // Create a new record if it doesn't exist
        result = await db.query(
          `INSERT INTO attendance 
           (employee_id, date, check_in, check_out, status, hours_worked, corrected_by, correction_time, correction_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *`,
          [
            employeeId,
            date,
            checkIn,
            checkOut,
            status,
            checkIn && checkOut && status !== "absent"
              ? ((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60)).toFixed(2)
              : null,
            sessionUser.id,
            reason,
          ],
        )
      }

      res.status(200).json({
        message: existingRecord ? "Attendance record updated successfully" : "Attendance record created successfully",
        data: result.rows[0],
      })
    } catch (error) {
      console.error("Error correcting attendance:", error)
      res.status(500).json({ message: "Failed to correct attendance record", error: error.message })
    }
  },
}

module.exports = attendanceController

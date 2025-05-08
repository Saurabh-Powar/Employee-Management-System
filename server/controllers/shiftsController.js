const db = require("../db/sql")

const shiftsController = {
  // Get all shifts (admin and manager only)
  getAllShifts: async (req, res) => {
    try {
      // Verify user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      // Only managers and admins can view all shifts
      if (req.session.user.role !== "manager" && req.session.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized access" })
      }

      const result = await db.query(`
        SELECT s.*, 
               e.first_name, e.last_name, e.department, e.position,
               CONCAT(e.first_name, ' ', e.last_name) as employee_name
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        ORDER BY e.department, e.last_name, e.first_name
      `)

      res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching shifts:", error)
      res.status(500).json({ message: "Failed to fetch shifts", error: error.message })
    }
  },

  // Get shift for a specific employee
  getEmployeeShift: async (req, res) => {
    const { employeeId } = req.params

    try {
      // Verify user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      // Employees can only view their own shifts
      if (req.session.user.role === "employee") {
        // Get the employee record for the current user
        const employeeResult = await db.query("SELECT id FROM employees WHERE user_id = $1", [req.session.user.id])

        if (employeeResult.rows.length === 0) {
          return res.status(404).json({ message: "Employee record not found" })
        }

        const userEmployeeId = employeeResult.rows[0].id

        if (Number(employeeId) !== userEmployeeId) {
          return res.status(403).json({ message: "You can only view your own shift" })
        }
      }

      const result = await db.query("SELECT * FROM shifts WHERE employee_id = $1", [employeeId])

      if (result.rows.length === 0) {
        // Return default shift if none is set
        return res.status(200).json({
          employee_id: Number(employeeId),
          start_time: "09:00",
          end_time: "17:00",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        })
      }

      res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error fetching employee shift:", error)
      res.status(500).json({ message: "Failed to fetch employee shift", error: error.message })
    }
  },

  // Create or update shift (manager and admin only)
  createOrUpdateShift: async (req, res) => {
    const { employee_id, start_time, end_time, days } = req.body

    try {
      // Verify user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      // Only managers and admins can create/update shifts
      if (req.session.user.role !== "manager" && req.session.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized access" })
      }

      // Validate input
      if (!employee_id || !start_time || !end_time || !Array.isArray(days)) {
        return res.status(400).json({ message: "Missing required fields" })
      }

      // Check if shift already exists for this employee
      const existingResult = await db.query("SELECT * FROM shifts WHERE employee_id = $1", [employee_id])

      let result
      if (existingResult.rows.length > 0) {
        // Update existing shift
        result = await db.query(
          `UPDATE shifts 
           SET start_time = $1, end_time = $2, days = $3, updated_at = NOW() 
           WHERE employee_id = $4 
           RETURNING *`,
          [start_time, end_time, days, employee_id],
        )
      } else {
        // Create new shift
        result = await db.query(
          `INSERT INTO shifts (employee_id, start_time, end_time, days) 
           VALUES ($1, $2, $3, $4) 
           RETURNING *`,
          [employee_id, start_time, end_time, days],
        )
      }

      // Create a notification for the employee
      const employeeQuery = await db.query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name
         FROM employees e 
         WHERE e.id = $1`,
        [employee_id],
      )

      if (employeeQuery.rows.length > 0) {
        const employee = employeeQuery.rows[0]

        // Create a notification for the employee
        await db.query(
          `INSERT INTO notifications (
            user_id, sender_id, title, message, type
          )
          VALUES ($1, $2, $3, $4, 'alert')
          ON CONFLICT (user_id, title) DO UPDATE
          SET message = $4, sender_id = $2, is_read = false`,
          [
            employee.user_id,
            req.session.user.id,
            "Shift Schedule Updated",
            `Your work schedule has been updated to ${start_time} - ${end_time}.`,
          ],
        )
      }

      res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error creating/updating shift:", error)
      res.status(500).json({ message: "Failed to create/update shift", error: error.message })
    }
  },

  // Delete shift (manager and admin only)
  deleteShift: async (req, res) => {
    const { employeeId } = req.params

    try {
      // Verify user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      // Only managers and admins can delete shifts
      if (req.session.user.role !== "manager" && req.session.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized access" })
      }

      const result = await db.query("DELETE FROM shifts WHERE employee_id = $1 RETURNING *", [employeeId])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found" })
      }

      res.status(200).json({ message: "Shift deleted successfully" })
    } catch (error) {
      console.error("Error deleting shift:", error)
      res.status(500).json({ message: "Failed to delete shift", error: error.message })
    }
  },
}

module.exports = shiftsController

const db = require("../db/sql")

const shiftsController = {
  // Get all shifts
  getAllShifts: async (req, res) => {
    try {
      const result = await db.query(`
        SELECT s.*, e.first_name, e.last_name, e.department
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        ORDER BY e.department, e.last_name, e.first_name
      `)
      res.json(result.rows)
    } catch (error) {
      console.error("Error fetching shifts:", error)
      res.status(500).json({ message: "Failed to fetch shifts" })
    }
  },

  // Get shift for a specific employee
  getEmployeeShift: async (req, res) => {
    const { employeeId } = req.params

    try {
      const result = await db.query("SELECT * FROM shifts WHERE employee_id = $1", [employeeId])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found for this employee" })
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error("Error fetching employee shift:", error)
      res.status(500).json({ message: "Failed to fetch employee shift" })
    }
  },

  // Create a new shift
  createShift: async (req, res) => {
    const { employee_id, start_time, end_time, days } = req.body

    if (!employee_id || !start_time || !end_time || !days || !Array.isArray(days)) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    try {
      // Check if employee exists
      const employeeCheck = await db.query("SELECT id FROM employees WHERE id = $1", [employee_id])

      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({ message: "Employee not found" })
      }

      // Check if shift already exists for this employee
      const shiftCheck = await db.query("SELECT id FROM shifts WHERE employee_id = $1", [employee_id])

      if (shiftCheck.rows.length > 0) {
        return res.status(409).json({ message: "Shift already exists for this employee" })
      }

      // Create new shift
      const result = await db.query(
        `INSERT INTO shifts (employee_id, start_time, end_time, days)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [employee_id, start_time, end_time, days],
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error creating shift:", error)
      res.status(500).json({ message: "Failed to create shift" })
    }
  },

  // Update a shift
  updateShift: async (req, res) => {
    const { employeeId } = req.params
    const { start_time, end_time, days } = req.body

    if (!start_time || !end_time || !days || !Array.isArray(days)) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    try {
      // Check if shift exists
      const shiftCheck = await db.query("SELECT id FROM shifts WHERE employee_id = $1", [employeeId])

      if (shiftCheck.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found for this employee" })
      }

      // Update shift
      const result = await db.query(
        `UPDATE shifts
         SET start_time = $1, end_time = $2, days = $3, updated_at = NOW()
         WHERE employee_id = $4
         RETURNING *`,
        [start_time, end_time, days, employeeId],
      )

      res.json(result.rows[0])
    } catch (error) {
      console.error("Error updating shift:", error)
      res.status(500).json({ message: "Failed to update shift" })
    }
  },

  // Delete a shift
  deleteShift: async (req, res) => {
    const { employeeId } = req.params

    try {
      // Check if shift exists
      const shiftCheck = await db.query("SELECT id FROM shifts WHERE employee_id = $1", [employeeId])

      if (shiftCheck.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found for this employee" })
      }

      // Delete shift
      await db.query("DELETE FROM shifts WHERE employee_id = $1", [employeeId])

      res.json({ message: "Shift deleted successfully" })
    } catch (error) {
      console.error("Error deleting shift:", error)
      res.status(500).json({ message: "Failed to delete shift" })
    }
  },
}

module.exports = shiftsController

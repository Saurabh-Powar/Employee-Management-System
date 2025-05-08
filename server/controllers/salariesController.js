const db = require("../db/sql")

const salariesController = {
  // Get all salary records (admin and manager only)
  getAllSalaryRecords: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
      return res.status(403).json({ message: "Unauthorized access" })
    }

    try {
      // Get all salaries with employee details and work days
      const result = await db.query(`
        SELECT s.*, e.first_name, e.last_name, e.department, e.position,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        (
          SELECT COUNT(*) 
          FROM attendance a 
          WHERE a.employee_id = s.employee_id AND a.status = 'check-out'
          AND EXTRACT(MONTH FROM a.date) = s.month
          AND EXTRACT(YEAR FROM a.date) = s.year
        ) as work_days,
        (
          SELECT COALESCE(SUM(a.hours_worked), 0)
          FROM attendance a 
          WHERE a.employee_id = s.employee_id AND a.status = 'check-out'
          AND EXTRACT(MONTH FROM a.date) = s.month
          AND EXTRACT(YEAR FROM a.date) = s.year
        ) as total_hours
        FROM salaries s
        JOIN employees e ON s.employee_id = e.id
        ORDER BY s.year DESC, s.month DESC
      `)
      return res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching salary records:", error)
      return res.status(500).json({
        message: "Failed to fetch salary records",
        details: error.message,
      })
    }
  },

  // Get salary records for a specific employee (manager, admin, or employee themselves)
  getEmployeeSalaryRecords: async (req, res) => {
    const sessionUser = req.session.user
    const { employeeId } = req.params

    if (!sessionUser) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    // Only managers, admins, or the employee themselves can access the data
    if (
      sessionUser.role !== "manager" &&
      sessionUser.role !== "admin" &&
      Number.parseInt(employeeId) !== sessionUser.id
    ) {
      return res.status(403).json({ message: "Unauthorized access" })
    }

    try {
      const result = await db.query(
        `
        SELECT s.*, e.first_name, e.last_name, e.department, e.position,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        (
          SELECT COUNT(*) 
          FROM attendance a 
          WHERE a.employee_id = s.employee_id AND a.status = 'check-out'
          AND EXTRACT(MONTH FROM a.date) = s.month
          AND EXTRACT(YEAR FROM a.date) = s.year
        ) as work_days,
        (
          SELECT COALESCE(SUM(a.hours_worked), 0)
          FROM attendance a 
          WHERE a.employee_id = s.employee_id AND a.status = 'check-out'
          AND EXTRACT(MONTH FROM a.date) = s.month
          AND EXTRACT(YEAR FROM a.date) = s.year
        ) as total_hours
        FROM salaries s
        JOIN employees e ON s.employee_id = e.id
        WHERE s.employee_id = $1
        ORDER BY s.year DESC, s.month DESC
      `,
        [employeeId],
      )

      return res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching employee salary records:", error)
      return res.status(500).json({
        message: "Failed to fetch employee salary records",
        details: error.message,
      })
    }
  },

  // Create a new salary record (manager only)
  createSalaryRecord: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser || sessionUser.role !== "manager") {
      return res.status(403).json({
        message: "Unauthorized access",
        details: "Only managers can create salary records.",
      })
    }

    const {
      employee_id,
      month,
      year,
      base_amount,
      overtime_amount = 0,
      deductions = 0,
      total_amount,
      status,
      payment_date,
    } = req.body

    if (!employee_id || !month || !year || base_amount === undefined || total_amount === undefined || !status) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    try {
      const existing = await db.query("SELECT * FROM salaries WHERE employee_id = $1 AND month = $2 AND year = $3", [
        employee_id,
        month,
        year,
      ])

      if (existing.rows.length > 0) {
        return res.status(400).json({
          message: "Salary already exists for this employee in the selected period",
        })
      }

      // Get work days and hours for this employee in the given month/year
      const workDaysQuery = await db.query(
        `
        SELECT COUNT(*) as work_days, COALESCE(SUM(hours_worked), 0) as total_hours
        FROM attendance
        WHERE employee_id = $1 AND status = 'check-out'
        AND EXTRACT(MONTH FROM date) = $2
        AND EXTRACT(YEAR FROM date) = $3
      `,
        [employee_id, month, year],
      )

      const workDays = Number.parseInt(workDaysQuery.rows[0]?.work_days || 0)
      const totalHours = Number.parseFloat(workDaysQuery.rows[0]?.total_hours || 0)

      const result = await db.query(
        `INSERT INTO salaries (
          employee_id, month, year, base_amount,
          overtime_amount, deductions, total_amount,
          status, payment_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [employee_id, month, year, base_amount, overtime_amount, deductions, total_amount, status, payment_date],
      )

      // Add work days and hours to the response
      const salaryRecord = {
        ...result.rows[0],
        work_days: workDays,
        total_hours: totalHours,
      }

      return res.status(201).json(salaryRecord)
    } catch (error) {
      console.error("Error creating salary record:", error)
      return res.status(500).json({
        message: "Failed to create salary record",
        details: error.message,
      })
    }
  },

  // Update salary record status (manager only)
  updateSalaryRecordStatus: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser || sessionUser.role !== "manager") {
      return res.status(403).json({ message: "Unauthorized access" })
    }

    const { id } = req.params
    const { status } = req.body

    if (!status || !["pending", "processed", "paid"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" })
    }

    try {
      const result = await db.query("UPDATE salaries SET status = $1 WHERE id = $2 RETURNING *", [status, id])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Salary record not found" })
      }

      return res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error updating salary status:", error)
      return res.status(500).json({
        message: "Failed to update salary record status",
        details: error.message,
      })
    }
  },
}

module.exports = salariesController

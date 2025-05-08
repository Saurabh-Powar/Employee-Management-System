const db = require("../db/sql") // Ensure correct import path

// Function to create a new leave record
const createLeave = async (req, res) => {
  const { employee_id, start_date, end_date, reason } = req.body

  if (!employee_id || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: "All fields are required." })
  }

  // Check if dates are valid
  const startDate = new Date(start_date)
  const endDate = new Date(end_date)

  if (isNaN(startDate) || isNaN(endDate)) {
    return res.status(400).json({ error: "Invalid date format." })
  }

  if (startDate > endDate) {
    return res.status(400).json({ error: "Start date cannot be after end date." })
  }

  // Ensure employee is creating their own leave record or manager is creating it
  if (req.session.user.role === "employee" && req.session.user.id !== Number(employee_id)) {
    return res.status(403).json({ error: "You can only create leave for yourself." })
  }

  try {
    const result = await db.query(
      `
      INSERT INTO leaves (employee_id, start_date, end_date, reason, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, employee_id, start_date, end_date, reason, status, created_at
    `,
      [employee_id, start_date, end_date, reason],
    )

    return res.status(201).json({
      message: "Leave request created successfully",
      leave: result.rows[0],
    })
  } catch (err) {
    console.error("Error creating leave record:", err)
    return res.status(500).json({ error: "Failed to create leave request", details: err.message })
  }
}

// Function to get all leaves for an employee
const getLeavesByEmployee = async (req, res) => {
  const { employeeId } = req.params

  // Ensure employee can only view their own leaves or manager/admin can view any
  if (req.session.user.role === "employee" && req.session.user.id !== Number(employeeId)) {
    return res.status(403).json({ error: "You can only view your own leaves." })
  }

  try {
    const result = await db.query(
      `
      SELECT l.id, l.employee_id, l.start_date, l.end_date, l.reason, l.status, l.created_at,
             e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.employee_id = $1
      ORDER BY l.start_date DESC
    `,
      [employeeId],
    )

    return res.status(200).json({
      message: "Leaves fetched successfully",
      leaves: result.rows,
    })
  } catch (err) {
    console.error("Error fetching leaves:", err)
    return res.status(500).json({ error: "Failed to fetch leaves", details: err.message })
  }
}

// Function to update the leave status (approve/reject)
const updateLeaveStatus = async (req, res) => {
  if (!req.session.user || (req.session.user.role !== "manager" && req.session.user.role !== "admin")) {
    return res.status(403).json({ error: "Unauthorized", details: "You do not have permission to update leave status" })
  }

  const { id: leave_id } = req.params
  const { status } = req.body // 'approved' or 'rejected'

  if (!status || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" })
  }

  try {
    // First, get the leave request to check if it exists and get employee_id
    const leaveCheck = await db.query("SELECT * FROM leaves WHERE id = $1", [leave_id])

    if (leaveCheck.rows.length === 0) {
      return res.status(404).json({ error: "Leave record not found" })
    }

    const leaveRecord = leaveCheck.rows[0]

    // Check if the manager can approve this leave
    // If the leave is from a manager, only admin can approve
    const employeeCheck = await db.query(
      `SELECT e.*, u.role FROM employees e 
       JOIN users u ON e.user_id = u.id 
       WHERE e.id = $1`,
      [leaveRecord.employee_id],
    )

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" })
    }

    const employee = employeeCheck.rows[0]

    // If employee is a manager and approver is not admin, reject
    if (employee.role === "manager" && req.session.user.role !== "admin") {
      return res.status(403).json({
        error: "Unauthorized",
        details: "Only admins can approve/reject manager leave requests",
      })
    }

    // Update the leave status
    const result = await db.query(
      `
      UPDATE leaves
      SET status = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3
      RETURNING id, employee_id, start_date, end_date, reason, status, created_at
    `,
      [status, req.session.user.id, leave_id],
    )

    // Create a notification for the employee
    const statusText = status === "approved" ? "approved" : "rejected"

    await db.query(
      `
      INSERT INTO notifications (user_id, sender_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, title) DO UPDATE
      SET message = $4, sender_id = $2, is_read = false
    `,
      [
        employee.user_id,
        req.session.user.id,
        `Leave Request ${statusText}`,
        `Your leave request from ${new Date(leaveRecord.start_date).toLocaleDateString()} to ${new Date(
          leaveRecord.end_date,
        ).toLocaleDateString()} has been ${statusText}.`,
        "alert",
      ],
    )

    // If leave is approved, update the attendance records for those dates
    if (status === "approved") {
      // Calculate date range
      const start = new Date(leaveRecord.start_date)
      const end = new Date(leaveRecord.end_date)
      const dates = []

      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        dates.push(new Date(dt).toISOString().split("T")[0])
      }

      // Mark all dates as absent due to approved leave
      for (const date of dates) {
        try {
          // Check if an attendance record already exists for this date
          const existingCheck = await db.query("SELECT * FROM attendance WHERE employee_id = $1 AND date = $2", [
            leaveRecord.employee_id,
            date,
          ])

          if (existingCheck.rows.length === 0) {
            // Create an 'absent' record for this date
            await db.query("INSERT INTO attendance (employee_id, date, status) VALUES ($1, $2, $3)", [
              leaveRecord.employee_id,
              date,
              "absent",
            ])
          }
        } catch (err) {
          console.error(`Error marking attendance for approved leave on ${date}:`, err)
          // Continue with other dates even if one fails
        }
      }
    }

    return res.status(200).json({
      message: "Leave status updated successfully",
      leave: result.rows[0],
    })
  } catch (err) {
    console.error("Error updating leave status:", err)
    return res.status(500).json({ error: "Failed to update leave status", details: err.message })
  }
}

// Function to get all leaves (Manager/Admin view)
const getAllLeaves = async (req, res) => {
  if (!req.session.user || (req.session.user.role !== "manager" && req.session.user.role !== "admin")) {
    return res.status(403).json({ error: "Unauthorized", details: "You do not have permission to view all leaves" })
  }

  try {
    const result = await db.query(`
      SELECT l.id, l.employee_id, l.start_date, l.end_date, l.reason, l.status, l.created_at,
             e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.department, e.position, u.role as employee_role
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      ORDER BY l.created_at DESC
    `)

    return res.status(200).json({
      message: "All leaves fetched successfully",
      leaves: result.rows,
    })
  } catch (err) {
    console.error("Error fetching all leaves:", err)
    return res.status(500).json({ error: "Failed to fetch all leaves", details: err.message })
  }
}

// Function to delete a leave record
const deleteLeave = async (req, res) => {
  if (!req.session.user || (req.session.user.role !== "manager" && req.session.user.role !== "admin")) {
    return res
      .status(403)
      .json({ error: "Unauthorized", details: "You do not have permission to delete a leave record" })
  }

  const { id: leave_id } = req.params

  try {
    const result = await db.query(
      `
      DELETE FROM leaves
      WHERE id = $1
      RETURNING id
    `,
      [leave_id],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Leave record not found" })
    }

    return res.status(200).json({ message: "Leave record deleted successfully" })
  } catch (err) {
    console.error("Error deleting leave record:", err)
    return res.status(500).json({ error: "Failed to delete leave record", details: err.message })
  }
}

module.exports = {
  createLeave,
  getLeavesByEmployee,
  updateLeaveStatus,
  getAllLeaves,
  deleteLeave,
}

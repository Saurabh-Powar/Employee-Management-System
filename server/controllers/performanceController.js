const db = require("../db/sql")

const performanceController = {
  // Get all performance evaluations (manager only)
  getAllPerformanceEvaluations: async (req, res) => {
    const sessionUser = req.session.user

    // Ensure the user is authenticated and a manager or admin
    if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
      return res.status(403).json({ message: "Unauthorized access" })
    }

    try {
      const result = await db.query("SELECT * FROM performance ORDER BY evaluation_date DESC")
      return res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching performance evaluations:", error)
      return res.status(500).json({
        message: "Failed to fetch performance evaluations",
        details: error.message,
      })
    }
  },

  // Get performance evaluations for the logged-in employee
  getEmployeePerformanceEvaluations: async (req, res) => {
    const sessionUser = req.session.user

    // Ensure the user is authenticated
    if (!sessionUser) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const { employeeId } = req.params

    // Managers and admins can view anyone's evaluations, employees can only view their own
    if (
      sessionUser.role !== "manager" &&
      sessionUser.role !== "admin" &&
      Number.parseInt(employeeId) !== sessionUser.id
    ) {
      return res.status(403).json({ message: "Unauthorized access" })
    }

    try {
      const result = await db.query("SELECT * FROM performance WHERE employee_id = $1 ORDER BY evaluation_date DESC", [
        employeeId,
      ])
      return res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching employee performance evaluations:", error)
      return res.status(500).json({
        message: "Failed to fetch employee performance evaluations",
        details: error.message,
      })
    }
  },

  // Create a new performance evaluation (manager or admin only)
  createPerformanceEvaluation: async (req, res) => {
    const sessionUser = req.session.user

    // Ensure the user is authenticated and a manager or admin
    if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
      return res.status(403).json({
        message: "Unauthorized access",
        details: "Only managers and admins can create performance evaluations.",
      })
    }

    const { employee_id, evaluation_date, rating, comments } = req.body

    // Check if all required fields are provided
    if (!employee_id || !evaluation_date || rating === undefined || !comments) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    try {
      const result = await db.query(
        "INSERT INTO performance (employee_id, evaluation_date, rating, comments, evaluated_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [employee_id, evaluation_date, rating, comments, sessionUser.id],
      )
      return res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error creating performance evaluation:", error)
      return res.status(500).json({
        message: "Failed to create performance evaluation",
        details: error.message,
      })
    }
  },
}

module.exports = performanceController

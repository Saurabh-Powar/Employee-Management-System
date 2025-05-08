const db = require("../db/sql")

const employeesController = {
  // Get all employees
  getAllEmployees: async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM employees ORDER BY id")
      res.json(result.rows)
    } catch (error) {
      console.error("Error fetching employees:", error)
      res.status(500).json({ message: "Failed to fetch employees" })
    }
  },

  // Get current employee based on logged-in user
  getCurrentEmployee: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: "Authentication required" })
      }

      const userId = req.session.user.id
      const result = await db.query("SELECT * FROM employees WHERE user_id = $1", [userId])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Employee record not found" })
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error("Error fetching current employee:", error)
      res.status(500).json({ message: "Failed to fetch current employee" })
    }
  },

  // Get employee by ID
  getEmployeeById: async (req, res) => {
    const { id } = req.params
    try {
      const result = await db.query("SELECT * FROM employees WHERE id = $1", [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Employee not found" })
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error("Error fetching employee:", error)
      res.status(500).json({ message: "Failed to fetch employee" })
    }
  },

  // Create new employee (admin only)
  createEmployee: async (req, res) => {
    const { user_id, first_name, last_name, position, department, hire_date, salary } = req.body

    try {
      const result = await db.query(
        "INSERT INTO employees (user_id, first_name, last_name, position, department, hire_date, salary) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [user_id, first_name, last_name, position, department, hire_date, salary],
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error creating employee:", error)
      res.status(500).json({ message: "Failed to create employee" })
    }
  },

  // Update employee (admin only)
  updateEmployee: async (req, res) => {
    const { id } = req.params
    const { first_name, last_name, position, department, hire_date, salary } = req.body

    try {
      const result = await db.query(
        "UPDATE employees SET first_name = $1, last_name = $2, position = $3, department = $4, hire_date = $5, salary = $6 WHERE id = $7 RETURNING *",
        [first_name, last_name, position, department, hire_date, salary, id],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Employee not found" })
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error("Error updating employee:", error)
      res.status(500).json({ message: "Failed to update employee" })
    }
  },

  // Delete employee (admin only)
  deleteEmployee: async (req, res) => {
    const { id } = req.params

    try {
      const result = await db.query("DELETE FROM employees WHERE id = $1 RETURNING *", [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Employee not found" })
      }

      res.json({ message: "Employee deleted successfully" })
    } catch (error) {
      console.error("Error deleting employee:", error)
      res.status(500).json({ message: "Failed to delete employee" })
    }
  },
}

module.exports = employeesController

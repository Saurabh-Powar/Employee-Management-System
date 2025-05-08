const express = require("express")
const router = express.Router()
const employeesController = require("../controllers/employeesController")
const auth = require("../middleware/authMiddleware")

// Get all employees
router.get("/", auth.isAuthenticated, employeesController.getAllEmployees)

// Get current employee based on logged-in user
router.get("/current", auth.isAuthenticated, employeesController.getCurrentEmployee)

// Get employee by ID
router.get("/:id", auth.isAuthenticated, auth.isSelfOrManagerOrAdmin, employeesController.getEmployeeById)

// Create new employee (admin only)
router.post("/", auth.isAuthenticated, auth.isAdmin, employeesController.createEmployee)

// Update employee (admin only)
router.put("/:id", auth.isAuthenticated, auth.isAdmin, employeesController.updateEmployee)

// Delete employee (admin only)
router.delete("/:id", auth.isAuthenticated, auth.isAdmin, employeesController.deleteEmployee)

module.exports = router

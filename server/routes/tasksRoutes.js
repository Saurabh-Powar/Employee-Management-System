const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware.isAuthenticated); // Use isAuthenticated middleware

// Get all tasks
router.get('/', tasksController.getAllTasks);

// Get tasks by employee ID
router.get('/employee/:employeeId', tasksController.getTasksByEmployee);

// Get task by ID
router.get('/:id', tasksController.getTaskById);

// Create new task
router.post('/', authMiddleware.isManager, tasksController.createTask);

// Update task
router.put('/:id', authMiddleware.isManager, tasksController.updateTask);

// Update task status
router.put('/:id/status', tasksController.updateTaskStatus);

// Delete task
router.delete('/:id', authMiddleware.isManager, tasksController.deleteTask);

// Get task statistics
router.get('/statistics/summary', authMiddleware.isManager, tasksController.getTaskStatistics);

module.exports = router;
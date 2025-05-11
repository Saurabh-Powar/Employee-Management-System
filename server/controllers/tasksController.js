const pool = require("../db/sql").pool
const websocket = require("../websocket")

// Helper function to safely emit WebSocket events
const safeEmit = (event, data, room = null) => {
  return websocket.safeEmit(event, data, room)
}

// Function to map database status to UI status
const mapToUiStatus = (dbStatus) => {
  switch (dbStatus) {
    case "pending":
      return "To Do"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Done"
    case "blocked":
      return "Blocked"
    default:
      return "To Do" // Default case
  }
}

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT t.*, e.first_name, e.last_name FROM tasks t LEFT JOIN employees e ON t.employee_id = e.id ORDER BY t.created_at DESC",
    )
    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    res.status(500).json({ error: "Failed to fetch tasks", details: error.message })
  }
}

// Get tasks for a specific employee
const getEmployeeTasks = async (req, res) => {
  const employeeId = req.params.employeeId

  try {
    const result = await pool.query(
      "SELECT t.*, e.first_name, e.last_name FROM tasks t LEFT JOIN employees e ON t.assigned_by = e.id WHERE t.employee_id = $1 ORDER BY t.created_at DESC",
      [employeeId],
    )
    res.json(result.rows)
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId}:`, error)
    res.status(500).json({ error: "Failed to fetch employee tasks", details: error.message })
  }
}

// Get tasks by manager ID
const getManagerTasks = async (req, res) => {
  const { managerId } = req.params

  try {
    const result = await pool.query(
      "SELECT t.*, e.first_name || ' ' || e.last_name as employee_name FROM tasks t JOIN employees e ON t.assigned_to = e.id WHERE t.created_by = $1 ORDER BY t.due_date ASC",
      [managerId],
    )

    // Map DB statuses to UI statuses
    const tasksWithUiStatus = result.rows.map((task) => ({
      ...task,
      ui_status: mapToUiStatus(task.status),
      status: task.status, // Keep the original DB status
    }))

    res.json(tasksWithUiStatus)
  } catch (error) {
    console.error(`Error fetching tasks for manager ${managerId}:`, error)
    res.status(500).json({ error: "Failed to fetch manager tasks" })
  }
}

// Create a new task
const createTask = async (req, res) => {
  const { title, description, employeeId, assignedBy, dueDate, priority } = req.body

  try {
    // Insert the new task
    const result = await pool.query(
      "INSERT INTO tasks (title, description, employee_id, assigned_by, due_date, priority, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *",
      [title, description, employeeId, assignedBy, dueDate, priority],
    )

    const newTask = result.rows[0]

    // Get employee details for the notification
    const employeeResult = await pool.query("SELECT first_name, last_name FROM employees WHERE id = $1", [employeeId])

    if (employeeResult.rows.length > 0) {
      const employee = employeeResult.rows[0]

      // Create a notification for the employee
      await pool.query(
        "INSERT INTO notifications (employee_id, sender_id, title, message, type) VALUES ($1, $2, $3, $4, 'task')",
        [employeeId, assignedBy, "New Task Assigned", `You have been assigned a new task: ${title}`],
      )

      // Emit WebSocket event to notify the employee
      safeEmit("task_assigned", newTask, `user:${employeeId}`)
    }

    res.status(201).json(newTask)
  } catch (error) {
    console.error("Error creating task:", error)
    res.status(500).json({ error: "Failed to create task", details: error.message })
  }
}

// Update a task
const updateTask = async (req, res) => {
  const taskId = req.params.taskId
  const { title, description, employeeId, dueDate, priority, status } = req.body

  try {
    // Get the current task to check for status changes
    const currentTaskResult = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId])

    if (currentTaskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    const currentTask = currentTaskResult.rows[0]

    // Update the task
    const result = await pool.query(
      "UPDATE tasks SET title = $1, description = $2, employee_id = $3, due_date = $4, priority = $5, status = $6 WHERE id = $7 RETURNING *",
      [title, description, employeeId, dueDate, priority, status, taskId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    const updatedTask = result.rows[0]

    // If the status changed, create a notification
    if (currentTask.status !== status) {
      // Get the manager/admin who should be notified
      const managerResult = await pool.query("SELECT id FROM employees WHERE id = $1", [currentTask.assigned_by])

      if (managerResult.rows.length > 0) {
        const managerId = managerResult.rows[0].id

        // Create a notification for the manager
        await pool.query(
          "INSERT INTO notifications (employee_id, sender_id, title, message, type) VALUES ($1, $2, $3, $4, 'task')",
          [managerId, employeeId, "Task Status Updated", `Task "${title}" has been updated to ${status}`],
        )

        // Emit WebSocket event to notify the manager
        safeEmit("task_updated", updatedTask, `user:${managerId}`)
      }
    }

    // Emit WebSocket event to notify all relevant parties
    safeEmit("task_updated", updatedTask)

    res.json(updatedTask)
  } catch (error) {
    console.error(`Error updating task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to update task", details: error.message })
  }
}

// Delete a task
const deleteTask = async (req, res) => {
  const taskId = req.params.taskId

  try {
    // Get the task before deleting it
    const taskResult = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId])

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    const task = taskResult.rows[0]

    // Delete the task
    await pool.query("DELETE FROM tasks WHERE id = $1", [taskId])

    // Emit WebSocket event to notify relevant parties
    safeEmit("task_deleted", { id: taskId, title: task.title })

    res.json({ message: "Task deleted successfully", id: taskId })
  } catch (error) {
    console.error(`Error deleting task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to delete task", details: error.message })
  }
}

// Delete a task
const getTaskById = async (req, res) => {
  const { taskId } = req.params

  try {
    const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    const task = {
      ...result.rows[0],
      ui_status: mapToUiStatus(result.rows[0].status),
    }

    res.json(task)
  } catch (error) {
    console.error(`Error fetching task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to fetch task" })
  }
}

// Start task timer
const startTaskTimer = async (req, res) => {
  const { taskId } = req.params

  try {
    // Check if task exists
    const taskCheck = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId])

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Create a new timer record
    const result = await pool.query("INSERT INTO task_timers (task_id, start_time) VALUES ($1, NOW()) RETURNING *", [
      taskId,
    ])

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error(`Error starting timer for task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to start task timer" })
  }
}

// Stop task timer
const stopTaskTimer = async (req, res) => {
  const { taskId } = req.params

  try {
    // Find the most recent active timer for this task
    const timerCheck = await pool.query(
      "SELECT * FROM task_timers WHERE task_id = $1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
      [taskId],
    )

    if (timerCheck.rows.length === 0) {
      return res.status(404).json({ error: "No active timer found for this task" })
    }

    const timerId = timerCheck.rows[0].id

    // Update the timer with end time and calculate duration
    const result = await pool.query(
      `UPDATE task_timers 
       SET end_time = NOW(), 
           duration = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
       WHERE id = $1 
       RETURNING *`,
      [timerId],
    )

    const updatedTimer = result.rows[0]

    // Update the task's total time spent
    await pool.query(
      `UPDATE tasks 
       SET time_spent = COALESCE(time_spent, 0) + $1 
       WHERE id = $2`,
      [updatedTimer.duration, taskId],
    )

    res.json(updatedTimer)
  } catch (error) {
    console.error(`Error stopping timer for task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to stop task timer" })
  }
}

// Get task timer history
const getTaskTimerHistory = async (req, res) => {
  const { taskId } = req.params

  try {
    const result = await pool.query("SELECT * FROM task_timers WHERE task_id = $1 ORDER BY start_time DESC", [taskId])

    res.json(result.rows)
  } catch (error) {
    console.error(`Error fetching timer history for task ${taskId}:`, error)
    res.status(500).json({ error: "Failed to fetch task timer history" })
  }
}

// Export all controller functions
module.exports = {
  getAllTasks,
  getEmployeeTasks,
  getManagerTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  startTaskTimer,
  stopTaskTimer,
  getTaskTimerHistory,
}

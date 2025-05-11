"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { subscribeToEvent } from "../services/websocket"
import { mapToDbValue, taskStatusMapping } from "../utils/statusMappings.js"
import TaskForm from "./TaskForm"
import TaskTimer from "./TaskTimer"
import "./TaskListS.css"

const TaskList = ({ role }) => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [activeTimers, setActiveTimers] = useState({})
  const [filter, setFilter] = useState("all")

  // Add confirmation dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmData, setConfirmData] = useState(null)
  const [confirmMessage, setConfirmMessage] = useState("")

  // Status display mapping for UI
  const statusDisplay = {
    pending: "Pending",
    in_progress: "In Progress",
    pending_completion: "Pending Approval",
    completed: "Completed",
    cancelled: "Cancelled",
  }

  // Status colors for UI
  const statusColors = {
    pending: "#f0ad4e",
    in_progress: "#5bc0de",
    pending_completion: "#6f42c1",
    completed: "#5cb85c",
    cancelled: "#d9534f",
  }

  // Priority display and colors
  const priorityDisplay = {
    low: "Low",
    medium: "Medium",
    high: "High",
  }

  const priorityColors = {
    low: "#5cb85c",
    medium: "#f0ad4e",
    high: "#d9534f",
  }

  // Add a function to check if a status transition is valid
  const isValidStatusTransition = (currentStatus, newStatus) => {
    // Define allowed transitions
    const allowedTransitions = {
      pending: ["in_progress", "cancelled"],
      in_progress: ["pending_completion", "cancelled"],
      pending_completion: ["in_progress", "completed", "cancelled"],
      completed: ["in_progress", "cancelled"], // Allow reopening completed tasks
      cancelled: ["pending"], // Allow reopening cancelled tasks
    }

    // Map UI status to DB status
    const dbCurrentStatus = mapToDbValue(currentStatus, taskStatusMapping)
    const dbNewStatus = mapToDbValue(newStatus, taskStatusMapping)

    // Check if the current status exists in allowedTransitions and if the new status is in the allowed transitions array
    return allowedTransitions[dbCurrentStatus] && allowedTransitions[dbCurrentStatus].includes(dbNewStatus)
  }

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      let response

      if (role === "admin") {
        response = await api.get("/tasks")
      } else if (role === "manager") {
        response = await api.get(`/tasks/manager/${user.id}`)
      } else {
        response = await api.get(`/tasks/employee/${user.id}`)
      }

      // Use UI status if available, otherwise use DB status
      const tasksWithStatus = response.data.map((task) => ({
        ...task,
        status: task.ui_status || task.status,
      }))

      setTasks(tasksWithStatus)
      setError(null)
    } catch (err) {
      console.error("Error fetching tasks:", err)
      setError("Failed to load tasks. Please try again later.")
    } finally {
      setLoading(false)
    }
  }, [role, user])

  useEffect(() => {
    if (user && user.id) {
      fetchTasks()
    }
  }, [user, fetchTasks])

  useEffect(() => {
    // Subscribe to WebSocket events
    const taskCreatedUnsub = subscribeToEvent("task-created", (newTask) => {
      if (
        (role === "employee" && newTask.assigned_to === user.id) ||
        (role === "manager" && newTask.created_by === user.id) ||
        role === "admin"
      ) {
        setTasks((prevTasks) => {
          // Check if task already exists
          const exists = prevTasks.some((task) => task.id === newTask.id)
          if (exists) {
            return prevTasks
          }
          return [...prevTasks, { ...newTask, status: newTask.ui_status || newTask.status }]
        })
      }
    })

    const taskUpdatedUnsub = subscribeToEvent("task-updated", (updatedTask) => {
      if (
        (role === "employee" && updatedTask.assigned_to === user.id) ||
        (role === "manager" && updatedTask.created_by === user.id) ||
        role === "admin"
      ) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === updatedTask.id ? { ...updatedTask, status: updatedTask.ui_status || updatedTask.status } : task,
          ),
        )
      }
    })

    const taskDeletedUnsub = subscribeToEvent("task-deleted", (deletedTask) => {
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== deletedTask.id))
    })

    // Cleanup subscriptions
    return () => {
      taskCreatedUnsub()
      taskUpdatedUnsub()
      taskDeletedUnsub()
    }
  }, [role, user])

  const handleCreateTask = async (taskData) => {
    try {
      await api.post("/tasks", {
        ...taskData,
        created_by: user.id,
      })
      setShowForm(false)
      fetchTasks()
    } catch (err) {
      console.error("Error creating task:", err)
      setError("Failed to create task. Please try again.")
    }
  }

  const handleUpdateTask = async (taskData) => {
    try {
      await api.put(`/tasks/${editingTask.id}`, taskData)
      setShowForm(false)
      setEditingTask(null)
      fetchTasks()
    } catch (err) {
      console.error("Error updating task:", err)
      setError("Failed to update task. Please try again.")
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await api.delete(`/tasks/${taskId}`)
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId))
      } catch (err) {
        console.error("Error deleting task:", err)
        setError("Failed to delete task. Please try again.")
      }
    }
  }

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, {
        status: mapToDbValue(newStatus, taskStatusMapping),
        employee_id: user.id,
      })

      // Update local state immediately for better UX
      setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)))
    } catch (err) {
      console.error("Error updating task status:", err)
      setError("Failed to update task status. Please try again.")
      // Revert the optimistic update
      fetchTasks()
    }
  }

  const handleStartTimer = (taskId) => {
    setActiveTimers((prev) => ({
      ...prev,
      [taskId]: true,
    }))

    // If task is pending, change status to in_progress
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status === "pending") {
      handleStatusChange(taskId, "in_progress")
    }
  }

  const handleStopTimer = (taskId, timeSpent) => {
    setActiveTimers((prev) => {
      const newTimers = { ...prev }
      delete newTimers[taskId]
      return newTimers
    })

    console.log(`Task ${taskId} timer stopped. Time spent: ${timeSpent} seconds`)
    // Here you could update the task with the time spent
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowForm(true)
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true
    return task.status === filter
  })

  if (loading && tasks.length === 0) {
    return <div className="loading">Loading tasks...</div>
  }

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h2>Tasks Management</h2>
        <div className="task-controls">
          <div className="filter-controls">
            <label htmlFor="status-filter">Filter by status:</label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="status-filter"
            >
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_completion">Pending Approval</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {(role === "admin" || role === "manager") && (
            <button
              className="create-task-btn"
              onClick={() => {
                setEditingTask(null)
                setShowForm(true)
              }}
              aria-label="Create new task"
              title="Create new task"
            >
              Create Task
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="task-form-overlay">
          <div className="task-form-container">
            <button
              className="close-form-btn"
              onClick={() => {
                setShowForm(false)
                setEditingTask(null)
              }}
              aria-label="Close form"
              title="Close form"
            >
              ×
            </button>
            <TaskForm
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              initialData={editingTask}
              formTitle={editingTask ? "Edit Task" : "Create New Task"}
            />
          </div>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="no-tasks">
          <p>No tasks found. {filter !== "all" ? "Try changing the filter." : ""}</p>
        </div>
      ) : (
        <div className="tasks-grid">
          {filteredTasks.map((task) => (
            <div key={task.id} className="task-card">
              <div className="task-header">
                <h3 className="task-title">{task.title}</h3>
                <div className="task-priority" style={{ backgroundColor: priorityColors[task.priority] }}>
                  {priorityDisplay[task.priority]}
                </div>
              </div>

              <div className="task-description">{task.description}</div>

              <div className="task-details">
                <div className="task-detail">
                  <span className="detail-label">Due Date:</span>
                  <span className="detail-value">{new Date(task.due_date).toLocaleDateString()}</span>
                </div>

                <div className="task-detail">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value status-badge" style={{ backgroundColor: statusColors[task.status] }}>
                    {statusDisplay[task.status]}
                  </span>
                </div>

                {task.estimated_hours && (
                  <div className="task-detail">
                    <span className="detail-label">Est. Hours:</span>
                    <span className="detail-value">{task.estimated_hours}</span>
                  </div>
                )}
              </div>

              <div className="task-actions">
                {role === "employee" && task.status !== "completed" && task.status !== "cancelled" && (
                  <>
                    {task.status === "in_progress" && (
                      <button
                        className="task-action-btn request-completion"
                        onClick={() => handleStatusChange(task.id, "pending_completion")}
                        aria-label="Request completion approval"
                        title="Request completion approval"
                      >
                        Request Approval
                      </button>
                    )}

                    {task.status === "pending" && (
                      <button
                        className="task-action-btn start-task"
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                        aria-label="Start task"
                        title="Start task"
                      >
                        Start Task
                      </button>
                    )}

                    {!activeTimers[task.id] && task.status === "in_progress" && (
                      <button
                        className="task-action-btn start-timer"
                        onClick={() => handleStartTimer(task.id)}
                        aria-label="Start timer"
                        title="Start timer"
                      >
                        Start Timer
                      </button>
                    )}
                  </>
                )}

                {(role === "admin" || role === "manager") && (
                  <>
                    <button
                      className="task-action-btn edit-task"
                      onClick={() => handleEditTask(task)}
                      aria-label="Edit task"
                      title="Edit task"
                    >
                      Edit
                    </button>

                    <button
                      className="task-action-btn delete-task"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label="Delete task"
                      title="Delete task"
                    >
                      Delete
                    </button>

                    {task.status === "pending_completion" && (
                      <button
                        className="task-action-btn approve-task"
                        onClick={() => handleStatusChange(task.id, "completed")}
                        aria-label="Approve completion"
                        title="Approve completion"
                      >
                        Approve
                      </button>
                    )}
                  </>
                )}
              </div>

              {activeTimers[task.id] && (
                <div className="task-timer-container">
                  <TaskTimer taskId={task.id} onStop={(timeSpent) => handleStopTimer(task.id, timeSpent)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TaskList

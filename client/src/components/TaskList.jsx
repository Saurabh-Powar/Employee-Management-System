"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import TaskForm from "./TaskForm"
import TaskTimer from "./TaskTimer"
import { Calendar, CheckCircle, Clock, Filter, Plus, Search, Tag } from "lucide-react"
import "./TaskListS.css"
// Add import at the top
import websocketService from "../services/websocket"

function TaskList() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [onlineEmployees, setOnlineEmployees] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [showTimer, setShowTimer] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [filter, setFilter] = useState("all") // all, assigned, in_progress, completed, overdue
  const [searchTerm, setSearchTerm] = useState("")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null)

  // Function to trigger a refresh of task data
  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  // Get current employee ID based on user ID
  const getCurrentEmployeeId = async () => {
    if (!user) return null

    try {
      // For employees, we need to find their employee ID
      if (user.role === "employee" || user.role === "manager" || user.role === "admin") {
        // Get all employees and find the one matching the current user ID
        const response = await api.get("/employees")
        const employee = response.data.find((emp) => emp.user_id === user.id)

        if (employee) {
          setCurrentEmployeeId(employee.id)
          return employee.id
        }
      }

      return null
    } catch (err) {
      console.error("Error getting current employee ID:", err)
      return null
    }
  }

  // Update the fetchTasks function to properly handle API responses
  const fetchTasks = async () => {
    setLoading(true)
    setError("")

    if (!user) {
      setLoading(false)
      return
    }

    try {
      let response

      if (user.role === "manager" || user.role === "admin") {
        // Managers and admins see all tasks
        response = await api.get("/tasks")
      } else {
        // For employees, fetch only their tasks
        const employeeId = currentEmployeeId || (await getCurrentEmployeeId())

        if (employeeId) {
          response = await api.get(`/tasks/${employeeId}`)
        } else {
          throw new Error("Employee record not found")
        }
      }

      if (response && response.data) {
        setTasks(response.data)
      } else {
        setTasks([])
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err)
      setError("Failed to load tasks. Please try again.")
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    if (user && (user.role === "manager" || user.role === "admin")) {
      try {
        const response = await api.get("/employees")

        // Filter out the current manager from the list
        const currentManagerId = currentEmployeeId || (await getCurrentEmployeeId())
        const filteredEmployees = response.data.filter(
          (emp) => emp.id !== currentManagerId && emp.role !== "manager" && emp.role !== "admin",
        )

        setEmployees(filteredEmployees)

        // Set up online status simulation
        const onlineStatus = {}
        filteredEmployees.forEach((emp) => {
          // Randomly set some employees as online for demo purposes
          onlineStatus[emp.id] = Math.random() > 0.5
        })
        setOnlineEmployees(onlineStatus)
      } catch (err) {
        console.error("Failed to fetch employees:", err)
      }
    }
  }

  // Simulate updating online status
  const updateOnlineStatus = () => {
    const updatedStatus = { ...onlineEmployees }
    Object.keys(updatedStatus).forEach((id) => {
      // Randomly change some statuses for demo
      if (Math.random() > 0.8) {
        updatedStatus[id] = !updatedStatus[id]
      }
    })
    setOnlineEmployees(updatedStatus)
  }

  useEffect(() => {
    if (user) {
      getCurrentEmployeeId().then(() => {
        fetchTasks()
        fetchEmployees()
      })

      // Set up polling for online status
      const intervalId = setInterval(() => {
        updateOnlineStatus()
      }, 30000) // Update every 30 seconds

      return () => clearInterval(intervalId)
    }
  }, [user, refreshTrigger])

  // Refetch when currentEmployeeId changes
  useEffect(() => {
    if (currentEmployeeId) {
      fetchTasks()
      fetchEmployees()
    }
  }, [currentEmployeeId])

  // Add a useEffect hook for WebSocket listeners
  useEffect(() => {
    // Set up WebSocket listener for task status updates
    const taskStatusListener = websocketService.on("task_status_update", (data) => {
      console.log("Received task status update via WebSocket:", data)
      fetchTasks() // Refresh the tasks
    })

    // Set up WebSocket listener for task completion requests
    const taskCompletionListener = websocketService.on("task_completion_request", (data) => {
      console.log("Received task completion request via WebSocket:", data)
      fetchTasks() // Refresh the tasks
    })

    // Clean up listeners on unmount
    return () => {
      taskStatusListener()
      taskCompletionListener()
    }
  }, [])

  const handleCreateTask = (newTask) => {
    setTasks((prev) => [newTask, ...prev])
    setSuccessMessage("Task created successfully")
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus })
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: newStatus, updated_at: new Date() } : task)),
      )
      setSuccessMessage(`Task status updated to ${newStatus}`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("Failed to update task status:", err)
      setError("Failed to update task status. Please try again.")
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return

    try {
      await api.delete(`/tasks/${taskId}`)
      setTasks((prev) => prev.filter((task) => task.id !== taskId))
      setSuccessMessage("Task deleted successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("Failed to delete task:", err)
      setError("Failed to delete task. Please try again.")
    }
  }

  const handleStartTimer = (task) => {
    setActiveTask(task)
    setShowTimer(true)
  }

  const handleTimerClose = () => {
    setShowTimer(false)
    setActiveTask(null)
    triggerRefresh() // Refresh tasks to get updated time spent
  }

  // Add a new function to handle requesting task completion
  const handleRequestCompletion = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: "pending_completion" })
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: "pending_completion", updated_at: new Date() } : task,
        ),
      )
      setSuccessMessage(`Completion request submitted for manager approval`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("Failed to request task completion:", err)
      setError("Failed to request task completion. Please try again.")
    }
  }

  // Update the getStatusClass function to include the new status
  const getStatusClass = (status) => {
    switch (status) {
      case "assigned":
        return "status-assigned"
      case "in_progress":
        return "status-in-progress"
      case "pending_completion":
        return "status-pending"
      case "completed":
        return "status-completed"
      case "overdue":
        return "status-overdue"
      default:
        return ""
    }
  }

  const formatTimeSpent = (seconds) => {
    if (!seconds) return "0h 0m"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatDueDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isOverdue = (dueDate) => {
    const now = new Date()
    const due = new Date(dueDate)
    return due < now
  }

  // Filter and search tasks
  const filteredTasks = tasks.filter((task) => {
    // First apply status filter
    const statusMatch =
      filter === "all"
        ? true
        : filter === "overdue"
          ? isOverdue(task.due_date) && task.status !== "completed"
          : task.status === filter

    // Then apply search filter
    const searchMatch =
      searchTerm === ""
        ? true
        : task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))

    return statusMatch && searchMatch
  })

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h2>Task Management</h2>
        {(user.role === "manager" || user.role === "admin") && (
          <button className="add-task-btn" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Assign New Task
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="task-controls">
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="task-filters">
          <Filter size={16} className="filter-icon" />
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All
          </button>
          <button
            className={`filter-btn ${filter === "assigned" ? "active" : ""}`}
            onClick={() => setFilter("assigned")}
          >
            Assigned
          </button>
          <button
            className={`filter-btn ${filter === "in_progress" ? "active" : ""}`}
            onClick={() => setFilter("in_progress")}
          >
            In Progress
          </button>
          <button
            className={`filter-btn ${filter === "pending_completion" ? "active" : ""}`}
            onClick={() => setFilter("pending_completion")}
          >
            Pending Approval
          </button>
          <button
            className={`filter-btn ${filter === "completed" ? "active" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Completed
          </button>
          <button className={`filter-btn ${filter === "overdue" ? "active" : ""}`} onClick={() => setFilter("overdue")}>
            Overdue
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="no-tasks">
          <div className="no-tasks-icon">📋</div>
          <h3>No tasks found</h3>
          <p>
            {searchTerm
              ? "Try adjusting your search terms"
              : filter !== "all"
                ? `No ${filter.replace("_", " ")} tasks found`
                : user.role === "employee"
                  ? "You don't have any tasks assigned to you yet"
                  : "No tasks have been created yet"}
          </p>
        </div>
      ) : (
        <div className="tasks-grid">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`task-card ${getStatusClass(task.status)} ${
                isOverdue(task.due_date) && task.status !== "completed" ? "overdue" : ""
              }`}
            >
              <div className="task-header">
                <h3 className="task-title">{task.title}</h3>
                <div className={`task-priority priority-${task.priority}`}>
                  <Tag size={12} />
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </div>
              </div>

              <div className="task-description">{task.description || "No description provided"}</div>

              <div className="task-meta">
                {user.role === "manager" || user.role === "admin" ? (
                  <div className="task-assignee">
                    <span className="meta-label">Assigned to:</span>
                    <span className="employee-name">
                      {task.employee_name || "Unknown"}
                      {onlineEmployees[task.employee_id] !== undefined && (
                        <span
                          className={`online-status ${onlineEmployees[task.employee_id] ? "online" : "offline"}`}
                          title={onlineEmployees[task.employee_id] ? "Online" : "Offline"}
                        >
                          •
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="task-assignee">
                    <span className="meta-label">Assigned by:</span> {task.assigned_by_name || "Manager"}
                  </div>
                )}

                <div className="task-due-date">
                  <Calendar size={14} className="meta-icon" />
                  <span className="meta-label">Due:</span> {formatDueDate(task.due_date)}
                  {isOverdue(task.due_date) && task.status !== "completed" && (
                    <span className="overdue-badge">Overdue</span>
                  )}
                </div>

                <div className="task-time-spent">
                  <Clock size={14} className="meta-icon" />
                  <span className="meta-label">Time spent:</span> {formatTimeSpent(task.time_spent)}
                </div>
              </div>

              <div className="task-status">
                <span className="meta-label">Status:</span>
                <span className={`status-badge ${getStatusClass(task.status)}`}>
                  {task.status.replace("_", " ").charAt(0).toUpperCase() + task.status.replace("_", " ").slice(1)}
                </span>
              </div>

              <div className="task-actions">
                {user.role === "employee" && task.status !== "completed" && task.status !== "pending_completion" && (
                  <button className="timer-btn" onClick={() => handleStartTimer(task)}>
                    <Clock size={14} />
                    {task.status === "in_progress" ? "Continue Working" : "Start Working"}
                  </button>
                )}

                {user.role === "employee" && (task.status === "assigned" || task.status === "in_progress") && (
                  <button className="complete-btn" onClick={() => handleRequestCompletion(task.id)}>
                    <CheckCircle size={14} />
                    Request Completion
                  </button>
                )}

                {user.role === "employee" && task.status === "pending_completion" && (
                  <span className="pending-badge">Awaiting Approval</span>
                )}

                {(user.role === "manager" || user.role === "admin") && task.status === "pending_completion" && (
                  <>
                    <button className="approve-btn" onClick={() => handleUpdateStatus(task.id, "completed")}>
                      <CheckCircle size={14} />
                      Approve Completion
                    </button>
                    <button className="reject-btn" onClick={() => handleUpdateStatus(task.id, "in_progress")}>
                      Reject & Return
                    </button>
                  </>
                )}

                {(user.role === "manager" || user.role === "admin") &&
                  task.status !== "pending_completion" &&
                  task.status !== "completed" && (
                    <button className="complete-btn" onClick={() => handleUpdateStatus(task.id, "completed")}>
                      <CheckCircle size={14} />
                      Mark Complete
                    </button>
                  )}

                {(user.role === "manager" || user.role === "admin") && (
                  <button className="delete-btn" onClick={() => handleDeleteTask(task.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <TaskForm onClose={() => setShowForm(false)} onSubmit={handleCreateTask} employees={employees} />}

      {showTimer && activeTask && <TaskTimer task={activeTask} onClose={handleTimerClose} />}
    </div>
  )
}

export default TaskList

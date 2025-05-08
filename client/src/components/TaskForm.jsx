"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { Calendar, Tag, User } from "lucide-react"
import "./TaskFormS.css"

function TaskForm({ onClose, onSubmit, employees }) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    employee_id: "",
    priority: "medium",
    due_date: "",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [availableEmployees, setAvailableEmployees] = useState([])
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null)

  useEffect(() => {
    // Set default due date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setFormData((prev) => ({
      ...prev,
      due_date: tomorrow.toISOString().split("T")[0],
    }))

    // Get current employee ID (manager's ID)
    const getCurrentEmployeeId = async () => {
      try {
        const response = await api.get("/employees/current")
        if (response.data && response.data.id) {
          setCurrentEmployeeId(response.data.id)
        }
      } catch (error) {
        console.error("Failed to get current employee ID:", error)
      }
    }

    getCurrentEmployeeId()

    // If employees are passed as props, filter and use them
    if (employees && employees.length > 0) {
      // Filter out managers and admins, and the current manager
      filterEmployees(employees)
    } else {
      // Otherwise fetch employees
      fetchEmployees()
    }
  }, [employees])

  // Filter employees to exclude managers, admins, and the current manager
  const filterEmployees = (employeesList) => {
    if (!employeesList) return []

    const filtered = employeesList.filter((emp) => {
      // Exclude managers and admins
      if (emp.role === "manager" || emp.role === "admin") return false

      // Exclude the current manager
      if (currentEmployeeId && emp.id === currentEmployeeId) return false

      return true
    })

    setAvailableEmployees(filtered)
  }

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/employees")
      filterEmployees(response.data)
    } catch (error) {
      console.error("Failed to fetch employees:", error)
      setErrors((prev) => ({
        ...prev,
        general: "Failed to load employees. Please try again.",
      }))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when field is updated
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.title.trim()) newErrors.title = "Title is required"
    if (!formData.employee_id) newErrors.employee_id = "Employee is required"
    if (!formData.priority) newErrors.priority = "Priority is required"
    if (!formData.due_date) newErrors.due_date = "Due date is required"

    // Validate due date is in the future
    const dueDate = new Date(formData.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dueDate < today) {
      newErrors.due_date = "Due date must be in the future"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const response = await api.post("/tasks", formData)
      if (response.status === 201) {
        onSubmit(response.data)
        onClose()
      } else {
        throw new Error("Unexpected server response")
      }
    } catch (error) {
      console.error("Failed to create task:", error)
      setErrors((prev) => ({
        ...prev,
        submit: error.response?.data?.message || "Failed to create task. Please try again.",
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="task-form-overlay" onClick={onClose}>
      <div className="task-form" onClick={(e) => e.stopPropagation()}>
        <h2>Assign New Task</h2>
        <form onSubmit={handleSubmit}>
          {errors.submit && <div className="error-message">{errors.submit}</div>}
          {errors.general && <div className="error-message">{errors.general}</div>}

          <div className="form-group">
            <label htmlFor="title">
              <span className="label-text">Task Title</span>
              <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter task title"
              className={errors.title ? "error" : ""}
            />
            {errors.title && <div className="error-text">{errors.title}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="description">
              <span className="label-text">Description</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter task description"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="employee_id">
              <User size={14} className="label-icon" />
              <span className="label-text">Assign To</span>
              <span className="required">*</span>
            </label>
            <select
              id="employee_id"
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              className={errors.employee_id ? "error" : ""}
            >
              <option value="">Select Employee</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} - {emp.position || "Employee"}
                </option>
              ))}
            </select>
            {errors.employee_id && <div className="error-text">{errors.employee_id}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">
                <Tag size={14} className="label-icon" />
                <span className="label-text">Priority</span>
                <span className="required">*</span>
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className={errors.priority ? "error" : ""}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {errors.priority && <div className="error-text">{errors.priority}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="due_date">
                <Calendar size={14} className="label-icon" />
                <span className="label-text">Due Date</span>
                <span className="required">*</span>
              </label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                className={errors.due_date ? "error" : ""}
              />
              {errors.due_date && <div className="error-text">{errors.due_date}</div>}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskForm

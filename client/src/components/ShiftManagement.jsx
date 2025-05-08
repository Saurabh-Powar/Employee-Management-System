"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { Clock, Calendar, Save, X, AlertTriangle } from "lucide-react"
import "./ShiftManagementS.css"

function ShiftManagement() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingShift, setEditingShift] = useState(null)
  const [shiftData, setShiftData] = useState({
    start_time: "",
    end_time: "",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const response = await api.get("/employees")

      // Filter out managers and admins if the current user is a manager
      let filteredEmployees = response.data
      if (user.role === "manager") {
        // Get the manager's employee record to exclude themselves
        const managerResponse = await api.get("/employees/current")
        const managerId = managerResponse.data?.id

        filteredEmployees = response.data.filter((emp) => {
          // Exclude the manager and any admin/manager users
          return emp.id !== managerId && emp.role !== "admin" && emp.role !== "manager"
        })
      }

      // Fetch shift data for each employee
      const employeesWithShifts = await Promise.all(
        filteredEmployees.map(async (emp) => {
          try {
            const shiftResponse = await api.get(`/shifts/${emp.id}`)
            return {
              ...emp,
              shift: shiftResponse.data || {
                start_time: "09:00",
                end_time: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
              },
            }
          } catch (err) {
            console.error(`Error fetching shift for employee ${emp.id}:`, err)
            return {
              ...emp,
              shift: {
                start_time: "09:00",
                end_time: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
              },
            }
          }
        }),
      )

      setEmployees(employeesWithShifts)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching employees:", err)
      setError("Failed to load employees. Please try again.")
      setLoading(false)
    }
  }

  const handleEditShift = (employee) => {
    setEditingShift(employee.id)
    setShiftData({
      start_time: employee.shift?.start_time || "09:00",
      end_time: employee.shift?.end_time || "17:00",
      days: employee.shift?.days || ["monday", "tuesday", "wednesday", "thursday", "friday"],
    })
  }

  const handleCancelEdit = () => {
    setEditingShift(null)
    setShiftData({
      start_time: "",
      end_time: "",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    })
  }

  const handleSaveShift = async (employeeId) => {
    try {
      setLoading(true)

      // Validate times
      if (!shiftData.start_time || !shiftData.end_time) {
        setError("Start and end times are required")
        setLoading(false)
        return
      }

      // Convert to 24-hour format if needed
      const startTime = shiftData.start_time
      const endTime = shiftData.end_time

      // Validate that end time is after start time
      if (startTime >= endTime) {
        setError("End time must be after start time")
        setLoading(false)
        return
      }

      const payload = {
        employee_id: employeeId,
        start_time: startTime,
        end_time: endTime,
        days: shiftData.days,
      }

      await api.post("/shifts", payload)

      setSuccess(`Shift updated successfully for employee #${employeeId}`)
      setTimeout(() => setSuccess(""), 3000)

      // Update the local state
      setEmployees(employees.map((emp) => (emp.id === employeeId ? { ...emp, shift: payload } : emp)))

      setEditingShift(null)
      setLoading(false)
    } catch (err) {
      console.error("Error saving shift:", err)
      setError(err.response?.data?.message || "Failed to save shift. Please try again.")
      setLoading(false)
    }
  }

  const handleDayToggle = (day) => {
    if (shiftData.days.includes(day)) {
      setShiftData({
        ...shiftData,
        days: shiftData.days.filter((d) => d !== day),
      })
    } else {
      setShiftData({
        ...shiftData,
        days: [...shiftData.days, day],
      })
    }
  }

  const formatTime = (timeString) => {
    try {
      // Handle cases where timeString might be in different formats
      if (!timeString) return "Not set"

      // If it's already in HH:MM format, return it
      if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        return timeString
      }

      // If it's a date string, extract the time
      const date = new Date(timeString)
      if (isNaN(date)) return timeString

      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    } catch (err) {
      console.error("Error formatting time:", err)
      return timeString || "Not set"
    }
  }

  const getDayLabel = (day) => {
    const labels = {
      monday: "Mon",
      tuesday: "Tue",
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
    }
    return labels[day] || day
  }

  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return (
      <div className="unauthorized-message">
        <AlertTriangle size={24} />
        <p>You don't have permission to manage employee shifts.</p>
      </div>
    )
  }

  return (
    <div className="shift-management-container">
      <div className="shift-management-header">
        <h2>Employee Shift Management</h2>
        <p className="shift-management-description">
          Set and manage employee work schedules. Changes to shift times will affect attendance tracking.
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {loading && !employees.length ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading employee data...</p>
        </div>
      ) : (
        <div className="employee-shifts-grid">
          {employees.map((employee) => (
            <div key={employee.id} className="employee-shift-card">
              <div className="employee-info">
                <h3>
                  {employee.first_name} {employee.last_name}
                </h3>
                <p className="employee-position">{employee.position || "Employee"}</p>
                <p className="employee-department">{employee.department || "N/A"}</p>
              </div>

              {editingShift === employee.id ? (
                <div className="shift-edit-form">
                  <div className="form-group">
                    <label>
                      <Clock size={14} className="icon" />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={shiftData.start_time}
                      onChange={(e) => setShiftData({ ...shiftData, start_time: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Clock size={14} className="icon" />
                      End Time
                    </label>
                    <input
                      type="time"
                      value={shiftData.end_time}
                      onChange={(e) => setShiftData({ ...shiftData, end_time: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Calendar size={14} className="icon" />
                      Working Days
                    </label>
                    <div className="days-selector">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={`day-button ${shiftData.days.includes(day) ? "selected" : ""}`}
                          onClick={() => handleDayToggle(day)}
                        >
                          {getDayLabel(day)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shift-edit-actions">
                    <button className="save-btn" onClick={() => handleSaveShift(employee.id)} disabled={loading}>
                      <Save size={14} />
                      Save
                    </button>
                    <button className="cancel-btn" onClick={handleCancelEdit} disabled={loading}>
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="shift-display">
                  <div className="shift-time">
                    <Clock size={16} className="icon" />
                    <span>
                      {formatTime(employee.shift?.start_time)} - {formatTime(employee.shift?.end_time)}
                    </span>
                  </div>

                  <div className="shift-days">
                    <Calendar size={16} className="icon" />
                    <div className="days-pills">
                      {(employee.shift?.days || []).map((day) => (
                        <span key={day} className="day-pill">
                          {getDayLabel(day)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button className="edit-shift-btn" onClick={() => handleEditShift(employee)}>
                    Edit Shift
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {employees.length === 0 && !loading && (
        <div className="no-employees">
          <p>No employees found to manage shifts.</p>
        </div>
      )}
    </div>
  )
}

export default ShiftManagement

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api, { shiftsAPI } from "../services/api"
import { Clock, Save, Trash2, RefreshCw, AlertCircle } from "lucide-react"
import "./ShiftManagementS.css"

function ShiftManagement() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [formData, setFormData] = useState({
    start_time: "09:00",
    end_time: "17:00",
    days: ["mon", "tue", "wed", "thu", "fri"],
  })

  // Days of the week for checkboxes
  const daysOfWeek = [
    { value: "mon", label: "Monday" },
    { value: "tue", label: "Tuesday" },
    { value: "wed", label: "Wednesday" },
    { value: "thu", label: "Thursday" },
    { value: "fri", label: "Friday" },
    { value: "sat", label: "Saturday" },
    { value: "sun", label: "Sunday" },
  ]

  // Fetch employees and their shifts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError("")
      try {
        // Fetch employees
        const employeesResponse = await api.get("/employees")
        setEmployees(employeesResponse.data)

        // Fetch shifts
        const shiftsResponse = await shiftsAPI.getAllShifts()

        // Convert shifts array to object with employee_id as key
        const shiftsObj = shiftsResponse.data.reduce((acc, shift) => {
          acc[shift.employee_id] = shift
          return acc
        }, {})

        setShifts(shiftsObj)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load employees and shifts data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle employee selection
  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find((emp) => emp.id === Number.parseInt(employeeId))
    setSelectedEmployee(employee)

    // If employee has a shift, load it into form
    if (shifts[employeeId]) {
      setFormData({
        start_time: shifts[employeeId].start_time,
        end_time: shifts[employeeId].end_time,
        days: shifts[employeeId].days,
      })
    } else {
      // Reset to default values
      setFormData({
        start_time: "09:00",
        end_time: "17:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      })
    }
  }

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Handle checkbox changes for days
  const handleDayChange = (day) => {
    setFormData((prev) => {
      const newDays = prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day]

      return {
        ...prev,
        days: newDays,
      }
    })
  }

  // Save shift
  const handleSaveShift = async () => {
    if (!selectedEmployee) {
      setError("Please select an employee")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const shiftData = {
        ...formData,
        employee_id: selectedEmployee.id,
      }

      // Check if employee already has a shift
      if (shifts[selectedEmployee.id]) {
        // Update existing shift
        await shiftsAPI.updateShift(selectedEmployee.id, shiftData)
        setSuccess(`Shift updated for ${selectedEmployee.first_name} ${selectedEmployee.last_name}`)
      } else {
        // Create new shift
        await shiftsAPI.createShift(shiftData)
        setSuccess(`Shift created for ${selectedEmployee.first_name} ${selectedEmployee.last_name}`)
      }

      // Refresh shifts data
      const shiftsResponse = await shiftsAPI.getAllShifts()
      const shiftsObj = shiftsResponse.data.reduce((acc, shift) => {
        acc[shift.employee_id] = shift
        return acc
      }, {})
      setShifts(shiftsObj)
    } catch (err) {
      console.error("Error saving shift:", err)
      setError("Failed to save shift. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Delete shift
  const handleDeleteShift = async () => {
    if (!selectedEmployee || !shifts[selectedEmployee.id]) {
      setError("No shift to delete")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      await shiftsAPI.deleteShift(selectedEmployee.id)
      setSuccess(`Shift deleted for ${selectedEmployee.first_name} ${selectedEmployee.last_name}`)

      // Remove from local state
      const newShifts = { ...shifts }
      delete newShifts[selectedEmployee.id]
      setShifts(newShifts)

      // Reset form
      setFormData({
        start_time: "09:00",
        end_time: "17:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      })
    } catch (err) {
      console.error("Error deleting shift:", err)
      setError("Failed to delete shift. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      // Fetch shifts
      const shiftsResponse = await shiftsAPI.getAllShifts()
      const shiftsObj = shiftsResponse.data.reduce((acc, shift) => {
        acc[shift.employee_id] = shift
        return acc
      }, {})
      setShifts(shiftsObj)

      // Update form if employee is selected
      if (selectedEmployee && shiftsObj[selectedEmployee.id]) {
        setFormData({
          start_time: shiftsObj[selectedEmployee.id].start_time,
          end_time: shiftsObj[selectedEmployee.id].end_time,
          days: shiftsObj[selectedEmployee.id].days,
        })
      }

      setSuccess("Data refreshed successfully")
    } catch (err) {
      console.error("Error refreshing data:", err)
      setError("Failed to refresh data")
    } finally {
      setLoading(false)
    }
  }

  if (loading && !selectedEmployee) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading shift management data...</p>
      </div>
    )
  }

  return (
    <div className="shift-management-container">
      <div className="shift-management-header">
        <h2>Shift Management</h2>
        <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="shift-management-content">
        <div className="employee-selection">
          <h3>Select Employee</h3>
          <select
            value={selectedEmployee ? selectedEmployee.id : ""}
            onChange={(e) => handleEmployeeSelect(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Select an employee --</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name} - {employee.department}
              </option>
            ))}
          </select>
        </div>

        {selectedEmployee && (
          <div className="shift-form">
            <h3>
              Shift Schedule for {selectedEmployee.first_name} {selectedEmployee.last_name}
              {shifts[selectedEmployee.id] && <span className="shift-exists-badge">Shift Exists</span>}
            </h3>

            <div className="form-group">
              <label htmlFor="start_time">Start Time:</label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="end_time">End Time:</label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Working Days:</label>
              <div className="days-checkboxes">
                {daysOfWeek.map((day) => (
                  <div key={day.value} className="day-checkbox">
                    <input
                      type="checkbox"
                      id={`day-${day.value}`}
                      checked={formData.days.includes(day.value)}
                      onChange={() => handleDayChange(day.value)}
                      disabled={loading}
                    />
                    <label htmlFor={`day-${day.value}`}>{day.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="shift-actions">
              <button className="save-shift-btn" onClick={handleSaveShift} disabled={loading}>
                <Save size={16} />
                {shifts[selectedEmployee.id] ? "Update Shift" : "Create Shift"}
              </button>

              {shifts[selectedEmployee.id] && (
                <button className="delete-shift-btn" onClick={handleDeleteShift} disabled={loading}>
                  <Trash2 size={16} />
                  Delete Shift
                </button>
              )}
            </div>
          </div>
        )}

        <div className="shift-info-panel">
          <h3>Shift Information</h3>

          <div className="info-card">
            <div className="info-icon">
              <Clock size={20} />
            </div>
            <div className="info-content">
              <h4>Working Hours</h4>
              <p>Set the daily start and end times for each employee's shift.</p>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">
              <AlertCircle size={20} />
            </div>
            <div className="info-content">
              <h4>Attendance Impact</h4>
              <p>Employees checking in after their shift start time will be marked as late.</p>
            </div>
          </div>

          <div className="shift-summary">
            <h4>Current Shifts</h4>
            <p>{Object.keys(shifts).length} employees have assigned shifts</p>
            <ul className="shift-summary-list">
              {Object.values(shifts).map((shift) => {
                const employee = employees.find((emp) => emp.id === shift.employee_id)
                return employee ? (
                  <li key={shift.id} className="shift-summary-item">
                    <span className="employee-name">
                      {employee.first_name} {employee.last_name}
                    </span>
                    <span className="shift-time">
                      {shift.start_time} - {shift.end_time}
                    </span>
                    <span className="shift-days">
                      {shift.days.map((d) => d.substring(0, 1).toUpperCase()).join(", ")}
                    </span>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShiftManagement

"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./AttendanceCorrectionS.css"

function AttendanceCorrection({ employee, onClose }) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    employeeId: employee?.employee_id || "",
    date: employee?.date || new Date().toISOString().split("T")[0],
    checkIn: employee?.check_in ? new Date(employee.check_in).toISOString().slice(0, 16) : "",
    checkOut: employee?.check_out ? new Date(employee.check_out).toISOString().slice(0, 16) : "",
    status: employee?.status || "present",
    reason: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [hasChanges, setHasChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  // Calculate total hours worked
  const totalHours = useMemo(() => {
    if (formData.checkIn && formData.checkOut && formData.status !== "absent") {
      const checkInTime = new Date(formData.checkIn)
      const checkOutTime = new Date(formData.checkOut)

      if (checkOutTime > checkInTime) {
        const diffMs = checkOutTime - checkInTime
        return (diffMs / (1000 * 60 * 60)).toFixed(2)
      }
    }
    return "--"
  }, [formData.checkIn, formData.checkOut, formData.status])

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeId: employee.employee_id,
        date: employee.date,
        checkIn: employee.check_in ? new Date(employee.check_in).toISOString().slice(0, 16) : "",
        checkOut: employee.check_out ? new Date(employee.check_out).toISOString().slice(0, 16) : "",
        status: employee.status || "present",
        reason: "",
      })
      setHasChanges(false)
      setValidationErrors({})
    }
  }, [employee])

  const handleChange = (e) => {
    const { name, value } = e.target

    // Special handling for status changes
    if (name === "status") {
      if (value === "absent") {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          checkIn: "",
          checkOut: "",
        }))
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }))
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }

    setHasChanges(true)

    // Clear validation errors when field is changed
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: null,
      }))
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.reason.trim()) {
      errors.reason = "Please provide a reason for this correction"
    }

    if (formData.status !== "absent") {
      if (!formData.checkIn) {
        errors.checkIn = "Check-in time is required"
      }

      if (formData.checkIn && formData.checkOut) {
        const checkInTime = new Date(formData.checkIn)
        const checkOutTime = new Date(formData.checkOut)

        if (checkOutTime <= checkInTime) {
          errors.checkOut = "Check-out time must be after check-in time"
        }
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const payload = {
        attendanceId: employee?.id,
        employeeId: formData.employeeId,
        date: formData.date,
        checkIn: formData.status === "absent" ? null : formData.checkIn || null,
        checkOut: formData.status === "absent" ? null : formData.checkOut || null,
        status: formData.status,
        reason: formData.reason,
      }

      const response = await api.post("/attendance/correct", payload)

      if (response.status === 200) {
        setSuccess("Attendance record updated successfully")
        setHasChanges(false)
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error("Failed to update attendance:", err)
      setError(err.response?.data?.message || "Failed to update attendance record")
    } finally {
      setLoading(false)
    }
  }

  // Format employee name for display
  const employeeName = employee
    ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Employee ID: ${employee.employee_id}`
    : "Employee"

  // Format date for display
  const formattedDate = employee?.date
    ? new Date(employee.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : ""

  return (
    <div className="attendance-correction-overlay" onClick={onClose}>
      <div
        className={`attendance-correction-form ${hasChanges ? "has-changes" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="correction-header">
          <h2>Edit Attendance Record</h2>
          <div className="employee-info">
            <h3>{employeeName}</h3>
            <p className="date-info">{formattedDate}</p>
          </div>
        </div>

        {error && <div className="correction-error">{error}</div>}
        {success && <div className="correction-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              disabled={loading}
              required
              className={validationErrors.date ? "error" : ""}
            />
            {validationErrors.date && <div className="field-error">{validationErrors.date}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="status">Attendance Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={loading}
              required
              className={validationErrors.status ? "error" : ""}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="on-leave">On Leave</option>
              <option value="half-day">Half Day</option>
            </select>
            {validationErrors.status && <div className="field-error">{validationErrors.status}</div>}
          </div>

          {formData.status !== "absent" && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="checkIn">Check-in Time</label>
                  <input
                    type="datetime-local"
                    id="checkIn"
                    name="checkIn"
                    value={formData.checkIn}
                    onChange={handleChange}
                    disabled={loading || formData.status === "absent"}
                    className={validationErrors.checkIn ? "error" : ""}
                  />
                  {validationErrors.checkIn && <div className="field-error">{validationErrors.checkIn}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="checkOut">Check-out Time</label>
                  <input
                    type="datetime-local"
                    id="checkOut"
                    name="checkOut"
                    value={formData.checkOut}
                    onChange={handleChange}
                    disabled={loading || formData.status === "absent" || !formData.checkIn}
                    className={validationErrors.checkOut ? "error" : ""}
                  />
                  {validationErrors.checkOut && <div className="field-error">{validationErrors.checkOut}</div>}
                </div>
              </div>

              <div className="form-group">
                <label>Total Hours</label>
                <div className="total-hours-display">{totalHours}</div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="reason">
              Reason for Correction <span className="required">*</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              disabled={loading}
              required
              placeholder="Please provide a detailed reason for this attendance correction"
              rows="3"
              className={validationErrors.reason ? "error" : ""}
            ></textarea>
            {validationErrors.reason && <div className="field-error">{validationErrors.reason}</div>}
          </div>

          <div className="form-actions">
            <button type="submit" className={`save-btn ${hasChanges ? "has-changes" : ""}`} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AttendanceCorrection

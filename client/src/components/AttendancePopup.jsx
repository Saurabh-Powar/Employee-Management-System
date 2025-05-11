"use client"

import { useState, useEffect } from "react"
import api from "../services/api"
import { useAuth } from "../context/AuthContext"
import { Clock, CheckCircle, AlertTriangle } from "lucide-react"
import "./AttendancePopups.css"

const AttendancePopup = ({ onClose }) => {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkInTime, setCheckInTime] = useState(null)
  const [shiftInfo, setShiftInfo] = useState(null)
  const [lateStatus, setLateStatus] = useState(null)

  // Add state for confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      if (!user || !user.id) {
        setError("User information not available")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // First check if the user is an employee or a manager with an employee record
        let employeeId = user.id

        if (user.role === "manager") {
          try {
            const employeeResponse = await api.get("/employees")
            const managerEmployee = employeeResponse.data.find((emp) => emp.user_id === user.id)
            if (managerEmployee) {
              employeeId = managerEmployee.id
            }
          } catch (err) {
            console.error("Error fetching manager's employee record:", err)
            // Continue with user.id as fallback
          }
        }

        const response = await api.get(`/attendance/today/${employeeId}`)
        setStatus(response.data)

        if (response.data.checked_in) {
          setCheckInTime(new Date(response.data.check_in_time))
        }

        // Fetch employee's shift information
        try {
          const shiftResponse = await api.get(`/shifts/employee/${employeeId}`)
          if (shiftResponse.data) {
            setShiftInfo(shiftResponse.data)

            // Check if employee is late
            if (response.data.checked_in) {
              const checkInTime = new Date(response.data.check_in_time)
              const shiftStartTime = new Date()
              const [hours, minutes] = shiftResponse.data.start_time.split(":")
              shiftStartTime.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0)

              // Calculate minutes late
              const minutesLate = Math.round((checkInTime - shiftStartTime) / (1000 * 60))

              if (minutesLate > 15) {
                setLateStatus({
                  late: true,
                  minutesLate: minutesLate,
                })
              }
            }
          }
        } catch (shiftErr) {
          console.error("Error fetching shift information:", shiftErr)
          // Don't set error, just continue without shift info
        }
      } catch (err) {
        console.error("Error fetching attendance status:", err)
        setError("Failed to load attendance status. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (user && user.id) {
      fetchAttendanceStatus()
    }
  }, [user])

  // Modify the handleCheckIn function to use UTC for timestamps
  const handleCheckIn = async () => {
    if (!user || !user.id) {
      setError("User information not available")
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Determine the correct employee ID
      let employeeId = user.id

      if (user.role === "manager") {
        try {
          const employeeResponse = await api.get("/employees")
          const managerEmployee = employeeResponse.data.find((emp) => emp.user_id === user.id)
          if (managerEmployee) {
            employeeId = managerEmployee.id
          }
        } catch (err) {
          console.error("Error fetching manager's employee record:", err)
          // Continue with user.id as fallback
        }
      }

      const response = await api.post("/attendance/check-in", { employee_id: employeeId })
      setStatus(response.data)

      // Convert UTC timestamp to local time for display
      const checkInTimeUTC = new Date(response.data.check_in_time)
      setCheckInTime(checkInTimeUTC)

      // Check if check-in is late
      if (shiftInfo) {
        const now = new Date()
        const shiftStartTime = new Date()
        const [hours, minutes] = shiftInfo.start_time.split(":")
        shiftStartTime.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0)

        // Calculate minutes late
        const minutesLate = Math.round((now - shiftStartTime) / (1000 * 60))

        if (minutesLate > 15) {
          setLateStatus({
            late: true,
            minutesLate: minutesLate,
          })
        }
      }
    } catch (err) {
      console.error("Error checking in:", err)
      setError(err.response?.data?.error || "Failed to check in. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Modify the handleCheckOut function to add confirmation and use UTC
  const handleCheckOut = async () => {
    // First show confirmation
    setConfirmAction(() => async () => {
      if (!user || !user.id) {
        setError("User information not available")
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Determine the correct employee ID
        let employeeId = user.id

        if (user.role === "manager") {
          try {
            const employeeResponse = await api.get("/employees")
            const managerEmployee = employeeResponse.data.find((emp) => emp.user_id === user.id)
            if (managerEmployee) {
              employeeId = managerEmployee.id
            }
          } catch (err) {
            console.error("Error fetching manager's employee record:", err)
            // Continue with user.id as fallback
          }
        }

        const response = await api.post("/attendance/check-out", { employee_id: employeeId })
        setStatus(response.data)

        // Calculate work hours
        if (checkInTime) {
          const checkOutTime = new Date()
          const hoursWorked = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2)

          // Check if employee worked overtime
          if (shiftInfo) {
            const shiftEndTime = new Date()
            const [hours, minutes] = shiftInfo.end_time.split(":")
            shiftEndTime.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0)

            // Calculate minutes of overtime
            const minutesOvertime = Math.round((checkOutTime - shiftEndTime) / (1000 * 60))

            if (minutesOvertime > 30) {
              // Create a notification about overtime (handled by server)
              console.log(`Worked ${Math.round((minutesOvertime / 60) * 100) / 100} hours of overtime`)
            }
          }

          // Show confirmation with hours worked
          alert(`Successfully checked out. You worked for ${hoursWorked} hours today.`)
        }
      } catch (err) {
        console.error("Error checking out:", err)
        setError(err.response?.data?.error || "Failed to check out. Please try again.")
      } finally {
        setLoading(false)
        setShowConfirm(false)
      }
    })

    setShowConfirm(true)
  }

  // Add focus trap for the popup
  // Add this useEffect hook after the other useEffect hooks
  useEffect(() => {
    // Focus trap for the modal
    const handleTabKey = (e) => {
      if (e.key === "Tab") {
        const focusableElements = document
          .querySelector(".attendance-popup-content")
          ?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')

        if (!focusableElements || focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener("keydown", handleTabKey)

    // Focus the first interactive element when modal opens
    const firstButton = document.querySelector(".attendance-popup-content button")
    if (firstButton) {
      setTimeout(() => firstButton.focus(), 100)
    }

    return () => {
      document.removeEventListener("keydown", handleTabKey)
    }
  }, [])

  return (
    <div className="attendance-popup">
      <div className="attendance-popup-content">
        <button
          className="close-btn"
          onClick={onClose}
          aria-label="Close attendance popup"
          title="Close attendance popup"
        >
          <span aria-hidden="true">×</span>
        </button>

        <h2>Attendance</h2>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error-message">
            <AlertTriangle size={20} className="error-icon" />
            {error}
          </div>
        ) : (
          <div className="attendance-status">
            {shiftInfo && (
              <div className="shift-info">
                <p>
                  Your shift: {shiftInfo.start_time} - {shiftInfo.end_time}
                </p>
              </div>
            )}

            <div className="status-display">
              <div className={`status-indicator ${status?.checked_in ? "checked-in" : "checked-out"}`}>
                {status?.checked_in ? "Checked In" : "Checked Out"}
              </div>

              {status?.checked_in && status?.check_in_time && (
                <p className="check-in-time">Checked in at: {new Date(status.check_in_time).toLocaleTimeString()}</p>
              )}

              {lateStatus?.late && (
                <div className="late-warning">
                  <p>You were {lateStatus.minutesLate} minutes late today.</p>
                  <p className="late-note">Note: This may affect your attendance record and salary calculation.</p>
                </div>
              )}
            </div>

            <div className="attendance-actions">
              {!status?.checked_in ? (
                <button
                  className="check-in-btn"
                  onClick={handleCheckIn}
                  disabled={loading}
                  aria-label="Check in for today"
                  title="Check in for today"
                >
                  <CheckCircle size={16} className="icon" aria-hidden="true" />
                  Check In
                </button>
              ) : (
                <button
                  className="check-out-btn"
                  onClick={handleCheckOut}
                  disabled={loading}
                  aria-label="Check out for today"
                  title="Check out for today"
                >
                  <Clock size={16} className="icon" aria-hidden="true" />
                  Check Out
                </button>
              )}
            </div>

            {status?.checked_in && (
              <div className="attendance-notes">
                <p>Don't forget to check out at the end of your workday.</p>
                {lateStatus?.late && (
                  <p className="salary-impact">Late check-ins may result in salary deductions as per company policy.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {showConfirm && (
        <div className="attendance-confirmation-overlay">
          <div className="attendance-confirmation" role="dialog" aria-labelledby="confirm-dialog-title">
            <h3 id="confirm-dialog-title">Confirm Check Out</h3>
            <p>Are you sure you want to check out for today?</p>
            <div className="confirmation-actions">
              <button
                className="confirm-btn"
                onClick={() => confirmAction && confirmAction()}
                aria-label="Confirm check out"
              >
                Yes, Check Out
              </button>
              <button className="cancel-btn" onClick={() => setShowConfirm(false)} aria-label="Cancel check out">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendancePopup

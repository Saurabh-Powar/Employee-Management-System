"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import AttendancePopup from "./AttendancePopup"
import AttendanceCorrection from "./AttendanceCorrection"
import "./AttendanceTableS.css"
import * as websocketService from "../services/websocket"

// Add these imports at the top of the file
import { mapToUiValue, attendanceStatusMapping } from "../utils/statusMappings.js"
import { RefreshCw, Clock, Edit, AlertCircle, AlertTriangle } from "lucide-react"

function AttendanceTable({ allowMarking = false }) {
  const { user } = useAuth()
  const [own, setOwn] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(null)
  const [successMessage] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [showCorrectionForm, setShowCorrectionForm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [employeeShifts, setEmployeeShifts] = useState({})
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationData, setConfirmationData] = useState(null)

  // Function to trigger a refresh of attendance data
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  // Update the fetchAttendanceData function to properly handle manager attendance
  const fetchAttendanceData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError("")
    try {
      let response

      // Fetch attendance only for authorized roles
      if (user.role === "admin" || user.role === "manager") {
        response = await api.get("/attendance")
      } else if (user.role === "employee") {
        response = await api.get(`/attendance/${user.id}`)
      } else {
        setError("Unauthorized role")
        setLoading(false)
        return
      }

      const data = response.data

      // Fetch employee shifts for attendance status determination
      try {
        const shiftsResponse = await api.get("/shifts")
        const shifts = shiftsResponse.data.reduce((acc, shift) => {
          acc[shift.employee_id] = shift
          return acc
        }, {})
        setEmployeeShifts(shifts)
      } catch (shiftErr) {
        console.error("Error fetching shifts:", shiftErr)
        // Continue without shifts data
      }

      // For managers, separate their own attendance from team attendance
      if (user.role === "manager") {
        try {
          // Find the manager's employee ID
          const managerEmployeeResponse = await api.get("/employees")
          const managerEmployee = managerEmployeeResponse.data.find((emp) => emp.user_id === user.id)

          if (managerEmployee) {
            const mine = data.filter((r) => r.employee_id === managerEmployee.id)
            setOwn(mine)
            setTeam(data.filter((r) => r.employee_id !== managerEmployee.id))
          } else {
            setOwn([])
            setTeam(data)
          }
        } catch (empErr) {
          console.error("Error fetching manager's employee record:", empErr)
          setOwn([])
          setTeam(data)
        }
      } else if (user.role === "admin") {
        setTeam(data)
      } else {
        setOwn(data)
      }

      // Check today's status for both employees and managers
      try {
        // For managers, we need to get their employee ID first
        let employeeId = user.id

        if (user.role === "manager") {
          try {
            const managerEmployeeResponse = await api.get("/employees")
            const managerEmployee = managerEmployeeResponse.data.find((emp) => emp.user_id === user.id)
            if (managerEmployee) {
              employeeId = managerEmployee.id
            }
          } catch (err) {
            console.error("Error finding manager's employee ID:", err)
            // Continue with user.id as fallback
          }
        }

        const todayResponse = await api.get(`/attendance/today/${employeeId}`)
        if (todayResponse.data && todayResponse.data.status) {
          setStatus(todayResponse.data.status)
          if (todayResponse.data.status === "check-out" || todayResponse.data.status === "absent") {
            setAccessBlocked(true)
          } else {
            setAccessBlocked(false)
          }
        } else {
          setStatus(null)
          setAccessBlocked(false)
        }
      } catch (err) {
        console.error("Error fetching today's status:", err)
        setStatus(null)
        setAccessBlocked(false)
      }
    } catch (err) {
      console.error("Error fetching attendance data:", err)
      setError(err.response?.data?.message || "Could not load attendance.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchAttendanceData()

      // Set up auto-refresh every minute
      const intervalId = setInterval(() => {
        fetchAttendanceData()
      }, 60000)

      return () => clearInterval(intervalId)
    }
  }, [user, refreshTrigger, fetchAttendanceData])

  // Add a useEffect hook for WebSocket listeners
  useEffect(() => {
    if (!user) return

    // Initialize WebSocket connection
    websocketService.initWebSocket(user.id, user.role)

    // Set up WebSocket listener for attendance updates
    const removeListener = websocketService.subscribeToEvent("attendance_update", (data) => {
      console.log("Received attendance update via WebSocket:", data)
      triggerRefresh() // Refresh the attendance data
    })

    // Keep WebSocket connection alive
    const cleanupKeepAlive = websocketService.setupKeepAlive(30000)

    // Clean up listener on unmount
    return () => {
      removeListener()
      cleanupKeepAlive()
    }
  }, [user, triggerRefresh])

  const handleAttendanceClick = () => {
    setShowPopup(true)
  }

  const handlePopupClose = () => {
    setShowPopup(false)
    fetchAttendanceData() // Refresh data when popup closes
  }

  const showCorrectionConfirmation = (employee) => {
    setConfirmationData({ employee, action: "correction" })
    setShowConfirmation(true)
  }

  const handleCorrectionClick = (employee) => {
    // Hide confirmation dialog
    setShowConfirmation(false)

    // Make sure we have all the employee data needed for the correction form
    const employeeData = {
      ...employee,
      // Ensure these fields exist to avoid errors in the correction form
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      department: employee.department || "N/A",
    }

    // Prevent managers from editing their own attendance
    if (user.role === "manager") {
      try {
        // Get manager's employee ID
        api
          .get("/employees")
          .then((response) => {
            const managerEmployee = response.data.find((emp) => emp.user_id === user.id)

            if (managerEmployee && managerEmployee.id === employee.employee_id) {
              setError("Managers cannot edit their own attendance records")
              setTimeout(() => setError(""), 3000)
              return
            }

            setSelectedEmployee(employeeData)
            setShowCorrectionForm(true)
          })
          .catch((err) => {
            console.error("Error checking manager status:", err)
            setError("Could not verify permissions")
          })
      } catch (err) {
        console.error("Error in correction click:", err)
        setError("An error occurred while processing your request")
      }
    } else {
      // Admin can edit anyone's attendance
      setSelectedEmployee(employeeData)
      setShowCorrectionForm(true)
    }
  }

  const handleCorrectionClose = () => {
    setShowCorrectionForm(false)
    setSelectedEmployee(null)
    triggerRefresh() // Refresh data when correction form closes
  }

  const formatDate = (dateString) => {
    if (!dateString) return "--"
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (err) {
      console.error("Error formatting date:", err)
      return dateString
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return "--"
    try {
      return new Date(timeString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (err) {
      console.error("Error formatting time:", err)
      return timeString
    }
  }

  // Function to determine if an employee was late based on their shift
  const isLate = (record) => {
    if (!record || !record.check_in || record.status === "absent") return false

    // Get the employee's shift
    const shift = employeeShifts[record.employee_id]
    if (!shift) return false

    // Check if this day is a working day for this employee
    const attendanceDate = new Date(record.date)
    const dayOfWeek = attendanceDate.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()

    if (!shift.days || !Array.isArray(shift.days)) return false

    const isWorkingDay = shift.days.some((day) => dayOfWeek.substring(0, 3) === day.substring(0, 3).toLowerCase())

    if (!isWorkingDay) return false

    // Parse the scheduled start time
    const [scheduledHours, scheduledMinutes] = shift.start_time.split(":").map(Number)

    // Create a date object for the scheduled start time on the attendance date
    const scheduledStart = new Date(attendanceDate)
    scheduledStart.setHours(scheduledHours, scheduledMinutes, 0, 0)

    // Parse the actual check-in time
    const actualCheckIn = new Date(record.check_in)

    // Employee is late if they checked in more than 15 minutes after their scheduled start time
    return actualCheckIn > new Date(scheduledStart.getTime() + 15 * 60000)
  }

  // Enhanced render function to show late status
  const render = (rows, showId = false) => {
    if (!rows || !rows.length) return <p className="no-records">No records found</p>

    return (
      <table className="attendance-table">
        <thead>
          <tr>
            {showId && <th>Employee ID</th>}
            {showId && <th>Name</th>}
            {showId && <th>Department</th>}
            <th>Date</th>
            <th>Check-In</th>
            <th>Check-Out</th>
            <th>Hours</th>
            <th>Status</th>
            {(user.role === "admin" || user.role === "manager") && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // Determine if this is the manager's own record
            const isOwnRecord =
              user.role === "manager" &&
              own.some((record) => record.employee_id === r.employee_id && record.date === r.date)

            // Check if employee was late
            const employeeLate = isLate(r)

            return (
              <tr
                key={`${r.employee_id}-${r.date}`}
                className={`status-${r.status} ${employeeLate ? "status-late" : ""}`}
              >
                {showId && <td>{r.employee_id}</td>}
                {showId && (
                  <td>
                    {r.first_name} {r.last_name}
                  </td>
                )}
                {showId && <td>{r.department || "N/A"}</td>}
                <td>{formatDate(r.date)}</td>

                <td className={employeeLate ? "late-check-in" : ""}>
                  {formatTime(r.check_in)}
                  {employeeLate && (
                    <span className="late-indicator">
                      <AlertCircle size={14} className="late-icon" aria-label="Late check-in" title="Late check-in" />
                    </span>
                  )}
                </td>
                <td>{formatTime(r.check_out)}</td>
                <td>{r.hours_worked ?? "--"}</td>

                <td className={`status-${r.status}`}>
                  <span
                    className="status-badge"
                    aria-label={`Attendance status: ${r.status}`}
                    title={`Attendance status: ${r.status}`}
                  >
                    {mapToUiValue(r.status, attendanceStatusMapping) || r.status}
                  </span>
                </td>
                {(user.role === "admin" || user.role === "manager") && (
                  <td>
                    {!isOwnRecord ? (
                      <button
                        className="edit-attendance-btn"
                        onClick={() => showCorrectionConfirmation(r)}
                        aria-label={`Edit attendance for ${r.first_name} ${r.last_name}`}
                        title={`Edit attendance record for ${r.first_name} ${r.last_name}`}
                      >
                        <Edit size={16} />
                        <span className="btn-text">Edit</span>
                      </button>
                    ) : (
                      <span className="no-edit-note" title="Managers cannot edit their own attendance">
                        Not editable
                      </span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  if (loading && !own.length && !team.length) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading attendance data...</p>
      </div>
    )
  }

  return (
    <div className="attendance-table-container">
      <h2 className="attendance-title">Attendance Dashboard</h2>

      {error && (
        <div className="error-message" role="alert">
          <AlertTriangle size={18} className="error-icon" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}

      <div className="attendance-actions-bar">
        {/* Show attendance marking for employees and managers */}
        {allowMarking && (user.role === "employee" || user.role === "manager") && (
          <div className="attendance-actions">
            <div className="attendance-status-container">
              <div className="attendance-status">
                {status ? (
                  <p>
                    Your status today: <span className={`status-badge ${status}`}>{status}</span>
                  </p>
                ) : (
                  <p>You haven't marked attendance today</p>
                )}
              </div>
              <button
                className="attendance-status-btn"
                onClick={handleAttendanceClick}
                disabled={accessBlocked}
                aria-label="Mark attendance"
              >
                <Clock size={16} />
                Mark Attendance
              </button>
            </div>
            {accessBlocked && <p className="attendance-note">You have already completed your attendance for today.</p>}
          </div>
        )}

        <button
          className="refresh-btn"
          onClick={triggerRefresh}
          title="Refresh attendance data"
          aria-label="Refresh attendance data"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "icon-spin" : ""} />
          <span>{loading ? "Loading..." : "Refresh"}</span>
        </button>
      </div>

      {/* Attendance Popup */}
      {showPopup && (
        <AttendancePopup
          onClose={handlePopupClose}
          status={status}
          setStatus={setStatus}
          setAccessBlocked={setAccessBlocked}
        />
      )}

      {/* Attendance Correction Form */}
      {showCorrectionForm && <AttendanceCorrection employee={selectedEmployee} onClose={handleCorrectionClose} />}

      {/* Admin sees all attendance */}
      {user.role === "admin" && (
        <div className="attendance-section">
          <h3>All Employee Attendance Records</h3>
          {render(team, true)}
        </div>
      )}

      {/* Manager sees their attendance and team's attendance */}
      {user.role === "manager" && (
        <>
          <div className="attendance-section">
            <h3>Your Attendance Records</h3>
            {render(own)}
          </div>
          <div className="attendance-section">
            <h3>Team Attendance Records</h3>
            {render(team, true)}
          </div>
        </>
      )}

      {/* Employee sees only their attendance */}
      {user.role === "employee" && (
        <div className="attendance-section">
          <h3>Your Attendance Records</h3>
          {render(own)}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && confirmationData && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog" role="dialog" aria-labelledby="confirm-dialog-title">
            <h3 id="confirm-dialog-title">Confirm Action</h3>
            <p>
              {confirmationData.action === "correction"
                ? `Are you sure you want to edit the attendance record for ${confirmationData.employee.first_name} ${confirmationData.employee.last_name}?`
                : "Are you sure you want to proceed with this action?"}
            </p>
            <div className="confirmation-actions">
              <button
                className="confirm-btn"
                onClick={() => {
                  if (confirmationData.action === "correction") {
                    handleCorrectionClick(confirmationData.employee)
                  }
                }}
              >
                Yes, Proceed
              </button>
              <button className="cancel-btn" onClick={() => setShowConfirmation(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendanceTable

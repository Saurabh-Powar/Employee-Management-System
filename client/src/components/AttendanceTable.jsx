"use client"

import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import AttendancePopup from "./AttendancePopup"
import AttendanceCorrection from "./AttendanceCorrection"
import "./AttendanceTableS.css"

function AttendanceTable({ allowMarking = false }) {
  const { user, refreshUser } = useAuth()
  const [own, setOwn] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [showCorrectionForm, setShowCorrectionForm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Function to trigger a refresh of attendance data
  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  // Update the fetchAttendanceData function to properly handle manager attendance
  const fetchAttendanceData = async () => {
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
        return
      }

      const data = response.data
      // For managers, separate their own attendance from team attendance
      if (user.role === "manager") {
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
          const managerEmployeeResponse = await api.get("/employees")
          const managerEmployee = managerEmployeeResponse.data.find((emp) => emp.user_id === user.id)
          if (managerEmployee) {
            employeeId = managerEmployee.id
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
      console.error(err)
      setError(err.response?.data?.message || "Could not load attendance.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttendanceData()

    // Set up auto-refresh every minute
    const intervalId = setInterval(() => {
      fetchAttendanceData()
    }, 60000)

    return () => clearInterval(intervalId)
  }, [user, refreshTrigger])

  const handleAttendanceClick = () => {
    setShowPopup(true)
  }

  const handlePopupClose = () => {
    setShowPopup(false)
    fetchAttendanceData() // Refresh data when popup closes
  }

  const handleCorrectionClick = (employee) => {
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
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString) => {
    if (!timeString) return "--"
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const render = (rows, showId = false) => {
    if (!rows.length) return <p className="no-records">No records found</p>
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

            return (
              <tr key={`${r.employee_id}-${r.date}`} className={`status-${r.status}`}>
                {showId && <td>{r.employee_id}</td>}
                {showId && (
                  <td>
                    {r.first_name} {r.last_name}
                  </td>
                )}
                {showId && <td>{r.department || "N/A"}</td>}
                <td>{formatDate(r.date)}</td>
                <td>{formatTime(r.check_in)}</td>
                <td>{formatTime(r.check_out)}</td>
                <td>{r.hours_worked ?? "--"}</td>
                <td className={`status-${r.status}`}>
                  <span className="status-badge">{r.status}</span>
                </td>
                {(user.role === "admin" || user.role === "manager") && (
                  <td>
                    {!isOwnRecord ? (
                      <button
                        className="edit-attendance-btn"
                        onClick={() => handleCorrectionClick(r)}
                        aria-label="Edit attendance"
                        title="Edit attendance record"
                      >
                        <i className="edit-icon"></i>
                        Edit
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

  if (loading)
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading attendance data...</p>
      </div>
    )

  // Update the render function to properly show attendance marking for managers too
  return (
    <div className="attendance-table-container">
      <h2 className="attendance-title">Attendance Dashboard</h2>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Show attendance marking for employees and managers */}
      {allowMarking && (user.role === "employee" || user.role === "manager") && (
        <div className="attendance-actions">
          <h3>Today's Attendance</h3>
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
            <button className="attendance-status-btn" onClick={handleAttendanceClick} disabled={accessBlocked}>
              Mark Attendance
            </button>
          </div>
          {accessBlocked && <p className="attendance-note">You have already completed your attendance for today.</p>}
        </div>
      )}

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
    </div>
  )
}

export default AttendanceTable

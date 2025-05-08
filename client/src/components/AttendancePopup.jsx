"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./AttendancePopupS.css"

function AttendancePopup({ onClose, status, setStatus, setAccessBlocked }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [employeeId, setEmployeeId] = useState(null)

  // Get the employee ID for the current user (important for managers)
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (user) {
        try {
          const response = await api.get("/employees")
          const employee = response.data.find((emp) => emp.user_id === user.id)
          if (employee) {
            setEmployeeId(employee.id)
          } else {
            setError("Could not find your employee record")
          }
        } catch (err) {
          console.error("Error fetching employee ID:", err)
          setError("Failed to load your employee data")
        }
      }
    }

    fetchEmployeeId()
  }, [user])

  const handleCheckIn = async () => {
    if (!employeeId) {
      setError("Employee ID not found")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await api.post("/attendance/checkin", { employeeId })
      if (response.status === 201) {
        setSuccess("Check-in successful!")
        setStatus("check-in")
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error("Check-in failed:", err)
      setError(err.response?.data?.message || "Check-in failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!employeeId) {
      setError("Employee ID not found")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await api.put("/attendance/checkout", { employeeId })
      if (response.status === 200) {
        setSuccess("Check-out successful!")
        setStatus("check-out")
        setAccessBlocked(true)
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error("Check-out failed:", err)
      setError(err.response?.data?.message || "Check-out failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAbsent = async () => {
    if (!employeeId) {
      setError("Employee ID not found")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await api.post("/attendance/absent", { employeeId })
      if (response.status === 201) {
        setSuccess("Marked as absent successfully!")
        setStatus("absent")
        setAccessBlocked(true)
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error("Marking absent failed:", err)
      setError(err.response?.data?.message || "Failed to mark as absent. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="attendance-popup-overlay" onClick={onClose}>
      <div className="attendance-popup" onClick={(e) => e.stopPropagation()}>
        <h2>Mark Attendance</h2>
        <p className="current-date">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
        <p className="current-time">{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>

        {error && <div className="popup-error">{error}</div>}
        {success && <div className="popup-success">{success}</div>}

        <div className="attendance-options">
          <button
            className="check-in-btn"
            onClick={handleCheckIn}
            disabled={loading || status === "check-in" || status === "check-out" || status === "absent" || !employeeId}
          >
            Check In
          </button>
          <button
            className="check-out-btn"
            onClick={handleCheckOut}
            disabled={loading || status !== "check-in" || !employeeId}
          >
            Check Out
          </button>
          <button
            className="absent-btn"
            onClick={handleAbsent}
            disabled={loading || status === "check-in" || status === "check-out" || status === "absent" || !employeeId}
          >
            Mark Absent
          </button>
        </div>

        <button className="close-btn" onClick={onClose} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default AttendancePopup

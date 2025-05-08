"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { Clock, CheckCircle, X, AlertTriangle } from "lucide-react"
import "./AttendancePopupS.css"

function AttendancePopup({ onClose, status, setStatus, setAccessBlocked }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [employeeId, setEmployeeId] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [employeeShift, setEmployeeShift] = useState(null)
  const [isLate, setIsLate] = useState(false)

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Get current employee ID based on user ID
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user) return null

      try {
        // For employees, we need to find their employee ID
        const response = await api.get("/employees")
        const employee = response.data.find((emp) => emp.user_id === user.id)

        if (employee) {
          setEmployeeId(employee.id)

          // Fetch employee's shift
          try {
            const shiftResponse = await api.get(`/shifts/${employee.id}`)
            setEmployeeShift(shiftResponse.data)

            // Check if employee is late
            if (shiftResponse.data) {
              const now = new Date()
              // Fix: Use "short" instead of "lowercase" for weekday format
              const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()

              // Check if today is a working day
              if (shiftResponse.data.days.some((day) => dayOfWeek.substring(0, 3) === day.substring(0, 3))) {
                // Parse the scheduled start time
                const [scheduledHours, scheduledMinutes] = shiftResponse.data.start_time.split(":").map(Number)

                // Create a date object for the scheduled start time
                const scheduledStart = new Date()
                scheduledStart.setHours(scheduledHours, scheduledMinutes, 0, 0)

                // Employee is late if current time is after their scheduled start time
                setIsLate(now > scheduledStart)
              }
            }
          } catch (err) {
            console.error("Error fetching employee shift:", err)
            // Set default shift
            setEmployeeShift({
              start_time: "09:00",
              end_time: "17:00",
              days: ["mon", "tue", "wed", "thu", "fri"],
            })
          }

          return employee.id
        } else {
          setError("Could not find your employee record")
        }
      } catch (err) {
        console.error("Error fetching employee ID:", err)
        setError("Failed to load your employee data")
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
      const response = await api.post("/attendance/checkin", {
        employeeId,
        isLate, // Pass the late status to the server
      })

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

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  return (
    <div className="attendance-popup-overlay" onClick={onClose}>
      <div className="attendance-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Mark Attendance</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="current-time-display">
          <Clock size={20} className="clock-icon" />
          <div className="time-info">
            <p className="current-date">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="current-time">{formatTime(currentTime)}</p>
          </div>
        </div>

        {employeeShift && (
          <div className="shift-info">
            <h3>Your Shift Today</h3>
            <p>
              <span className="shift-label">Hours:</span>
              {employeeShift.start_time} - {employeeShift.end_time}
            </p>

            {isLate && status !== "check-in" && status !== "check-out" && status !== "absent" && (
              <div className="late-warning">
                <AlertTriangle size={16} />
                <span>You are checking in after your scheduled start time.</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="popup-error">{error}</div>}
        {success && <div className="popup-success">{success}</div>}

        <div className="attendance-options">
          <button
            className="check-in-btn"
            onClick={handleCheckIn}
            disabled={loading || status === "check-in" || status === "check-out" || status === "absent" || !employeeId}
          >
            <CheckCircle size={16} />
            Check In
            {isLate && status !== "check-in" && status !== "check-out" && status !== "absent" && (
              <span className="late-badge">Late</span>
            )}
          </button>

          <button
            className="check-out-btn"
            onClick={handleCheckOut}
            disabled={loading || status !== "check-in" || !employeeId}
          >
            <Clock size={16} />
            Check Out
          </button>

          <button
            className="absent-btn"
            onClick={handleAbsent}
            disabled={loading || status === "check-in" || status === "check-out" || status === "absent" || !employeeId}
          >
            <X size={16} />
            Mark Absent
          </button>
        </div>

        {status && (
          <div className="current-status">
            <p>
              Current status: <span className={`status-badge ${status}`}>{status}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AttendancePopup

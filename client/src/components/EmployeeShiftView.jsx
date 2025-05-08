"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { Clock, Calendar } from "lucide-react"
import "./EmployeeShiftViewS.css"

function EmployeeShiftView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [employeeId, setEmployeeId] = useState(null)
  const [shift, setShift] = useState(null)

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user) return

      try {
        setLoading(true)
        // Get the employee ID for the current user
        const employeeResponse = await api.get("/employees")
        const employee = employeeResponse.data.find((emp) => emp.user_id === user.id)

        if (employee) {
          setEmployeeId(employee.id)

          // Fetch the employee's shift
          try {
            const shiftResponse = await api.get(`/shifts/${employee.id}`)
            setShift(shiftResponse.data)
          } catch (err) {
            console.error("Error fetching shift:", err)
            // Set default shift
            setShift({
              start_time: "09:00",
              end_time: "17:00",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            })
          }
        } else {
          setError("Could not find your employee record")
        }
      } catch (err) {
        console.error("Error fetching employee data:", err)
        setError("Failed to load your data")
      } finally {
        setLoading(false)
      }
    }

    fetchEmployeeData()
  }, [user])

  const getDayLabel = (day) => {
    const labels = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    }
    return labels[day] || day
  }

  const formatTime = (timeString) => {
    if (!timeString) return "Not set"

    // If it's already in HH:MM format, convert to 12-hour format
    if (/^\d{1,2}:\d{2}$/.test(timeString)) {
      const [hours, minutes] = timeString.split(":").map(Number)
      const period = hours >= 12 ? "PM" : "AM"
      const displayHours = hours % 12 || 12
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
    }

    return timeString
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your schedule...</p>
      </div>
    )
  }

  if (error) {
    return <div className="error-message">{error}</div>
  }

  if (!shift) {
    return <div className="no-shift-message">No shift schedule found.</div>
  }

  // Get current day of week
  const today = new Date().toLocaleDateString("en-US", { weekday: "lowercase" })
  const isWorkingToday = shift.days.includes(today)

  return (
    <div className="employee-shift-view">
      <div className="shift-view-header">
        <h2>My Work Schedule</h2>
        <p className="shift-description">Your assigned work hours and days</p>
      </div>

      <div className="current-schedule">
        <div className="schedule-card">
          <div className="schedule-time">
            <Clock size={20} className="schedule-icon" />
            <div className="time-details">
              <h3>Working Hours</h3>
              <p className="time-range">
                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
              </p>
            </div>
          </div>

          <div className="schedule-days">
            <Calendar size={20} className="schedule-icon" />
            <div className="days-details">
              <h3>Working Days</h3>
              <div className="days-list">
                {shift.days.map((day) => (
                  <span key={day} className={`day-item ${day === today ? "today" : ""}`}>
                    {getDayLabel(day)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="today-status">
          <h3>Today's Status</h3>
          {isWorkingToday ? (
            <div className="working-today">
              <p>
                You are scheduled to work today from {formatTime(shift.start_time)} to {formatTime(shift.end_time)}.
              </p>
              <p className="reminder">
                Remember to check in before {formatTime(shift.start_time)} to avoid being marked late.
              </p>
            </div>
          ) : (
            <div className="not-working-today">
              <p>You are not scheduled to work today.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmployeeShiftView

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./EmployeeShiftViewS.css"

function EmployeeShiftView() {
  const { user } = useAuth()
  const [shift, setShift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isWorkingToday, setIsWorkingToday] = useState(false)
  const [employeeId, setEmployeeId] = useState(null)

  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user) return

      try {
        const response = await api.get("/employees")
        const employee = response.data.find((emp) => emp.user_id === user.id)

        if (employee) {
          setEmployeeId(employee.id)
          return employee.id
        }
      } catch (err) {
        console.error("Error fetching employee ID:", err)
        setError("Failed to load employee data")
      }
    }

    fetchEmployeeId().then((id) => {
      if (id) {
        fetchShift(id)
      } else {
        setLoading(false)
      }
    })
  }, [user])

  const fetchShift = async (id) => {
    try {
      const response = await api.get(`/shifts/${id}`)
      setShift(response.data)

      // Check if today is a working day
      const today = new Date()
      // Use "short" format and convert to lowercase
      const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()

      // Check if the day is in the employee's working days
      // Use substring to match the first 3 characters (mon, tue, wed, etc.)
      const isWorking = response.data.days.some((day) => dayOfWeek.substring(0, 3) === day.substring(0, 3))

      setIsWorkingToday(isWorking)
    } catch (err) {
      console.error("Error fetching shift:", err)
      setError("Failed to load shift data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="shift-loading">Loading shift information...</div>
  }

  if (error) {
    return <div className="shift-error">{error}</div>
  }

  if (!shift) {
    return <div className="no-shift">No shift information available.</div>
  }

  return (
    <div className="employee-shift-view">
      <h3>Your Work Schedule</h3>

      <div className="shift-details">
        <div className="shift-time">
          <span className="shift-label">Working Hours:</span>
          <span className="shift-value">
            {shift.start_time} - {shift.end_time}
          </span>
        </div>

        <div className="shift-days">
          <span className="shift-label">Working Days:</span>
          <div className="days-container">
            {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
              <div key={day} className={`day-indicator ${shift.days.includes(day) ? "working-day" : "off-day"}`}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </div>
            ))}
          </div>
        </div>

        <div className="today-status">
          <span className="shift-label">Today:</span>
          <span className={`status-indicator ${isWorkingToday ? "working" : "off"}`}>
            {isWorkingToday ? "Working Day" : "Day Off"}
          </span>
        </div>
      </div>
    </div>
  )
}

export default EmployeeShiftView

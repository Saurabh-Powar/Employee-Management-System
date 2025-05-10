"use client"

import { useState, useEffect, useRef } from "react"
import api from "../services/api"
import { Clock, Play, Square, Calendar } from "lucide-react"
import "./TaskTimerS.css"
import websocketService from "../services/websocket"

function TaskTimer({ task, onClose }) {
  const [isRunning, setIsRunning] = useState(false)
  const [time, setTime] = useState(0)
  const [timerHistory, setTimerHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const intervalRef = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Fetch timer history when component mounts
    fetchTimerHistory()

    return () => {
      // Clean up interval on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Update the fetchTimerHistory function to handle API responses correctly
  const fetchTimerHistory = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/tasks/${task.id}/timer/history`)
      if (Array.isArray(response.data)) {
        setTimerHistory(response.data)
      } else {
        setTimerHistory([])
      }
      setLoading(false)
    } catch (err) {
      console.error("Failed to fetch timer history:", err)
      setError("Failed to load timer history")
      setLoading(false)
    }
  }

  // Update the startTimer function
  const startTimer = async () => {
    try {
      await api.post(`/tasks/${task.id}/timer/start`)
      setIsRunning(true)
      setTime(0)

      // Start the timer
      intervalRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 1)
      }, 1000)

      // Update task status to in_progress
      await api.put(`/tasks/${task.id}/status`, { status: "in_progress" })

      setSuccess("Timer started successfully")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Failed to start timer:", err)
      setError(err.response?.data?.message || "Failed to start timer")
      setTimeout(() => setError(""), 3000)
    }
  }

  // Update the stopTimer function
  const stopTimer = async () => {
    if (!isRunning) return

    setIsSubmitting(true)

    try {
      const response = await api.post(`/tasks/${task.id}/timer/stop`)

      // Stop the timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      setIsRunning(false)
      setSuccess("Timer stopped successfully")
      setTimeout(() => setSuccess(""), 3000)

      // Refresh timer history
      fetchTimerHistory()

      // Send WebSocket notification to managers about progress
      if (task.assigned_by) {
        websocketService.send({
          type: "task_progress_update",
          data: {
            task_id: task.id,
            employee_id: task.employee_id,
            time_spent: response.data.duration,
            task_title: task.title,
          },
        })
      }

      onClose()
    } catch (err) {
      console.error("Failed to stop timer:", err)
      setError(err.response?.data?.message || "Failed to stop timer")
      setTimeout(() => setError(""), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return "0m"

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="task-timer-overlay" onClick={onClose}>
      <div className="task-timer" onClick={(e) => e.stopPropagation()}>
        <div className="timer-header">
          <h2>Task Timer</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="task-info">
          <h3>{task.title}</h3>
          <p className="task-description">{task.description || "No description provided"}</p>
          <div className="task-due-date">
            <Calendar size={14} className="icon" />
            Due:{" "}
            {new Date(task.due_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="timer-display">
          <div className="time">{formatTime(time)}</div>
          <div className="timer-controls">
            {!isRunning ? (
              <button className="start-btn" onClick={startTimer}>
                <Play size={16} />
                Start Timer
              </button>
            ) : (
              <button className="stop-btn" onClick={stopTimer} disabled={isSubmitting}>
                <Square size={16} />
                Stop Timer
              </button>
            )}
          </div>
        </div>

        <div className="timer-history">
          <h3>
            <Clock size={16} className="icon" />
            Timer History
          </h3>
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading timer history...</p>
            </div>
          ) : timerHistory.length === 0 ? (
            <p className="no-history">No timer history available</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {timerHistory.map((timer) => (
                  <tr key={timer.id}>
                    <td>{formatDateTime(timer.start_time)}</td>
                    <td>{timer.end_time ? formatDateTime(timer.end_time) : "In progress"}</td>
                    <td>{timer.duration ? formatDuration(timer.duration) : "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskTimer

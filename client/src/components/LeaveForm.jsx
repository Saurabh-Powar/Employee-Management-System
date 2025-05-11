"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { Calendar, CheckCircle } from "lucide-react"
import "./LeaveFormS.css"
import websocketService from "../services/websocket"

function LeaveForm() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  // Add confirmation dialog state
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Update fetchLeaveRequests function to handle API responses correctly
  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLoadingRequests(true)
      // Use the correct employee ID from the user object
      const response = await api.get(`/leaves/${user.id}`)
      if (response.data && response.data.leaves) {
        setLeaveRequests(response.data.leaves)
      } else {
        setLeaveRequests([])
      }
    } catch (err) {
      console.error("Failed to fetch leave requests:", err)
      setError(err.response?.data?.message || "Failed to fetch leave requests. Please try again.")
    } finally {
      setLoadingRequests(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchLeaveRequests()
    }
  }, [user?.id, fetchLeaveRequests])

  // Add a useEffect hook for WebSocket listeners
  useEffect(() => {
    // Set up WebSocket listener for leave updates
    const leaveUpdateListener = websocketService.on("leave_update", (data) => {
      console.log("Received leave update via WebSocket:", data)
      fetchLeaveRequests() // Refresh the leave requests
    })

    // Clean up listener on unmount
    return () => {
      leaveUpdateListener()
    }
  }, [fetchLeaveRequests])

  // Improve the validation and date handling in handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")

    // Show confirmation dialog instead of submitting immediately
    const trimmedReason = reason.trim()
    if (!startDate || !endDate || !trimmedReason) {
      setError("All fields are required.")
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (end < start) {
      setError("End date cannot be before start date.")
      return
    }

    if (start < today) {
      setError("Start date cannot be in the past.")
      return
    }

    // Show confirmation dialog
    setShowConfirmation(true)
  }

  // Add submitLeaveRequest function
  const submitLeaveRequest = async () => {
    try {
      setLoading(true)
      setShowConfirmation(false)

      const payload = {
        employee_id: user.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      }

      const response = await api.post("/leaves", payload)

      if (response.status === 201) {
        setMessage(`Leave requested from ${formatDate(startDate)} to ${formatDate(endDate)}`)
        setStartDate("")
        setEndDate("")
        setReason("")
        fetchLeaveRequests() // Refresh the leave requests
      } else {
        setError("Unexpected server response. Please try again.")
      }
    } catch (err) {
      console.error("Leave submission error:", err)
      setError(err?.response?.data?.error || "Failed to submit leave request. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!showConfirmation) return

    // Focus trap for the confirmation dialog
    const handleTabKey = (e) => {
      if (e.key === "Tab") {
        const focusableElements = document
          .querySelector(".leave-confirmation")
          .querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      } else if (e.key === "Escape") {
        setShowConfirmation(false)
      }
    }

    document.addEventListener("keydown", handleTabKey)

    // Focus the first interactive element when dialog opens
    const firstButton = document.querySelector(".leave-confirmation .confirm-btn")
    if (firstButton) {
      setTimeout(() => firstButton.focus(), 100)
    }

    return () => {
      document.removeEventListener("keydown", handleTabKey)
    }
  }, [showConfirmation])

  return (
    <div className="leave-container">
      <form className="leave-form" onSubmit={handleSubmit} aria-busy={loading}>
        <h2>Apply for Leave</h2>
        <div className="form-group">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="submit-btn" aria-label="Submit leave request">
          {loading ? (
            <>
              <span className="spinner"></span>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Calendar size={16} className="icon" aria-hidden="true" />
              <span>Submit Request</span>
            </>
          )}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="leave-requests">
        <h2>My Leave Requests</h2>
        {loadingRequests ? (
          <p className="loading">Loading your leave requests...</p>
        ) : leaveRequests.length === 0 ? (
          <p className="no-requests">You have no leave requests.</p>
        ) : (
          <table className="leave-table">
            <thead>
              <tr>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Requested On</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((leave) => (
                <tr key={leave.id} className={`status-${leave.status}`}>
                  <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                  <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                  <td>{leave.reason}</td>
                  <td className="status">
                    <span
                      className={`status-badge status-${leave.status}`}
                      aria-label={`Request status: ${leave.status}`}
                    >
                      {leave.status}
                    </span>
                  </td>
                  <td>{new Date(leave.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showConfirmation && (
        <div className="leave-confirmation-overlay" role="dialog" aria-labelledby="confirm-leave-title">
          <div className="leave-confirmation">
            <h3 id="confirm-leave-title">Confirm Leave Request</h3>
            <p>Are you sure you want to request leave for the following period?</p>
            <div className="leave-details">
              <p>
                <strong>Start Date:</strong> {formatDate(startDate)}
              </p>
              <p>
                <strong>End Date:</strong> {formatDate(endDate)}
              </p>
              <p>
                <strong>Reason:</strong> {reason}
              </p>
            </div>
            <div className="confirmation-actions">
              <button
                type="button"
                className="confirm-btn"
                onClick={submitLeaveRequest}
                aria-label="Confirm leave request"
              >
                <CheckCircle size={16} />
                Confirm Request
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowConfirmation(false)}
                aria-label="Cancel leave request"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveForm

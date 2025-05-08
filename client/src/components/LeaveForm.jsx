"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./LeaveFormS.css"

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

  useEffect(() => {
    if (user?.id) {
      fetchLeaveRequests()
    }
  }, [user?.id])

  // Update fetchLeaveRequests function to handle API responses correctly
  const fetchLeaveRequests = async () => {
    try {
      setLoadingRequests(true)
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
  }

  // Improve the validation and date handling in handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")

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

    try {
      setLoading(true)
      const payload = {
        employee_id: user.id,
        start_date: startDate,
        end_date: endDate,
        reason: trimmedReason,
      }

      const response = await api.post("/leaves", payload)

      if (response.status === 201) {
        setMessage(
          `Leave requested from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
        )
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
        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
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
                  <td className="status">{leave.status}</td>
                  <td>{new Date(leave.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default LeaveForm

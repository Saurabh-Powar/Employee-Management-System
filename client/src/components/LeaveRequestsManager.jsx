"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./LeaveRequestsManagerS.css"
import websocketService from "../services/websocket"

function LeaveRequestsManager() {
  const { user } = useAuth()
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Fix the fetchLeaveRequests function to properly handle API responses
  const fetchLeaveRequests = async () => {
    if (!user || (user.role !== "manager" && user.role !== "admin")) return

    setLoading(true)
    setError("")
    try {
      const response = await api.get("/leaves")
      if (response.data && response.data.leaves) {
        setLeaveRequests(response.data.leaves)
      } else {
        setLeaveRequests([])
        if (response.data.length === 0) {
          setError("No leave requests available.")
        }
      }
    } catch (err) {
      console.error("Failed to fetch leave requests:", err)
      setError(err.response?.data?.message || "Could not load leave requests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchLeaveRequests()
    }
  }, [user?.id])

  // Add a useEffect hook for WebSocket listeners
  useEffect(() => {
    // Set up WebSocket listener for new leave requests
    const newLeaveListener = websocketService.on("new_leave_request", (data) => {
      console.log("Received new leave request via WebSocket:", data)
      fetchLeaveRequests() // Refresh the leave requests
    })

    // Set up WebSocket listener for leave updates
    const leaveUpdateListener = websocketService.on("leave_update", (data) => {
      console.log("Received leave update via WebSocket:", data)
      fetchLeaveRequests() // Refresh the leave requests
    })

    // Clean up listeners on unmount
    return () => {
      newLeaveListener()
      leaveUpdateListener()
    }
  }, [])

  // Improve the handleUpdateStatus function to better handle errors and state updates
  const handleUpdateStatus = async (leaveId, status) => {
    try {
      const response = await api.put(`/leaves/${leaveId}`, { status })

      if (response.status === 200) {
        // Update local state
        setLeaveRequests((prev) => prev.map((leave) => (leave.id === leaveId ? { ...leave, status } : leave)))

        setSuccessMessage(`Leave request ${status} successfully.`)

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("")
        }, 3000)
      } else {
        throw new Error("Unexpected response from server")
      }
    } catch (err) {
      console.error(`Failed to ${status} leave request:`, err)
      setError(err.response?.data?.message || `Failed to ${status} leave request.`)

      // Clear error message after 5 seconds
      setTimeout(() => {
        setError("")
      }, 5000)
    }
  }

  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return <p>You do not have permission to view leave requests.</p>
  }

  if (loading) return <p className="loading-message">Loading leave requests...</p>

  return (
    <div className="leave-requests-container">
      <h2>Leave Requests Management</h2>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="action-bar">
        <button className="refresh-btn" onClick={fetchLeaveRequests}>
          Refresh Requests
        </button>
      </div>

      {leaveRequests.length === 0 ? (
        <p className="no-requests">No leave requests found.</p>
      ) : (
        <table className="leave-requests-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Duration</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.map((leave) => {
              // Calculate duration in days
              const startDate = new Date(leave.start_date)
              const endDate = new Date(leave.end_date)
              const durationMs = endDate.getTime() - startDate.getTime()
              const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end days

              return (
                <tr key={leave.id} className={`status-${leave.status}`}>
                  <td>{leave.employee_name || `Employee #${leave.employee_id}`}</td>
                  <td>{leave.department || "N/A"}</td>
                  <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                  <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                  <td>
                    {durationDays} day{durationDays !== 1 ? "s" : ""}
                  </td>
                  <td>{leave.reason}</td>
                  <td className={`status status-${leave.status}`}>{leave.status}</td>
                  <td className="actions">
                    {leave.status === "pending" && (
                      <>
                        <button className="approve-btn" onClick={() => handleUpdateStatus(leave.id, "approved")}>
                          Approve
                        </button>
                        <button className="reject-btn" onClick={() => handleUpdateStatus(leave.id, "rejected")}>
                          Reject
                        </button>
                      </>
                    )}
                    {leave.status !== "pending" && (
                      <span className="status-label">{leave.status === "approved" ? "Approved" : "Rejected"}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default LeaveRequestsManager

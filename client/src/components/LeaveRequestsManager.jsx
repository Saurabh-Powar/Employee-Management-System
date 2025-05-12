"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./LeaveRequestsManagerS.css"
import * as websocketService from "../services/websocket";
import { RefreshCw, CheckCircle, X } from "lucide-react"

function LeaveRequestsManager() {
  const { user } = useAuth()
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmData, setConfirmData] = useState(null)

  // Improved fetchLeaveRequests function with better error handling
  const fetchLeaveRequests = useCallback(async () => {
    if (!user || (user.role !== "manager" && user.role !== "admin")) return

    setLoading(true)
    setError("")

    try {
      const response = await api.get("/leaves")

      if (response.data && Array.isArray(response.data.leaves)) {
        setLeaveRequests(response.data.leaves)
      } else if (response.data && Array.isArray(response.data)) {
        setLeaveRequests(response.data)
      } else {
        setLeaveRequests([])
        if (!response.data || response.data.length === 0) {
          console.log("No leave requests available.")
        }
      }
    } catch (err) {
      console.error("Failed to fetch leave requests:", err)
      setError(err.response?.data?.message || "Could not load leave requests.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user?.id) {
      fetchLeaveRequests()
    }
  }, [user?.id, fetchLeaveRequests])

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    const newLeaveListener = websocketService.subscribeToEvent("new_leave_request", (data) => {
      console.log("Received new leave request via WebSocket:", data)
      fetchLeaveRequests()
    })

    const leaveUpdateListener = websocketService.subscribeToEvent("leave_update", (data) => {
      console.log("Received leave update via WebSocket:", data)
      fetchLeaveRequests()
    })

    // Keep WebSocket connection alive
    const cleanupKeepAlive = websocketService.setupKeepAlive(30000)

    // Clean up listeners on unmount
    return () => {
      newLeaveListener()
      leaveUpdateListener()
      cleanupKeepAlive()
    }
  }, [fetchLeaveRequests])

  // Show confirmation dialog
  const showConfirm = (leaveId, status) => {
    setConfirmData({ leaveId, status })
    setShowConfirmDialog(true)
  }

  // Handle leave status update with improved error handling
  const handleUpdateStatus = async (leaveId, status) => {
    setShowConfirmDialog(false)

    try {
      setLoading(true)
      const response = await api.put(`/leaves/${leaveId}`, { status })

      if (response.status === 200) {
        // Optimistic UI update
        setLeaveRequests((prev) => prev.map((leave) => (leave.id === leaveId ? { ...leave, status } : leave)))

        setSuccessMessage(`Leave request ${status} successfully.`)

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("")
        }, 3000)

        // Refresh data to ensure consistency
        fetchLeaveRequests()
      } else {
        throw new Error(response.data?.message || "Unexpected response from server")
      }
    } catch (err) {
      console.error(`Failed to ${status} leave request:`, err)
      setError(err.response?.data?.message || `Failed to ${status} leave request.`)

      // Clear error message after 5 seconds
      setTimeout(() => {
        setError("")
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return <p>You do not have permission to view leave requests.</p>
  }

  if (loading && leaveRequests.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-message">Loading leave requests...</p>
      </div>
    )
  }

  return (
    <div className="leave-requests-container">
      <h2>Leave Requests Management</h2>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}

      <div className="action-bar">
        <button
          className="refresh-btn"
          onClick={fetchLeaveRequests}
          disabled={loading}
          aria-label="Refresh leave requests"
        >
          <RefreshCw size={16} />
          <span>{loading ? "Loading..." : "Refresh Requests"}</span>
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
                        <button
                          className="approve-btn"
                          onClick={() => showConfirm(leave.id, "approved")}
                          aria-label={`Approve leave request for ${leave.employee_name || `Employee #${leave.employee_id}`}`}
                        >
                          <CheckCircle size={16} />
                          <span>Approve</span>
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => showConfirm(leave.id, "rejected")}
                          aria-label={`Reject leave request for ${leave.employee_name || `Employee #${leave.employee_id}`}`}
                        >
                          <X size={16} />
                          <span>Reject</span>
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmData && (
        <div className="confirmation-dialog-overlay">
          <div className="confirmation-dialog" role="dialog" aria-labelledby="confirm-title">
            <h3 id="confirm-title">{confirmData.status === "approved" ? "Approve" : "Reject"} Leave Request</h3>
            <p>
              Are you sure you want to {confirmData.status === "approved" ? "approve" : "reject"} this leave request?
            </p>
            <div className="confirmation-actions">
              <button
                className="confirm-btn"
                onClick={() => handleUpdateStatus(confirmData.leaveId, confirmData.status)}
              >
                Yes, {confirmData.status === "approved" ? "Approve" : "Reject"}
              </button>
              <button className="cancel-btn" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveRequestsManager

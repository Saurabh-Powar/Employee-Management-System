"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./NotificationPanelS.css"

function NotificationPanel() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryCount, setRetryCount] = useState(0)

  // Update the fetchNotifications function to handle API responses correctly
  const fetchNotifications = async () => {
    if (!user?.id) {
      setLoading(false)
      setNotifications([])
      setError("No user is currently logged in.")
      return
    }

    setLoading(true)
    setError("")
    try {
      const { data } = await api.get(`/notifications/${user.id}`)
      // Check if data is an array directly or nested in a property
      if (Array.isArray(data)) {
        setNotifications(data)
      } else if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications)
      } else {
        setNotifications([])
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err)
      setError("Could not load notifications. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Add a function to mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      // Update the local state to reflect the change
      setNotifications((prevNotifications) =>
        prevNotifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
      )
    } catch (err) {
      console.error("Failed to mark notification as read:", err)
    }
  }

  // Add a function to mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await api.put(`/notifications/read-all/${user.id}`)
      // Update all notifications in the local state
      setNotifications((prevNotifications) => prevNotifications.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Set up auto-refresh every 30 seconds
    const intervalId = setInterval(fetchNotifications, 30000)

    return () => clearInterval(intervalId)
  }, [user?.id, retryCount])

  // Update the return statement to include the new functionality
  return (
    <div className="notification-panel">
      <div className="notification-header-container">
        <h2>Notifications</h2>
        {!loading && !error && notifications.length > 0 && (
          <button className="mark-all-read-btn" onClick={markAllAsRead}>
            Mark all as read
          </button>
        )}
      </div>

      {loading && <p className="loading">Loading notifications...</p>}

      {!loading && error && (
        <div className="notification-error-state">
          <p className="error">{error}</p>
          <button className="retry-btn" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`notification ${n.type} ${n.is_read ? "read" : "unread"}`}
              onClick={() => !n.is_read && markAsRead(n.id)}
            >
              <div className="notification-header">
                <span className="notification-title">{n.title}</span>
                <span className="notification-time">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <div className="notification-body">
                <div className="message">{n.message}</div>
                <div className="sender">
                  From: {n.sender_name || "System"}
                  {n.sender_role && <span className="sender-role">({n.sender_role})</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && notifications.length === 0 && <p className="no-notifications">No notifications</p>}
    </div>
  )
}

export default NotificationPanel

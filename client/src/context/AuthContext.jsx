"use client"

import { createContext, useState, useEffect, useContext } from "react"
import { login as loginService, logout as logoutService, checkAuthStatus } from "../services/auth"
import {
  initializeWebSocket,
  closeWebSocket,
  addWebSocketListener,
  removeWebSocketListener,
} from "../services/websocket"
import axios from "axios"

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notifications, setNotifications] = useState([])

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("token")

        if (!token) {
          setLoading(false)
          return
        }

        // Set token in axios default headers
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

        const authData = await checkAuthStatus()

        if (authData?.user) {
          setUser(authData.user)

          // Initialize WebSocket if needed
          if (authData.user.id && token) {
            initializeWebSocket(authData.user.id, token)
          }
        } else {
          // Clear invalid token
          localStorage.removeItem("token")
          delete axios.defaults.headers.common["Authorization"]
        }
      } catch (err) {
        console.error("Auth check error:", err)
        setError("Failed to authenticate")

        // Clear potentially invalid token
        localStorage.removeItem("token")
        delete axios.defaults.headers.common["Authorization"]
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    return () => {
      if (user) {
        closeWebSocket()
      }
    }
  }, [])

  // Set up WebSocket notification listener when user is logged in
  useEffect(() => {
    if (!user) return

    const handleWebSocketMessage = (data) => {
      if (data.type === "notification") {
        setNotifications((prev) => [data.notification, ...prev])
      }
    }

    const wsListener = addWebSocketListener(handleWebSocketMessage)

    return () => {
      removeWebSocketListener(wsListener)
    }
  }, [user])

  // Login function
  const handleLogin = async (email, password) => {
    try {
      setLoading(true)
      setError(null)

      // Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required")
      }

      const userData = await loginService(email, password)

      if (!userData || !userData.user || !userData.token) {
        throw new Error("Invalid response from server")
      }

      setUser(userData.user)

      // Set the default Authorization header
      axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`

      // Initialize WebSocket connection after successful login
      if (userData.user.id) {
        initializeWebSocket(userData.user.id, userData.token)
      }

      return userData
    } catch (err) {
      console.error("Login error:", err)
      setError(err.message || "Failed to login")
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Logout function
  const handleLogout = async () => {
    try {
      setLoading(true)
      await logoutService()

      // Remove the default Authorization header
      delete axios.defaults.headers.common["Authorization"]

      // Close WebSocket connection
      closeWebSocket()

      setUser(null)
      setNotifications([])
    } catch (err) {
      console.error("Logout error:", err)
      setError(err.message || "Failed to logout")
    } finally {
      setLoading(false)
    }
  }

  // Axios interceptor for 401 responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          console.log("Unauthorized access, redirecting to login")
          localStorage.removeItem("token")
          delete axios.defaults.headers.common["Authorization"]
          setUser(null)
          window.location.href = "/login"
        }
        return Promise.reject(error)
      },
    )

    return () => {
      // Remove the interceptor when the component unmounts
      axios.interceptors.response.eject(interceptor)
    }
  }, [])

  // Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)),
    )
  }

  // Clear notification
  const clearNotification = (notificationId) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId))
  }

  const value = {
    user,
    loading,
    error,
    notifications,
    login: handleLogin,
    logout: handleLogout,
    markNotificationAsRead,
    clearNotification,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

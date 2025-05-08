"use client"

import { createContext, useContext, useState, useEffect } from "react"
import authService from "../services/auth"

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const userData = await authService.getUser()
        console.log("Initial auth check:", userData)
        if (userData && userData.user) {
          setUser(userData.user)
          console.log("User authenticated:", userData.user)
        }
      } catch (err) {
        console.log("Not authenticated yet:", err.message)
        // Don't set error here as this is expected on initial load
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // Login function
  const login = async (username, password) => {
    setError(null)
    try {
      const response = await authService.login(username, password)
      console.log("Login response:", response)

      // Check if the response contains user data
      if (response && response.user) {
        setUser(response.user)
        return response
      } else if (response && response.id && response.role) {
        // Handle case where user data is directly in the response
        const userData = {
          id: response.id,
          username: response.username || username,
          role: response.role,
        }
        setUser(userData)
        return { user: userData }
      } else {
        throw new Error("Invalid response format from server")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError(err.message || "Login failed")
      throw err
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await authService.logout()
      setUser(null)
    } catch (err) {
      console.error("Logout error:", err)
      setError(err.message || "Logout failed")
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    try {
      const userData = await authService.refreshUser()
      console.log("Refreshed user data:", userData)
      if (userData && userData.user) {
        setUser(userData.user)
      } else if (userData && userData.id && userData.role) {
        setUser(userData)
      }
      return userData
    } catch (err) {
      console.error("Error refreshing user:", err)
      setError(err.message || "Failed to refresh user data")
      throw err
    }
  }

  // Check if user has a specific role
  const hasRole = (role) => {
    return user && user.role === role
  }

  // Auth context value
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    refreshUser,
    hasRole,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

"use client"

import { createContext, useContext, useState, useEffect } from "react"
import authService from "../services/auth"

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch user data from the server (on mount or refresh)
  const fetchUser = async () => {
    try {
      const userData = await authService.getUser()
      if (userData && userData.user && userData.user.id && userData.user.role) {
        setUser(userData.user)
      } else if (userData && userData.id && userData.role) {
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Initial user fetch on app load
  useEffect(() => {
    fetchUser()
  }, [])

  // Handle login process
  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password)
      const loggedInUser = data.user || data
      if (loggedInUser && loggedInUser.id && loggedInUser.role) {
        setUser(loggedInUser)
      } else {
        setUser(null)
      }
      return loggedInUser
    } catch (error) {
      console.error("Login failed:", error)
      throw error
    }
  }

  // Handle logout process
  const logout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setUser(null)
    }
  }

  // Refresh user info after profile/role updates
  const refreshUser = async () => {
    setLoading(true)
    await fetchUser()
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

import axios from "axios"

// Base URL for API requests
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

// Configure axios with base URL
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies/sessions
})

// Set up request interceptor to add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Login user
export const login = async (email, password) => {
  try {
    console.log("Sending login request with:", { email, password })
    const response = await api.post("/auth/login", { email, password })

    // Store token in localStorage
    if (response.data.token) {
      localStorage.setItem("token", response.data.token)
    }

    return response.data
  } catch (error) {
    console.error("Login error:", error.response?.data || error.message)
    throw error.response?.data || error
  }
}

// Logout user
export const logout = async () => {
  try {
    await api.post("/auth/logout")
    localStorage.removeItem("token")
  } catch (error) {
    console.error("Logout error:", error)
    // Still remove token even if server logout fails
    localStorage.removeItem("token")
    throw error
  }
}

// Check authentication status
export const checkAuthStatus = async () => {
  try {
    const response = await api.get("/auth/check")
    return response.data
  } catch (error) {
    console.error("Auth check error:", error)
    throw error
  }
}

// Refresh user data
export const refreshUser = async () => {
  try {
    const response = await api.get("/auth/refresh-user")
    return response.data
  } catch (error) {
    console.error("Refresh user error:", error)
    throw error
  }
}

export default {
  login,
  logout,
  checkAuthStatus,
  refreshUser,
}

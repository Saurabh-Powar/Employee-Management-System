import api from "./api"

const authService = {
  // Login user
  login: async (username, password) => {
    try {
      const response = await api.post("/auth/login", { username, password })
      console.log("Login API response:", response.data)
      return response.data
    } catch (error) {
      console.error("Login API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Logout user
  logout: async () => {
    try {
      const response = await api.post("/auth/logout")
      return response.data
    } catch (error) {
      console.error("Logout API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Get current user
  getUser: async () => {
    try {
      const response = await api.get("/auth/user")
      console.log("Get user API response:", response.data)
      return response.data
    } catch (error) {
      console.error("Get user API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Check authentication status
  checkAuth: async () => {
    try {
      const response = await api.get("/auth/check")
      return response.data
    } catch (error) {
      console.error("Check auth API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Refresh user data
  refreshUser: async () => {
    try {
      const response = await api.get("/auth/refresh")
      console.log("Refresh user API response:", response.data)
      return response.data
    } catch (error) {
      console.error("Refresh user API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },
}

export default authService

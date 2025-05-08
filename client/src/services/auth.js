import api from "./api"

const authService = {
  // Login service
  async login(username, password) {
    try {
      const response = await api.post("/auth/login", { username, password })
      return response.data
    } catch (error) {
      console.error("Login failed:", error?.response?.data || error.message || error)
      throw error
    }
  },

  // Logout service
  async logout() {
    try {
      await api.post("/auth/logout")
    } catch (error) {
      console.error("Logout failed:", error?.response?.data || error.message || error)
      throw error
    }
  },

  // Fetch logged-in user details
  async getUser() {
    try {
      const response = await api.get("/auth/user")
      return response.data
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("User not authenticated")
        return null
      }
      console.error("Fetching user failed:", error?.response?.data || error.message || error)
      throw error
    }
  },

  // Refresh user session data (role-aware)
  async refreshUser() {
    try {
      const response = await api.get("/auth/refresh-user")
      return response.data
    } catch (error) {
      console.error("Refreshing user data failed:", error?.response?.data || error.message || error)
      throw error
    }
  },
}

export default authService

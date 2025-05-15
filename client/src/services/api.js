import axios from "axios"

// Create an axios instance with default config
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies/sessions
})

// Request interceptor for adding auth token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor for handling common errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // Clear token if it exists
      localStorage.removeItem("token")

      // Redirect to login if not already there
      if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  },
)

// API service with methods for common operations
export const api = {
  // Set auth token in headers
  setAuthToken: (token) => {
    if (token) {
      instance.defaults.headers.common.Authorization = `Bearer ${token}`
    }
  },

  // Clear auth token from headers
  clearAuthToken: () => {
    delete instance.defaults.headers.common.Authorization
  },

  // GET request
  get: async (url, config = {}) => {
    try {
      return await instance.get(url, config)
    } catch (error) {
      console.error(`GET ${url} error:`, error)
      throw error
    }
  },

  // POST request
  post: async (url, data = {}, config = {}) => {
    try {
      return await instance.post(url, data, config)
    } catch (error) {
      console.error(`POST ${url} error:`, error)
      throw error
    }
  },

  // PUT request
  put: async (url, data = {}, config = {}) => {
    try {
      return await instance.put(url, data, config)
    } catch (error) {
      console.error(`PUT ${url} error:`, error)
      throw error
    }
  },

  // DELETE request
  delete: async (url, config = {}) => {
    try {
      return await instance.delete(url, config)
    } catch (error) {
      console.error(`DELETE ${url} error:`, error)
      throw error
    }
  },

  // The axios instance itself for custom requests
  instance,
}

// Define shiftsAPI for shift-related API calls
export const shiftsAPI = {
  getShifts: async () => {
    return api.get("/shifts")
  },
  createShift: async (shiftData) => {
    return api.post("/shifts", shiftData)
  },
  updateShift: async (shiftId, shiftData) => {
    return api.put(`/shifts/${shiftId}`, shiftData)
  },
  deleteShift: async (shiftId) => {
    return api.delete(`/shifts/${shiftId}`)
  },
}

// Ensure fetchTasks is defined and exported
export const fetchTasks = async (endpoint) => {
  try {
    const response = await api.get(endpoint)
    return response.data // Return the tasks data
  } catch (error) {
    console.error("Error fetching tasks:", error.response?.data || error.message)
    throw error.response?.data || error
  }
}

export const updateTaskStatus = async (taskId, data) => {
  try {
    const response = await api.put(`/tasks/${taskId}/status`, data)
    return response.data // Return the updated task data
  } catch (error) {
    console.error("Error updating task status:", error.response?.data || error.message)
    throw error.response?.data || error
  }
}

export default api

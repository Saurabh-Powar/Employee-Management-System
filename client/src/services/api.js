import axios from "axios"

// Create an axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies/sessions
})

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    // You can add auth headers here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle session expiration or auth errors
    if (error.response && error.response.status === 401) {
      console.error("Authentication error:", error.response.data)
      // You could dispatch a logout action here or redirect
    }
    return Promise.reject(error)
  },
)

export default api

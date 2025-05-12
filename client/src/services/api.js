import axios from "axios"

// Create an axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  },
})

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // You can modify the request config here (add headers, etc.)
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors here
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("API Error Response:", error.response.status, error.response.data)

      // Handle 401 Unauthorized - redirect to login
      if (error.response.status === 401) {
        console.log("Unauthorized access, redirecting to login")
        // Check if we're not already on the login page to avoid redirect loops
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login"
        }
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error("API No Response:", error.request)
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("API Request Error:", error.message)
    }

    return Promise.reject(error)
  },
)

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
    const response = await api.get(endpoint);
    return response.data; // Return the tasks data
  } catch (error) {
    console.error("Error fetching tasks:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

export const updateTaskStatus = async (taskId, data) => {
  try {
    const response = await api.put(`/tasks/${taskId}/status`, data);
    return response.data; // Return the updated task data
  } catch (error) {
    console.error("Error updating task status:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

export default api

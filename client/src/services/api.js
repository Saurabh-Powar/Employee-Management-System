// Fix the API service to properly handle task-related API calls
import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
})

// Add request interceptor to ensure auth headers are sent
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage if available
    const token = localStorage.getItem("authToken")
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error("Authentication error:", error.response.data)
      // Optionally redirect to login page
      // window.location.href = '/login';
    }
    return Promise.reject(error)
  },
)

// Attendance-related helpers
export const attendanceAPI = {
  checkIn: (employee_id) => api.post("/attendance/checkin", { employeeId: employee_id }),

  checkOut: (employee_id) => api.put("/attendance/checkout", { employeeId: employee_id }),

  markAbsent: (employee_id) => api.post("/attendance/absent", { employeeId: employee_id }),

  getEmployeeAttendanceStatus: (employee_id) => api.get(`/attendance/${employee_id}`), // Used to get the status or records of a specific employee's attendance

  getAllAttendanceRecords: () => api.get("/attendance"), // Fetches all attendance records for all employees
}

// Salary-related helpers
export const salaryAPI = {
  getAllSalaries: () => api.get("/salaries"),
  getEmployeeSalaries: (employee_id) => api.get(`/salaries/${employee_id}`),
  createSalary: (data) => api.post("/salaries", data),
  updateSalaryStatus: (id, status) => api.put(`/salaries/${id}`, { status }),
}

// Add leave API utilities
export const leavesAPI = {
  getAllLeaves: () => api.get("/leaves"),
  getEmployeeLeaves: (employeeId) => api.get(`/leaves/${employeeId}`),
  createLeave: (data) => api.post("/leaves", data),
  updateLeaveStatus: (id, status) => api.put(`/leaves/${id}`, { status }),
}

// Task-related helpers
export const tasksAPI = {
  getAllTasks: () => api.get("/tasks"),
  getEmployeeTasks: (employeeId) => api.get(`/tasks/${employeeId}`),
  createTask: (data) => api.post("/tasks", data),
  updateTaskStatus: (id, status) => api.put(`/tasks/${id}/status`, { status }),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
  startTaskTimer: (taskId) => api.post(`/tasks/${taskId}/timer/start`),
  stopTaskTimer: (taskId) => api.post(`/tasks/${taskId}/timer/stop`),
  getTaskTimerHistory: (taskId) => api.get(`/tasks/${taskId}/timer/history`),
}

// Get today's attendance status for an employee or all employees for managers
export const getTodayStatus = async (employeeId) => {
  try {
    const res = await api.get(`/attendance/today/${employeeId}`)
    return res.data
  } catch (error) {
    console.error("Error fetching today's status:", error)
    throw error // Ensure that error is thrown to be handled at the caller level
  }
}

// Handling manager-specific logic for fetching attendance data
export const getAttendanceForRole = async (employeeId, role) => {
  try {
    if (role === "manager" || role === "admin") {
      const res = await api.get(`/attendance/`)
      return res.data // Returns all employees' attendance data
    } else {
      return await getTodayStatus(employeeId) // Returns only the specific employee's attendance data
    }
  } catch (error) {
    console.error("Error fetching attendance based on role:", error)
    throw error
  }
}

export default api

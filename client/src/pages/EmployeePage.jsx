"use client"

import { useState, useEffect } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import LeaveForm from "../components/LeaveForm"
import NotificationPanel from "../components/NotificationPanel"
import SalaryTable from "../components/SalaryTable"
import AttendanceTable from "../components/AttendanceTable"
import Clock from "../components/Clock"
import { useAuth } from "../context/AuthContext"
import TaskList from "../components/TaskList"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import { BarChart3, ClockIcon, Calendar, DollarSign, CheckSquare, Bell } from "lucide-react"
import "./EmployeePageS.css"

export default function EmployeePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeComponent, setActiveComponent] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attendanceStatus, setAttendanceStatus] = useState("Not marked")
  const [activeTasks, setActiveTasks] = useState("...")

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true)
        // Simulate fetching dashboard data
        setTimeout(() => {
          setAttendanceStatus("check-in")
          setActiveTasks("3")
        }, 1500)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching initial data:", err)
        setError("Failed to load dashboard data")
        setLoading(false)
      }
    }

    if (user?.id) {
      fetchInitialData()
    }
  }, [user?.id])

  // Logout handler
  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (err) {
      console.error("Logout failed:", err)
      alert("Logout failed. Please try again.")
    }
  }

  // Render main page content
  const renderComponent = () => {
    switch (activeComponent) {
      case "dashboard":
        return (
          <div className="dashboard-container">
            <h2>Employee Dashboard</h2>

            <div className="dashboard-summary">
              <div className="summary-card">
                <h3>Welcome, {user.username}!</h3>
                <p className="user-role">Role: Employee</p>
                <div className="user-status">
                  <div className="status-indicator online"></div>
                  <span>Online</span>
                </div>
              </div>

              <div className="summary-card">
                <h3>Your Attendance</h3>
                <div className="attendance-status-mini">
                  <div className="status-display">
                    <p>
                      Status: <span className={`status-badge ${attendanceStatus}`}>{attendanceStatus}</span>
                    </p>
                  </div>
                  <button className="mark-attendance-btn" onClick={() => setActiveComponent("attendance")}>
                    <ClockIcon size={16} />
                    Mark Attendance
                  </button>
                </div>
              </div>

              <div className="summary-card">
                <h3>Your Tasks</h3>
                <div className="tasks-mini">
                  <div className="task-count-display">
                    <div className="task-count-item">
                      <span className="count-label">Active Tasks</span>
                      <span className="count-value">{activeTasks}</span>
                    </div>
                  </div>
                  <button className="view-tasks-btn" onClick={() => setActiveComponent("tasks")}>
                    <CheckSquare size={16} />
                    View All Tasks
                  </button>
                </div>
              </div>

              <div className="summary-card">
                <h3>Quick Links</h3>
                <div className="quick-links">
                  <button onClick={() => setActiveComponent("attendance")} className="quick-link-btn">
                    <ClockIcon className="btn-icon" />
                    Mark Attendance
                  </button>
                  <button onClick={() => setActiveComponent("leaves")} className="quick-link-btn">
                    <Calendar className="btn-icon" />
                    Apply for Leave
                  </button>
                  <button onClick={() => setActiveComponent("salaries")} className="quick-link-btn">
                    <DollarSign className="btn-icon" />
                    View Salary
                  </button>
                  <button onClick={() => setActiveComponent("tasks")} className="quick-link-btn">
                    <CheckSquare className="btn-icon" />
                    My Tasks
                  </button>
                  <button onClick={() => setActiveComponent("performance")} className="quick-link-btn">
                    <BarChart3 className="btn-icon" />
                    View Performance
                  </button>
                  <button onClick={() => setActiveComponent("notifications")} className="quick-link-btn">
                    <Bell className="btn-icon" />
                    Notifications
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      case "attendance":
        return <AttendanceTable allowMarking={true} />
      case "leaves":
        return <LeaveForm />
      case "salaries":
        return <SalaryTable />
      case "notifications":
        return <NotificationPanel />
      case "performance":
        return <PerformanceEvaluation />
      case "tasks":
        return <TaskList />
      default:
        return <div className="error-message">Please select a feature from the sidebar.</div>
    }
  }

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    )
  }

  if (user.role !== "employee") {
    return <Navigate to="/" replace />
  }

  return (
    <div className="employee-page">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="employee" />

      <div className="main-content">
        <header className="page-header">
          <div className="user-info">
            <span className="user-name">Employee: {user.username}</span>
            <Clock />
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </header>

        <main className="page-content">
          {loading ? (
            <div className="loading-screen">
              <div className="loading-spinner"></div>
              <p>Loading dashboard...</p>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            renderComponent()
          )}
        </main>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import EmployeeList from "../components/EmployeeList"
import NotificationPanel from "../components/NotificationPanel"
import AttendanceTable from "../components/AttendanceTable"
import SalaryTable from "../components/SalaryTable"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import LeaveRequestsManager from "../components/LeaveRequestsManager"
import Clock from "../components/Clock"
import { useAuth } from "../context/AuthContext"
import TaskList from "../components/TaskList"
import { BarChart3, ClockIcon, Users, Calendar, DollarSign, CheckSquare, Bell } from "lucide-react"
import "./AdminPageS.css"

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeComponent, setActiveComponent] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState({
    employees: "...",
    departments: "...",
    pendingLeaves: "...",
    todayAttendance: "...",
  })

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true)
        // Simulate fetching dashboard stats
        setTimeout(() => {
          setStats({
            employees: "42",
            departments: "5",
            pendingLeaves: "7",
            todayAttendance: "38",
          })
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
            <h2>Admin Dashboard</h2>

            <div className="dashboard-summary">
              <div className="summary-card">
                <h3>Welcome, {user.username}!</h3>
                <p className="user-role">Role: Administrator</p>
                <div className="user-status">
                  <div className="status-indicator online"></div>
                  <span>Online</span>
                </div>
              </div>

              <div className="summary-card">
                <h3>System Overview</h3>
                <div className="stat-grid">
                  <div className="stat-item">
                    <Users className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Employees</span>
                      <span className="stat-value">{stats.employees}</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <BarChart3 className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Departments</span>
                      <span className="stat-value">{stats.departments}</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <Calendar className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Pending Leaves</span>
                      <span className="stat-value">{stats.pendingLeaves}</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <ClockIcon className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Today's Attendance</span>
                      <span className="stat-value">{stats.todayAttendance}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="summary-card">
                <h3>Quick Links</h3>
                <div className="quick-links">
                  <button onClick={() => setActiveComponent("manageUsers")} className="quick-link-btn">
                    <Users className="btn-icon" />
                    Manage Users
                  </button>
                  <button onClick={() => setActiveComponent("attendance")} className="quick-link-btn">
                    <ClockIcon className="btn-icon" />
                    View Attendance
                  </button>
                  <button onClick={() => setActiveComponent("leaves")} className="quick-link-btn">
                    <Calendar className="btn-icon" />
                    Manage Leave Requests
                  </button>
                  <button onClick={() => setActiveComponent("salaryTable")} className="quick-link-btn">
                    <DollarSign className="btn-icon" />
                    View Salaries
                  </button>
                  <button onClick={() => setActiveComponent("tasks")} className="quick-link-btn">
                    <CheckSquare className="btn-icon" />
                    Manage Tasks
                  </button>
                  <button onClick={() => setActiveComponent("notifications")} className="quick-link-btn">
                    <Bell className="btn-icon" />
                    Notifications
                  </button>
                </div>
              </div>

              <div className="summary-card">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <div className="activity-icon check-in"></div>
                    <div className="activity-content">
                      <p>John Employee checked in</p>
                      <span className="activity-time">Today, 9:05 AM</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <div className="activity-icon leave"></div>
                    <div className="activity-content">
                      <p>Sarah Connor requested leave</p>
                      <span className="activity-time">Today, 8:30 AM</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <div className="activity-icon task"></div>
                    <div className="activity-content">
                      <p>New task assigned to Development team</p>
                      <span className="activity-time">Yesterday, 4:45 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case "manageUsers":
        return <EmployeeList />
      case "attendance":
        return <AttendanceTable allowMarking={false} />
      case "leaves":
        return <LeaveRequestsManager />
      case "salaryTable":
        return <SalaryTable />
      case "performance":
        return <PerformanceEvaluation />
      case "notifications":
        return <NotificationPanel />
      case "tasks":
        return <TaskList />
      case "manageRoles":
        return (
          <div className="admin-section">
            <h2>Manage User Roles</h2>
            <p>This section will allow you to manage user roles and permissions.</p>
          </div>
        )
      default:
        return <div className="error-message">Select a feature from the sidebar.</div>
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

  if (user.role !== "admin") {
    return <Navigate to="/" replace />
  }

  return (
    <div className="admin-page">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="admin" />

      <div className="main-content">
        <header className="page-header">
          <div className="user-info">
            <span className="user-name">Admin: {user.username}</span>
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

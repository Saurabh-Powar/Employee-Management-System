"use client"

import { useState, useEffect } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import EmployeeList from "../components/EmployeeList"
import LeaveRequestsManager from "../components/LeaveRequestsManager"
import NotificationPanel from "../components/NotificationPanel"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import SalaryTable from "../components/SalaryTable"
import AttendanceTable from "../components/AttendanceTable"
import Clock from "../components/Clock"
import { useAuth } from "../context/AuthContext"
import TaskList from "../components/TaskList"
import { ClockIcon, Users, Calendar, DollarSign, CheckSquare } from "lucide-react"
import "./ManagerPageS.css"

function ManagerPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeComponent, setActiveComponent] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState({
    teamMembers: "...",
    presentToday: "...",
    pendingLeaves: "...",
    activeTasks: "...",
  })
  const [attendanceStatus, setAttendanceStatus] = useState("Not marked")

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true)
        // Simulate fetching dashboard stats
        setTimeout(() => {
          setStats({
            teamMembers: "8",
            presentToday: "7",
            pendingLeaves: "3",
            activeTasks: "12",
          })

          // Simulate fetching attendance status
          setAttendanceStatus("check-in")
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
            <h2>Manager Dashboard</h2>

            <div className="dashboard-summary">
              <div className="summary-card">
                <h3>Welcome, {user.username}!</h3>
                <p className="user-role">Role: Manager</p>
                <div className="user-status">
                  <div className="status-indicator online"></div>
                  <span>Online</span>
                </div>
              </div>

              <div className="summary-card">
                <h3>Team Overview</h3>
                <div className="stat-grid">
                  <div className="stat-item">
                    <Users className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Team Members</span>
                      <span className="stat-value">{stats.teamMembers}</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <ClockIcon className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Present Today</span>
                      <span className="stat-value">{stats.presentToday}</span>
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
                    <CheckSquare className="stat-icon" />
                    <div className="stat-content">
                      <span className="stat-label">Active Tasks</span>
                      <span className="stat-value">{stats.activeTasks}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="summary-card">
                <h3>Quick Links</h3>
                <div className="quick-links">
                  <button onClick={() => setActiveComponent("employeeList")} className="quick-link-btn">
                    <Users className="btn-icon" />
                    Manage Employees
                  </button>
                  <button onClick={() => setActiveComponent("attendance")} className="quick-link-btn">
                    <ClockIcon className="btn-icon" />
                    View Attendance
                  </button>
                  <button onClick={() => setActiveComponent("leaves")} className="quick-link-btn">
                    <Calendar className="btn-icon" />
                    Manage Leave Requests
                  </button>
                  <button onClick={() => setActiveComponent("salaries")} className="quick-link-btn">
                    <DollarSign className="btn-icon" />
                    Process Salaries
                  </button>
                  <button onClick={() => setActiveComponent("tasks")} className="quick-link-btn">
                    <CheckSquare className="btn-icon" />
                    Manage Tasks
                  </button>
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
            </div>
          </div>
        )
      case "employeeList":
        return <EmployeeList />
      case "attendance":
        return <AttendanceTable allowMarking={true} />
      case "leaves":
        return <LeaveRequestsManager />
      case "performance":
        return <PerformanceEvaluation />
      case "salaries":
        return <SalaryTable />
      case "notifications":
        return <NotificationPanel />
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

  if (user.role !== "manager") {
    return <Navigate to="/" replace />
  }

  return (
    <div className="manager-page">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="manager" />

      <div className="main-content">
        <header className="page-header">
          <div className="user-info">
            <span className="user-name">Manager: {user.username}</span>
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

export default ManagerPage

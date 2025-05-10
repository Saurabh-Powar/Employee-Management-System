"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import Sidebar from "../components/Sidebar"
import EmployeeList from "../components/EmployeeList"
import AttendanceTable from "../components/AttendanceTable"
import LeaveRequestsManager from "../components/LeaveRequestsManager"
import SalaryCalculator from "../components/SalaryCalculator"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import TaskList from "../components/TaskList"
import NotificationPanel from "../components/NotificationPanel"
import ShiftManagement from "../components/ShiftManagement"
import Clock from "../components/Clock"
import "./ManagerPageS.css"

function ManagerPage() {
  const { user, logout } = useAuth()
  const [activeComponent, setActiveComponent] = useState("dashboard")

  useEffect(() => {
    // Redirect if not manager
    if (user && user.role !== "manager") {
      window.location.href = "/"
    }
  }, [user])

  useEffect(() => {
    // Initialize WebSocket connection when user is loaded
    if (user && user.id) {
      import("../services/websocket").then((module) => {
        const websocketService = module.default
        websocketService.connect(user.id, user.role)
      })
    }

    // Clean up WebSocket connection on unmount
    return () => {
      import("../services/websocket").then((module) => {
        const websocketService = module.default
        websocketService.disconnect()
      })
    }
  }, [user])

  if (!user) {
    return <div className="loading">Loading...</div>
  }

  const renderComponent = () => {
    switch (activeComponent) {
      case "dashboard":
        return (
          <div className="dashboard-container">
            <h1>Manager Dashboard</h1>
            <Clock />
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Team Members</h3>
                <p className="stat-value">8</p>
              </div>
              <div className="stat-card">
                <h3>Present Today</h3>
                <p className="stat-value">6</p>
              </div>
              <div className="stat-card">
                <h3>On Leave</h3>
                <p className="stat-value">1</p>
              </div>
              <div className="stat-card" onClick={() => setActiveComponent("tasks")}>
                <h3>Task Approvals</h3>
                <div className="approval-stats">
                  <span className="approval-stat">
                    <span className="stat-label">Pending:</span>
                    <span className="stat-value approval-pending">3</span>
                  </span>
                  <span className="approval-stat">
                    <span className="stat-label">Completed:</span>
                    <span className="stat-value approval-completed">12</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      case "employeeList":
        return <EmployeeList />
      case "attendance":
        return <AttendanceTable allowMarking={true} />
      case "shifts":
        return <ShiftManagement />
      case "leaves":
        return <LeaveRequestsManager />
      case "salaries":
        return <SalaryCalculator />
      case "performance":
        return <PerformanceEvaluation />
      case "tasks":
        return <TaskList />
      case "notifications":
        return <NotificationPanel />
      default:
        return <div>Select a component from the sidebar</div>
    }
  }

  return (
    <div className="manager-container">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="manager" />
      <div className="manager-content">
        <header className="manager-header">
          <div className="user-info">
            <span className="welcome-text">Welcome, {user.username}</span>
            <span className="role-badge manager">Manager</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </header>
        <main className="manager-main">{renderComponent()}</main>
      </div>
    </div>
  )
}

export default ManagerPage

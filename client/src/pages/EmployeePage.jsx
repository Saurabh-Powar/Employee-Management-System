"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import Sidebar from "../components/Sidebar"
import AttendanceTable from "../components/AttendanceTable"
import LeaveForm from "../components/LeaveForm"
import SalaryCalculator from "../components/SalaryCalculator"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import TaskList from "../components/TaskList"
import NotificationPanel from "../components/NotificationPanel"
import EmployeeShiftView from "../components/EmployeeShiftView"
import Clock from "../components/Clock"
import "./EmployeePageS.css"

function EmployeePage() {
  const { user, logout } = useAuth()
  const [activeComponent, setActiveComponent] = useState("dashboard")

  useEffect(() => {
    // Redirect if not employee
    if (user && user.role !== "employee") {
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
            <h1>Employee Dashboard</h1>
            <Clock />
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Days Present</h3>
                <p className="stat-value">18</p>
              </div>
              <div className="stat-card">
                <h3>Leave Balance</h3>
                <p className="stat-value">12</p>
              </div>
              <div className="stat-card" onClick={() => setActiveComponent("tasks")}>
                <h3>Tasks</h3>
                <div className="task-stats">
                  <span className="task-stat">
                    <span className="stat-label">Assigned:</span>
                    <span className="stat-value task-assigned">2</span>
                  </span>
                  <span className="task-stat">
                    <span className="stat-label">In Progress:</span>
                    <span className="stat-value task-in-progress">2</span>
                  </span>
                  <span className="task-stat">
                    <span className="stat-label">Pending:</span>
                    <span className="stat-value task-pending">1</span>
                  </span>
                </div>
              </div>
              <div className="stat-card">
                <h3>Notifications</h3>
                <p className="stat-value">3</p>
              </div>
            </div>
          </div>
        )
      case "attendance":
        return <AttendanceTable allowMarking={true} />
      case "shifts":
        return <EmployeeShiftView />
      case "leaves":
        return <LeaveForm />
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
    <div className="employee-container">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="employee" />
      <div className="employee-content">
        <header className="employee-header">
          <div className="user-info">
            <span className="welcome-text">Welcome, {user.username}</span>
            <span className="role-badge employee">Employee</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </header>
        <main className="employee-main">{renderComponent()}</main>
      </div>
    </div>
  )
}

export default EmployeePage

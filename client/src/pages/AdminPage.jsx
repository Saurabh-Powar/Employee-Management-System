"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import Sidebar from "../components/Sidebar"
import EmployeeList from "../components/EmployeeList"
import AttendanceTable from "../components/AttendanceTable"
import LeaveRequestsManager from "../components/LeaveRequestsManager"
import SalaryTable from "../components/SalaryTable"
import PerformanceEvaluation from "../components/PerformanceEvaluation"
import TaskList from "../components/TaskList"
import NotificationPanel from "../components/NotificationPanel"
import ShiftManagement from "../components/ShiftManagement"
import Clock from "../components/Clock"
import "./AdminPageS.css"

function AdminPage() {
  const { user, logout } = useAuth()
  const [activeComponent, setActiveComponent] = useState("dashboard")

  useEffect(() => {
    // Redirect if not admin
    if (user && user.role !== "admin") {
      window.location.href = "/"
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
            <h1>Admin Dashboard</h1>
            <Clock />
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Total Employees</h3>
                <p className="stat-value">25</p>
              </div>
              <div className="stat-card">
                <h3>Present Today</h3>
                <p className="stat-value">18</p>
              </div>
              <div className="stat-card">
                <h3>On Leave</h3>
                <p className="stat-value">3</p>
              </div>
              <div className="stat-card">
                <h3>Pending Approvals</h3>
                <p className="stat-value">7</p>
              </div>
            </div>
          </div>
        )
      case "manageUsers":
        return <EmployeeList />
      case "attendance":
        return <AttendanceTable />
      case "shifts":
        return <ShiftManagement />
      case "leaves":
        return <LeaveRequestsManager />
      case "salaryTable":
        return <SalaryTable />
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
    <div className="admin-container">
      <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} userRole="admin" />
      <div className="admin-content">
        <header className="admin-header">
          <div className="user-info">
            <span className="welcome-text">Welcome, {user.username}</span>
            <span className="role-badge admin">Admin</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </header>
        <main className="admin-main">{renderComponent()}</main>
      </div>
    </div>
  )
}

export default AdminPage

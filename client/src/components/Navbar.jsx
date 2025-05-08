"use client"

import { useState, useContext } from "react"
import { AuthContext } from "../context/AuthContext"
import { Link, useNavigate } from "react-router-dom"
import "./NavbarS.css"

const Navbar = () => {
  const { user, logout } = useContext(AuthContext)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (err) {
      console.error("Logout failed:", err)
      alert("Logout failed. Please try again.")
    }
  }

  const renderNavLinks = () => {
    switch (user?.role) {
      case "admin":
        return (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/admin/employees">Employees</Link>
            <Link to="/admin/attendance">Attendance</Link>
            <Link to="/admin/salaries">Salaries</Link>
            <Link to="/admin/performance">Performance</Link>
          </>
        )
      case "manager":
        return (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/manager/employees">Employees</Link>
            <Link to="/manager/attendance">Attendance</Link>
            <Link to="/manager/salaries">Salaries</Link>
            <Link to="/manager/performance">Performance</Link>
          </>
        )
      case "employee":
        return (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/employee/attendance">My Attendance</Link>
            <Link to="/employee/salaries">My Salaries</Link>
            <Link to="/employee/performance">My Performance</Link>
          </>
        )
      default:
        return null
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <button className="menu-toggle" onClick={toggleMenu} aria-label="Toggle navigation menu">
          {menuOpen ? "✕" : "☰"}
        </button>

        <div className={`menu-links ${menuOpen ? "active" : ""}`}>
          {renderNavLinks()}
          {user && (
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

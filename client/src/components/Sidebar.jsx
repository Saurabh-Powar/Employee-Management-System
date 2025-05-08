"use client"

import { useState, useEffect } from "react"
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  Home,
  Menu,
  User,
  Users,
  X,
  DollarSign,
  Bell,
  CalendarIcon,
} from "lucide-react"
import "./SidebarS.css"

export default function Sidebar({ activeComponent, setActiveComponent, userRole }) {
  const [isOpen, setIsOpen] = useState(true)
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 0)

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (window.innerWidth < 768) {
        setIsOpen(false)
      } else {
        setIsOpen(true)
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize() // Initialize on mount

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const toggleSidebar = () => setIsOpen(!isOpen)

  // Update the getMenuItems function to include shifts
  const getMenuItems = () => {
    // Base items for all roles
    const baseItems = [
      {
        name: "Dashboard",
        icon: <Home size={20} />,
        value: "dashboard",
      },
    ]

    // Admin-specific items
    if (userRole === "admin") {
      return [
        ...baseItems,
        {
          name: "Users",
          icon: <User size={20} />,
          value: "manageUsers",
        },
        {
          name: "Attendance",
          icon: <Clock size={20} />,
          value: "attendance",
        },
        {
          name: "Shifts",
          icon: <CalendarIcon size={20} />,
          value: "shifts",
        },
        {
          name: "Leave Requests",
          icon: <Calendar size={20} />,
          value: "leaves",
        },
        {
          name: "Salaries",
          icon: <DollarSign size={20} />,
          value: "salaryTable",
        },
        {
          name: "Performance",
          icon: <BarChart3 size={20} />,
          value: "performance",
        },
        {
          name: "Tasks",
          icon: <CheckSquare size={20} />,
          value: "tasks",
        },
        {
          name: "Notifications",
          icon: <Bell size={20} />,
          value: "notifications",
        },
      ]
    }

    // Manager-specific items
    if (userRole === "manager") {
      return [
        ...baseItems,
        {
          name: "Employees",
          icon: <Users size={20} />,
          value: "employeeList",
        },
        {
          name: "Attendance",
          icon: <Clock size={20} />,
          value: "attendance",
        },
        {
          name: "Shifts",
          icon: <CalendarIcon size={20} />,
          value: "shifts",
        },
        {
          name: "Leave Requests",
          icon: <Calendar size={20} />,
          value: "leaves",
        },
        {
          name: "Salaries",
          icon: <DollarSign size={20} />,
          value: "salaries",
        },
        {
          name: "Performance",
          icon: <BarChart3 size={20} />,
          value: "performance",
        },
        {
          name: "Tasks",
          icon: <CheckSquare size={20} />,
          value: "tasks",
        },
        {
          name: "Notifications",
          icon: <Bell size={20} />,
          value: "notifications",
        },
      ]
    }

    // Employee-specific items
    return [
      ...baseItems,
      {
        name: "My Attendance",
        icon: <Clock size={20} />,
        value: "attendance",
      },
      {
        name: "My Schedule",
        icon: <CalendarIcon size={20} />,
        value: "shifts",
      },
      {
        name: "Apply Leave",
        icon: <Calendar size={20} />,
        value: "leaves",
      },
      {
        name: "My Salary",
        icon: <DollarSign size={20} />,
        value: "salaries",
      },
      {
        name: "My Performance",
        icon: <BarChart3 size={20} />,
        value: "performance",
      },
      {
        name: "My Tasks",
        icon: <CheckSquare size={20} />,
        value: "tasks",
      },
      {
        name: "Notifications",
        icon: <Bell size={20} />,
        value: "notifications",
      },
    ]
  }

  const menuItems = getMenuItems()

  return (
    <>
      <div className={`sidebar-overlay ${isOpen && windowWidth < 768 ? "active" : ""}`} onClick={toggleSidebar}></div>
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">{isOpen ? "EMS Portal" : "EMS"}</h2>
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="sidebar-content">
          <ul className="menu-items">
            {menuItems.map((item) => (
              <li
                key={item.value}
                className={activeComponent === item.value ? "active" : ""}
                onClick={() => {
                  setActiveComponent(item.value)
                  if (windowWidth < 768) {
                    setIsOpen(false)
                  }
                }}
              >
                <span className="menu-icon">{item.icon}</span>
                {isOpen && <span className="menu-text">{item.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

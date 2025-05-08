"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import "./EmployeeFormS.css"

function EmployeeForm({ employee, onClose, onSubmit }) {
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    user_id: employee?.user_id || "",
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    address: employee?.address || "",
    position: employee?.position || "",
    department: employee?.department || "",
    joining_date: employee?.joining_date?.slice(0, 10) || "",
    base_salary: employee?.base_salary ?? "",
    role: employee?.role || "employee",
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    setErrors({})
  }, [formData])

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: name === "base_salary" ? (value === "" ? "" : Number(value)) : value,
    }))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.first_name.trim()) newErrors.first_name = "First Name is required."
    if (!formData.last_name.trim()) newErrors.last_name = "Last Name is required."
    if (!formData.email.trim()) newErrors.email = "Email is required."
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format."
    if (formData.base_salary !== "" && (isNaN(formData.base_salary) || formData.base_salary < 0)) {
      newErrors.base_salary = "Base salary must be a non-negative number."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  return (
    <div className="employee-form-overlay" onClick={onClose}>
      <div className="employee-form" onClick={(e) => e.stopPropagation()}>
        <h2>{employee ? "Edit Employee" : "Add Employee"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* First Name */}
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="John"
              />
              {errors.first_name && <p className="error">{errors.first_name}</p>}
            </div>

            {/* Last Name */}
            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Doe"
              />
              {errors.last_name && <p className="error">{errors.last_name}</p>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@example.com"
              />
              {errors.email && <p className="error">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 234 567 890"
              />
            </div>

            {/* Position */}
            <div className="form-group">
              <label htmlFor="position">Position</label>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="Software Engineer"
              />
            </div>

            {/* Department */}
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="IT"
              />
            </div>

            {/* Joining Date */}
            <div className="form-group">
              <label htmlFor="joining_date">Joining Date</label>
              <input
                type="date"
                id="joining_date"
                name="joining_date"
                value={formData.joining_date}
                onChange={handleChange}
              />
            </div>

            {/* Base Salary */}
            <div className="form-group">
              <label htmlFor="base_salary">Base Salary</label>
              <input
                type="number"
                id="base_salary"
                name="base_salary"
                value={formData.base_salary}
                onChange={handleChange}
                min="0"
                placeholder="50000"
              />
              {errors.base_salary && <p className="error">{errors.base_salary}</p>}
            </div>

            {/* Role (Admin only) */}
            {user?.role === "admin" && (
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" value={formData.role} onChange={handleChange}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            )}
          </div>

          {/* Address - Full width */}
          <div className="form-group full-width">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main Street"
            />
          </div>

          {/* Buttons */}
          <div className="form-actions">
            <button type="submit" className="save-btn">
              Save
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmployeeForm

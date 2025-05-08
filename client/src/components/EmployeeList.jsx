"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import EmployeeForm from "./EmployeeForm"
import { useAuth } from "../context/AuthContext"
import "./EmployeeLists.css"

function EmployeeList() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await axios.get("http://localhost:5000/api/employees", { withCredentials: true })
      setEmployees(res.data)
      setError("")
    } catch (err) {
      console.error(err)
      setError("Failed to fetch employees. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return
    try {
      await axios.delete(`http://localhost:5000/api/employees/${id}`, { withCredentials: true })
      setEmployees((prev) => prev.filter((emp) => emp.id !== id))
      setSuccessMessage("Employee deleted successfully.")
    } catch (err) {
      console.error(err)
      setError("Failed to delete employee. Please try again later.")
    }
  }

  const handleEdit = (employee) => {
    setEditEmployee(employee)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditEmployee(null)
    setSuccessMessage("")
  }

  const handleFormSubmit = async (employeeData) => {
    try {
      if (editEmployee) {
        await axios.put(`http://localhost:5000/api/employees/${editEmployee.id}`, employeeData, {
          withCredentials: true,
        })
        setSuccessMessage("Employee details updated successfully.")
      } else {
        await axios.post("http://localhost:5000/api/employees", employeeData, { withCredentials: true })
        setSuccessMessage("Employee added successfully.")
      }
      handleFormClose()
      fetchEmployees()
    } catch (err) {
      console.error(err)
      setError("Failed to save employee. Please check your input and try again.")
    }
  }

  if (loading) return <div className="loading">Loading employees...</div>

  return (
    <div className="employee-list">
      <div className="header">
        <h2>Employee List</h2>
        {(user?.role === "admin" || user?.role === "manager") && (
          <button
            onClick={() => {
              setEditEmployee(null)
              setShowForm(true)
            }}
          >
            Add Employee
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {successMessage && <div className="success">{successMessage}</div>}

      {showForm && <EmployeeForm employee={editEmployee} onClose={handleFormClose} onSubmit={handleFormSubmit} />}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Position</th>
            <th>Department</th>
            <th>Joining Date</th>
            <th>Base Salary</th>
            {(user?.role === "admin" || user?.role === "manager") && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan="8" className="no-data">
                No employees found
              </td>
            </tr>
          ) : (
            employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.id}</td>
                <td>
                  {employee.first_name} {employee.last_name}
                </td>
                <td>{employee.email}</td>
                <td>{employee.position}</td>
                <td>{employee.department}</td>
                <td>{new Date(employee.joining_date).toLocaleDateString()}</td>
                <td>{employee.base_salary}</td>
                {(user?.role === "admin" || user?.role === "manager") && (
                  <td>
                    <button className="edit-btn" onClick={() => handleEdit(employee)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(employee.id)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default EmployeeList

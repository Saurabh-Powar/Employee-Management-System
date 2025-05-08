"use client"

import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./SalaryTableS.css"

export default function SalaryTable() {
  const { user } = useAuth()
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const fetchSalaries = async () => {
    setLoading(true)
    setError("")
    try {
      // Managers see all; employees see just theirs
      const endpoint = user.role === "manager" || user.role === "admin" ? "/salaries" : `/salaries/${user.id}`

      const res = await api.get(endpoint)

      if (res.status === 200) {
        const data = res.data
        if (data.length === 0) {
          setError("No salary records available.")
        }
        setSalaries(data)
        setSuccessMessage("Salary data loaded successfully")

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("")
        }, 3000)
      } else {
        throw new Error("Unexpected server response")
      }
    } catch (err) {
      console.error("Error fetching salaries:", err)
      setError(err.response?.data?.message || "Failed to fetch salary data. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchSalaries()

    // Set up auto-refresh every 5 minutes
    const intervalId = setInterval(() => {
      fetchSalaries()
    }, 300000)

    return () => clearInterval(intervalId)
  }, [user])

  const handleRefresh = () => {
    fetchSalaries()
  }

  // Add a function to calculate real-time overtime based on current attendance
  const calculateCurrentOvertime = (workHours) => {
    // Assuming standard 8-hour work day
    const standardHours = 8
    const overtime = Math.max(0, workHours - standardHours)
    return overtime.toFixed(2)
  }

  if (!user) return <p className="loading-message">Loading user data...</p>
  if (loading) return <p className="loading-message">Loading salary data...</p>

  return (
    <div className="salary-table-container">
      <h2 className="salary-title">Salary Dashboard</h2>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="salary-actions">
        <button className="refresh-btn" onClick={handleRefresh}>
          Refresh Salary Data
        </button>
      </div>

      {user.role === "admin" && (
        <div className="salary-section">
          <h3>All Employee Salary Records</h3>
          <table className="salary-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Month</th>
                <th>Year</th>
                <th>Work Days</th>
                <th>Total Hours</th>
                <th>Base Amount</th>
                <th>Overtime</th>
                <th>Deductions</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="no-data">
                    No salary records available.
                  </td>
                </tr>
              ) : (
                salaries.map((s, i) => (
                  <tr key={i}>
                    <td>{s.employee_id}</td>
                    <td>{s.employee_name || "N/A"}</td>
                    <td>{s.department || "N/A"}</td>
                    <td>{s.month}</td>
                    <td>{s.year}</td>
                    <td>{s.work_days || 0}</td>
                    <td>{Number.parseFloat(s.total_hours || 0).toFixed(2)}</td>
                    <td>${Number.parseFloat(s.base_amount).toFixed(2)}</td>
                    <td>
                      ${Number.parseFloat(s.overtime_amount).toFixed(2)}
                      {s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1 && (
                        <span className="live-calculation">
                          (Live: ${calculateCurrentOvertime(s.total_hours || 0)})
                        </span>
                      )}
                    </td>
                    <td>${Number.parseFloat(s.deductions).toFixed(2)}</td>
                    <td className="total-amount">${Number.parseFloat(s.total_amount).toFixed(2)}</td>
                    <td className={`status-${s.status}`}>{s.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {user.role === "manager" && (
        <>
          <div className="salary-section">
            <h3>Your Salary Records</h3>
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Work Days</th>
                  <th>Total Hours</th>
                  <th>Base Amount</th>
                  <th>Overtime</th>
                  <th>Deductions</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salaries.filter((s) => s.employee_id === user.id).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="no-data">
                      No salary records available.
                    </td>
                  </tr>
                ) : (
                  salaries
                    .filter((s) => s.employee_id === user.id)
                    .map((s, i) => (
                      <tr key={i}>
                        <td>{s.month}</td>
                        <td>{s.year}</td>
                        <td>{s.work_days || 0}</td>
                        <td>{Number.parseFloat(s.total_hours || 0).toFixed(2)}</td>
                        <td>${Number.parseFloat(s.base_amount).toFixed(2)}</td>
                        <td>
                          ${Number.parseFloat(s.overtime_amount).toFixed(2)}
                          {s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1 && (
                            <span className="live-calculation">
                              (Live: ${calculateCurrentOvertime(s.total_hours || 0)})
                            </span>
                          )}
                        </td>
                        <td>${Number.parseFloat(s.deductions).toFixed(2)}</td>
                        <td className="total-amount">${Number.parseFloat(s.total_amount).toFixed(2)}</td>
                        <td className={`status-${s.status}`}>{s.status}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          <div className="salary-section">
            <h3>Team Salary Records</h3>
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Work Days</th>
                  <th>Total Hours</th>
                  <th>Base Amount</th>
                  <th>Overtime</th>
                  <th>Deductions</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salaries.filter((s) => s.employee_id !== user.id).length === 0 ? (
                  <tr>
                    <td colSpan={12} className="no-data">
                      No team salary records available.
                    </td>
                  </tr>
                ) : (
                  salaries
                    .filter((s) => s.employee_id !== user.id)
                    .map((s, i) => (
                      <tr key={i}>
                        <td>{s.employee_id}</td>
                        <td>{s.employee_name || "N/A"}</td>
                        <td>{s.department || "N/A"}</td>
                        <td>{s.month}</td>
                        <td>{s.year}</td>
                        <td>{s.work_days || 0}</td>
                        <td>{Number.parseFloat(s.total_hours || 0).toFixed(2)}</td>
                        <td>${Number.parseFloat(s.base_amount).toFixed(2)}</td>
                        <td>
                          ${Number.parseFloat(s.overtime_amount).toFixed(2)}
                          {s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1 && (
                            <span className="live-calculation">
                              (Live: ${calculateCurrentOvertime(s.total_hours || 0)})
                            </span>
                          )}
                        </td>
                        <td>${Number.parseFloat(s.deductions).toFixed(2)}</td>
                        <td className="total-amount">${Number.parseFloat(s.total_amount).toFixed(2)}</td>
                        <td className={`status-${s.status}`}>{s.status}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.role === "employee" && (
        <div className="salary-section">
          <h3>Your Salary Records</h3>
          <table className="salary-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Year</th>
                <th>Work Days</th>
                <th>Total Hours</th>
                <th>Base Amount</th>
                <th>Overtime</th>
                <th>Deductions</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="no-data">
                    No salary records available.
                  </td>
                </tr>
              ) : (
                salaries.map((s, i) => (
                  <tr key={i}>
                    <td>{s.month}</td>
                    <td>{s.year}</td>
                    <td>{s.work_days || 0}</td>
                    <td>{Number.parseFloat(s.total_hours || 0).toFixed(2)}</td>
                    <td>${Number.parseFloat(s.base_amount).toFixed(2)}</td>
                    <td>
                      ${Number.parseFloat(s.overtime_amount).toFixed(2)}
                      {s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1 && (
                        <span className="live-calculation">
                          (Live: ${calculateCurrentOvertime(s.total_hours || 0)})
                        </span>
                      )}
                    </td>
                    <td>${Number.parseFloat(s.deductions).toFixed(2)}</td>
                    <td className="total-amount">${Number.parseFloat(s.total_amount).toFixed(2)}</td>
                    <td className={`status-${s.status}`}>{s.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

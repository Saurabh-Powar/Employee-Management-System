"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./SalaryCalculators.css"

export default function SalaryCalculator() {
  const { user } = useAuth()
  const [salaryData, setSalaryData] = useState([])
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Redirect or guard
  if (!user) return <p>Loading user…</p>
  if (user.role !== "employee" && user.role !== "manager") {
    return <p>You do not have access to salary details.</p>
  }

  // Fetch salaries when month/year or user.id changes
  useEffect(() => {
    const fetchSalaries = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await api.get(`/salaries/${user.id}`)
        // Expect 200
        if (res.status !== 200) {
          throw new Error("Unexpected server response")
        }
        // Filter locally by month/year
        const filtered = res.data.filter((s) => s.month === month && s.year === year)
        setSalaryData(filtered)
        if (filtered.length === 0) {
          setError("No salary data available for the selected period.")
        }
      } catch (err) {
        console.error("Error fetching salary data:", err)
        setError(err.response?.data?.message || "Failed to fetch salary data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchSalaries()
  }, [month, year, user.id])

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  return (
    <div className="salary-calculator">
      <h2>My Salary Details</h2>

      <div className="salary-controls">
        <div className="period-selector">
          <div className="form-group">
            <label>Month</label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(+e.target.value)
                setError("")
              }}
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Year</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(+e.target.value)
                setError("")
              }}
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading salary data…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="salary-table-container">
          <table className="salary-table">
            <thead>
              <tr>
                <th>Base Salary</th>
                <th>Overtime Amount</th>
                <th>Deductions</th>
                <th>Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {salaryData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    No salary data for {months[month - 1]} {year}.
                  </td>
                </tr>
              ) : (
                salaryData.map((item, idx) => (
                  <tr key={idx}>
                    <td>${Number.parseFloat(item.base_amount).toFixed(2)}</td>
                    <td>${Number.parseFloat(item.overtime_amount).toFixed(2)}</td>
                    <td>${Number.parseFloat(item.deductions).toFixed(2)}</td>
                    <td>${Number.parseFloat(item.total_amount).toFixed(2)}</td>
                    <td className={`status-${item.status}`}>{item.status}</td>
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

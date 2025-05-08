"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import "./PerformanceEvaluations.css"

export default function PerformanceEvaluation() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [evaluationData, setEvaluationData] = useState({ rating: 3, comments: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [myEvaluations, setMyEvaluations] = useState([])
  const [viewMode, setViewMode] = useState(user?.role === "employee" ? "view" : "create")

  // Fetch employee list for managers/admins
  useEffect(() => {
    if (user?.role === "manager" || user?.role === "admin") {
      setLoading(true)
      api
        .get("/employees")
        .then((res) => setEmployees(res.data))
        .catch((err) => setError("Failed to fetch employees."))
        .finally(() => setLoading(false))
    }
  }, [user?.role])

  // Fetch employee's own evaluations
  useEffect(() => {
    if (user?.id) {
      setLoading(true)
      api
        .get(`/performance/${user.id}`)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setMyEvaluations(res.data)
          } else if (res.data && Array.isArray(res.data.evaluations)) {
            setMyEvaluations(res.data.evaluations)
          } else {
            setMyEvaluations([])
          }
        })
        .catch((err) => {
          console.error("Failed to fetch evaluations:", err)
          setError("Failed to fetch your performance evaluations.")
        })
        .finally(() => setLoading(false))
    }
  }, [user?.id])

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => {
        setError("")
        setSuccess("")
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [error, success])

  const handleEmployeeSelect = (emp) => {
    setSelectedEmployee(emp)
    setEvaluationData({ rating: 3, comments: "" })
    setError("")
  }

  const handleInputChange = ({ target: { name, value } }) => {
    setError("")
    setEvaluationData((data) => ({
      ...data,
      [name]: name === "rating" ? Number(value) : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedEmployee) return setError("Please select an employee.")
    if (!evaluationData.comments.trim()) {
      return setError("Please provide feedback in the comments section.")
    }
    if (evaluationData.rating < 1 || evaluationData.rating > 5) {
      return setError("Rating must be between 1 and 5.")
    }

    try {
      setLoading(true)
      const res = await api.post("/performance", {
        employee_id: selectedEmployee.id,
        rating: evaluationData.rating,
        comments: evaluationData.comments.trim(),
        evaluator_id: user.id,
        evaluation_date: new Date().toISOString().split("T")[0],
      })
      if (res.status !== 201) {
        throw new Error("Unexpected response")
      }
      setSuccess("Performance evaluation submitted successfully.")
      setSelectedEmployee(null)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || "Failed to submit evaluation.")
    } finally {
      setLoading(false)
    }
  }

  // If user is an employee, show their evaluations
  if (user?.role === "employee") {
    return (
      <div className="performance-evaluation">
        <h2>My Performance Evaluations</h2>
        {error && <div className="error">{error}</div>}

        {loading ? (
          <p className="loading-message">Loading evaluations...</p>
        ) : myEvaluations.length === 0 ? (
          <p className="no-evaluations">No performance evaluations found.</p>
        ) : (
          <div className="evaluations-list">
            {myEvaluations.map((evaluation, index) => (
              <div key={index} className="evaluation-card">
                <div className="evaluation-header">
                  <div className="evaluation-date">
                    <span className="label">Date:</span> {new Date(evaluation.evaluation_date).toLocaleDateString()}
                  </div>
                  <div className="evaluation-rating">
                    <span className="label">Rating:</span>
                    <span className={`rating rating-${evaluation.rating}`}>{evaluation.rating}/5</span>
                  </div>
                </div>
                <div className="evaluation-comments">
                  <span className="label">Feedback:</span>
                  <p>{evaluation.comments}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // For managers and admins, show the evaluation form
  return (
    <div className="performance-evaluation">
      <h2>Performance Evaluation</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="employee-selection">
        <h3>Select Employee</h3>
        {loading ? (
          <p>Loading employees…</p>
        ) : (
          <div className="employee-grid">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className={`employee-card ${selectedEmployee?.id === emp.id ? "selected" : ""}`}
                onClick={() => handleEmployeeSelect(emp)}
              >
                <div className="employee-name">
                  {emp.first_name} {emp.last_name}
                </div>
                <div className="employee-position">{emp.position}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEmployee && (
        <div className="evaluation-form">
          <h3>
            Evaluate {selectedEmployee.first_name} {selectedEmployee.last_name}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Performance Rating (1-5)</label>
              <input
                type="range"
                name="rating"
                min="1"
                max="5"
                value={evaluationData.rating}
                onChange={handleInputChange}
              />
              <div className="rating-display">{evaluationData.rating}</div>
              <div className="rating-labels">
                <span>Poor</span>
                <span>Average</span>
                <span>Excellent</span>
              </div>
            </div>
            <div className="form-group">
              <label>Comments</label>
              <textarea
                name="comments"
                value={evaluationData.comments}
                onChange={handleInputChange}
                placeholder="Provide detailed feedback…"
                rows="4"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit Evaluation"}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

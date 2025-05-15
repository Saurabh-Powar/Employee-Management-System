"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "./Loginstyle.css"

const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, user } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      redirectBasedOnRole(user.role)
    }
  }, [user, navigate])

  const redirectBasedOnRole = (role) => {
    console.log(`Redirecting user with role: ${role}`)
    switch (role) {
      case "admin":
        navigate("/admin")
        break
      case "manager":
        navigate("/manager")
        break
      case "employee":
        navigate("/employee")
        break
      default:
        console.error(`Unknown role: ${role}`)
        navigate("/login")
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Client-side validation
    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("Attempting login with:", { email, password })
      const response = await login(email, password)
      console.log("Login response:", response)

      if (response?.user?.role) {
        console.log(`Login successful for ${email} with role: ${response.user.role}`)
        redirectBasedOnRole(response.user.role)
      } else {
        setError("Invalid login response. Please try again.")
      }
    } catch (err) {
      console.error("Login failed:", err)
      setError(err.message || "Login failed. Please check your credentials and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2 className="login-title">Employee Management System</h2>
        <h3 className="login-subtitle">Login</h3>

        {error && <p className="error-message">{error}</p>}

        <div className="input-group">
          <label className="input-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
            autoComplete="email"
            placeholder="Enter your email"
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="test-accounts">
          <p>Test Accounts:</p>
          <ul>
            <li>Admin: admin@example.com / admin123</li>
            <li>Manager: manager@example.com / manager123</li>
            <li>Employee: employee@example.com / employee123</li>
          </ul>
        </div>
      </form>
    </div>
  )
}

export default Login

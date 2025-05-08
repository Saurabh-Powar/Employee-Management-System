"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "./Loginstyle.css"

const Login = () => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, user, isAuthenticated } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectBasedOnRole(user.role)
    }
  }, [isAuthenticated, user, navigate])

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
    setLoading(true)
    setError(null)

    try {
      const response = await login(username, password)
      console.log("Login response:", response)

      if (response?.user?.role) {
        console.log(`Login successful for ${username} with role: ${response.user.role}`)
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
        <h2 className="login-title">Login</h2>

        {error && <p className="error-message">{error}</p>}

        <div className="input-group">
          <label className="input-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            required
            autoComplete="username"
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
          />
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  )
}

export default Login

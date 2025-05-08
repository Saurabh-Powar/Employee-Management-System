"use client"

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Login from "./pages/login"
import EmployeePage from "./pages/EmployeePage"
import ManagerPage from "./pages/ManagerPage"
import AdminPage from "./pages/AdminPage"
import ErrorBoundary from "./components/ErrorBoundary"
import "./AppS.css"

// Protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    console.log("User not authenticated, redirecting to login")
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log(`User role ${user.role} not allowed, redirecting to appropriate page`)
    // Redirect to appropriate page based on role
    if (user.role === "admin") return <Navigate to="/admin" replace />
    if (user.role === "manager") return <Navigate to="/manager" replace />
    if (user.role === "employee") return <Navigate to="/employee" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

// Root redirect component
const RootRedirect = () => {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Redirect based on user role
  switch (user.role) {
    case "admin":
      return <Navigate to="/admin" replace />
    case "manager":
      return <Navigate to="/manager" replace />
    case "employee":
      return <Navigate to="/employee" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

// App content with routes
const AppContent = () => {
  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/employee"
            element={
              <ProtectedRoute allowedRoles={["employee"]}>
                <EmployeePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={["manager"]}>
                <ManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App

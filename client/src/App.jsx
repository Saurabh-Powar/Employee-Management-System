"use client"

import { BrowserRouter as Router, Route, Navigate, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext.jsx"
import Login from "./pages/login.jsx"
import ManagerPage from "./pages/ManagerPage.jsx"
import EmployeePage from "./pages/EmployeePage.jsx"
import AdminPage from "./pages/AdminPage.jsx"
import "./AppS.css"

// Main App component wrapped with AuthProvider
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  // Show loading state while checking auth
  if (loading) {
    return <div className="spinner">Loading...</div>
  }

  return (
    <Routes>
      {/* Redirect logged-in users away from login */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Role-based routing */}
      <Route
        path="/"
        element={
          user ? (
            user.role === "admin" ? (
              <AdminPage />
            ) : user.role === "manager" ? (
              <ManagerPage />
            ) : user.role === "employee" ? (
              <EmployeePage />
            ) : (
              <Navigate to="/login" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Add routes for direct access to role pages */}
      <Route path="/admin" element={user && user.role === "admin" ? <AdminPage /> : <Navigate to="/login" replace />} />
      <Route
        path="/manager"
        element={user && user.role === "manager" ? <ManagerPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/employee"
        element={user && user.role === "employee" ? <EmployeePage /> : <Navigate to="/login" replace />}
      />

      {/* Catch all other routes and redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App

import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AuthProvider } from "./context/AuthContext" // Ensure AuthContext is wrapped properly
import "./index.css"

// Create root for React 18+ usage
const root = ReactDOM.createRoot(document.getElementById("root"))

root.render(
  <React.StrictMode>
    <AuthProvider>
      {" "}
      {/* Wrapping the App with AuthProvider for user authentication management */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

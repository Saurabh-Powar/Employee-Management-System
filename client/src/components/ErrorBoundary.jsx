"use client"

import React from "react"

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Error caught by ErrorBoundary:", error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            <summary>Show error details</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
            <p>Component Stack Error Details:</p>
            <p>{this.state.errorInfo && this.state.errorInfo.componentStack}</p>
          </details>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

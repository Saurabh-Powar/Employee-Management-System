// WebSocket service for real-time communication with reconnection and polling fallback
class WebSocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10 // Increased from 5
    this.reconnectTimeout = null
    this.reconnectInterval = 3000 // 3 seconds
    this.eventListeners = {}
    this.userId = null
    this.userRole = null
    this.baseUrl = import.meta.env.VITE_WS_URL || "ws://localhost:5000"
    this.pollingEnabled = false
    this.pollingIntervals = {}
    this.pollingEndpoints = {
      attendance_update: "/api/attendance",
      leave_update: "/api/leaves",
      notification: "/api/notifications",
      "task-created": "/api/tasks",
      "task-updated": "/api/tasks",
      "task-deleted": "/api/tasks",
    }
  }

  // Connect to WebSocket server with improved error handling
  connect(userId, userRole) {
    if (this.socket && this.isConnected) {
      console.log("WebSocket already connected")
      return
    }

    this.userId = userId
    this.userRole = userRole

    try {
      const url = `${this.baseUrl}?userId=${userId}&userRole=${userRole}`

      // Clear any existing connection
      if (this.socket) {
        this.socket.close()
        this.socket = null
      }

      this.socket = new WebSocket(url)

      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.isConnected = true
        this.reconnectAttempts = 0

        // Send authentication message
        this.send({
          type: "auth",
          data: { userId, userRole },
        })

        // Stop any polling that may have been started
        this.disablePollingFallback()
      }

      this.socket.onclose = (event) => {
        console.log("WebSocket disconnected", event)
        this.isConnected = false

        if (event.code !== 1000) {
          // Not a normal closure
          this.handleReconnect()
        }
      }

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
        this.isConnected = false
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }
    } catch (error) {
      console.error("Error connecting to WebSocket:", error)
      this.handleReconnect()
    }
  }

  // Handle reconnection logic with exponential backoff
  handleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++

      // Exponential backoff with maximum of 30 seconds
      const delay = Math.min(30000, this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1))

      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${Math.round(delay / 1000)}s...`,
      )

      this.reconnectTimeout = setTimeout(() => {
        if (this.userId && this.userRole) {
          this.connect(this.userId, this.userRole)
        }
      }, delay)

      // If we've tried 3 times already, start polling as fallback
      if (this.reconnectAttempts >= 3) {
        this.enablePollingFallback()
      }
    } else {
      console.error("Max reconnect attempts reached. Using polling fallback only.")
      this.enablePollingFallback()
    }
  }

  // Enable polling fallback for real-time updates
  enablePollingFallback() {
    if (this.pollingEnabled) return

    console.log("Enabling polling fallback for real-time updates")
    this.pollingEnabled = true

    // Set up polling for different event types
    for (const [eventType, endpoint] of Object.entries(this.pollingEndpoints)) {
      // Only set up polling for events that have listeners
      if (this.eventListeners[eventType] && this.eventListeners[eventType].length > 0) {
        // Use different intervals for different event types to avoid overwhelming the server
        const interval = 5000 + Math.random() * 2000 // 5-7 seconds, slightly randomized

        this.pollingIntervals[eventType] = setInterval(() => {
          this.pollEndpoint(eventType, endpoint)
        }, interval)
      }
    }
  }

  // Disable polling fallback
  disablePollingFallback() {
    if (!this.pollingEnabled) return

    console.log("Disabling polling fallback")
    this.pollingEnabled = false

    // Clear all polling intervals
    for (const interval of Object.values(this.pollingIntervals)) {
      clearInterval(interval)
    }

    this.pollingIntervals = {}
  }

  // Poll an API endpoint for updates
  async pollEndpoint(eventType, endpoint) {
    if (!this.userId) return

    try {
      const response = await fetch(`${endpoint}${eventType === "notification" ? `/${this.userId}` : ""}`, {
        credentials: "include", // For session cookies
      })

      if (response.ok) {
        const data = await response.json()

        // Simulate WebSocket message for this event type
        if (Array.isArray(data)) {
          data.forEach((item) => {
            this.handleMessage({
              type: eventType,
              data: item,
            })
          })
        } else {
          this.handleMessage({
            type: eventType,
            data,
          })
        }
      }
    } catch (error) {
      console.error(`Polling error for ${eventType}:`, error)
    }
  }

  // Disconnect WebSocket with clean closure
  disconnect() {
    // Disable polling first
    this.disablePollingFallback()

    if (this.socket) {
      // Use code 1000 for normal closure
      this.socket.close(1000, "User disconnected")
      this.socket = null
      this.isConnected = false

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }

      console.log("WebSocket disconnected")
    }

    // Reset user info
    this.userId = null
    this.userRole = null
  }

  // Send message to server with retry logic
  send(message) {
    if (!this.socket || !this.isConnected) {
      console.error("Cannot send message: WebSocket not connected")
      return false
    }

    try {
      this.socket.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error("Error sending WebSocket message:", error)

      // Try to reconnect on send failure
      this.handleReconnect()
      return false
    }
  }

  // Handle incoming messages with improved error isolation
  handleMessage(message) {
    if (!message || !message.type) {
      console.error("Invalid message format:", message)
      return
    }

    // Dispatch message to registered event listeners
    const listeners = this.eventListeners[message.type] || []
    listeners.forEach((callback) => {
      try {
        callback(message.data)
      } catch (error) {
        console.error(`Error in ${message.type} event listener:`, error)
        // Don't let one handler's error affect others
      }
    })
  }

  // Register event listener with validation
  on(eventType, callback) {
    if (typeof callback !== "function") {
      console.error("Event listener must be a function")
      return () => {}
    }

    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = []
    }

    this.eventListeners[eventType].push(callback)

    // If we're already using polling fallback, set up polling for this event type
    if (this.pollingEnabled && this.pollingEndpoints[eventType] && !this.pollingIntervals[eventType]) {
      const interval = 5000 + Math.random() * 2000
      this.pollingIntervals[eventType] = setInterval(() => {
        this.pollEndpoint(eventType, this.pollingEndpoints[eventType])
      }, interval)
    }

    // Return a function to remove this specific listener
    return () => {
      this.eventListeners[eventType] = this.eventListeners[eventType].filter((cb) => cb !== callback)

      // If no more listeners for this event type, clear the polling interval
      if (this.pollingEnabled && this.eventListeners[eventType].length === 0 && this.pollingIntervals[eventType]) {
        clearInterval(this.pollingIntervals[eventType])
        delete this.pollingIntervals[eventType]
      }
    }
  }

  // Check if WebSocket is connected
  isConnected() {
    return this.isConnected
  }

  // Get connection state information
  getConnectionInfo() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      pollingEnabled: this.pollingEnabled,
      userId: this.userId,
      userRole: this.userRole,
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService()
export default websocketService

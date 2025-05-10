// WebSocket service for real-time communication
class WebSocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectTimeout = null
    this.reconnectInterval = 3000 // 3 seconds
    this.eventListeners = {}
    this.userId = null
    this.userRole = null
    this.baseUrl = import.meta.env.VITE_WS_URL || "ws://localhost:5000"
  }

  // Connect to WebSocket server
  connect(userId, userRole) {
    if (this.socket && this.isConnected) {
      console.log("WebSocket already connected")
      return
    }

    this.userId = userId
    this.userRole = userRole

    try {
      const url = `${this.baseUrl}?userId=${userId}&userRole=${userRole}`
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
      }

      this.socket.onclose = (event) => {
        console.log("WebSocket disconnected", event)
        this.isConnected = false
        this.handleReconnect()
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

  // Handle reconnection logic
  handleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

      this.reconnectTimeout = setTimeout(() => {
        if (this.userId && this.userRole) {
          this.connect(this.userId, this.userRole)
        }
      }, this.reconnectInterval * this.reconnectAttempts)
    } else {
      console.error("Max reconnect attempts reached. Please refresh the page.")
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
      this.isConnected = false

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }

      console.log("WebSocket disconnected")
    }
  }

  // Send message to server
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
      return false
    }
  }

  // Handle incoming messages
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
      }
    })
  }

  // Register event listener
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = []
    }

    this.eventListeners[eventType].push(callback)

    // Return a function to remove this specific listener
    return () => {
      this.eventListeners[eventType] = this.eventListeners[eventType].filter((cb) => cb !== callback)
    }
  }

  // Check if WebSocket is connected
  isConnected() {
    return this.isConnected
  }
}

// Create singleton instance
const websocketService = new WebSocketService()
export default websocketService

class WebSocketService {
    constructor() {
      this.socket = null
      this.isConnected = false
      this.reconnectAttempts = 0
      this.maxReconnectAttempts = 5
      this.reconnectTimeout = null
      this.listeners = new Map()
      this.baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000"
    }
  
    connect(userId, role) {
      if (this.socket) {
        this.disconnect()
      }
  
      // Convert http/https to ws/wss
      const wsUrl = this.baseUrl.replace(/^http/, "ws") + "/ws"
  
      this.socket = new WebSocket(wsUrl)
  
      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.isConnected = true
        this.reconnectAttempts = 0
  
        // Send authentication message
        this.send({
          type: "auth",
          userId,
          role,
        })
      }
  
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
  
          // Handle different message types
          if (data.type && this.listeners.has(data.type)) {
            this.listeners.get(data.type).forEach((callback) => {
              callback(data)
            })
          }
  
          // Also trigger 'all' listeners
          if (this.listeners.has("all")) {
            this.listeners.get("all").forEach((callback) => {
              callback(data)
            })
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }
  
      this.socket.onclose = () => {
        console.log("WebSocket disconnected")
        this.isConnected = false
  
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
            this.connect(userId, role)
          }, 3000) // Wait 3 seconds before reconnecting
        }
      }
  
      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    }
  
    disconnect() {
      if (this.socket) {
        this.socket.close()
        this.socket = null
      }
  
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }
  
      this.isConnected = false
    }
  
    send(data) {
      if (this.socket && this.isConnected) {
        this.socket.send(JSON.stringify(data))
      } else {
        console.warn("Cannot send message: WebSocket not connected")
      }
    }
  
    on(type, callback) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, [])
      }
  
      this.listeners.get(type).push(callback)
  
      // Return a function to remove this listener
      return () => {
        const typeListeners = this.listeners.get(type)
        const index = typeListeners.indexOf(callback)
        if (index !== -1) {
          typeListeners.splice(index, 1)
        }
      }
    }
  
    off(type, callback) {
      if (this.listeners.has(type)) {
        const typeListeners = this.listeners.get(type)
        const index = typeListeners.indexOf(callback)
        if (index !== -1) {
          typeListeners.splice(index, 1)
        }
      }
    }
  }
  
  // Create a singleton instance
  const websocketService = new WebSocketService()
  
  export default websocketService
  
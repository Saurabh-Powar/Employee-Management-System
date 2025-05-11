// WebSocket service for real-time communication using socket.io-client
import { io } from "socket.io-client"

// Get WebSocket URL from environment or use default
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || "http://localhost:5000"

let socket = null
let eventListeners = {}
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10

// Initialize WebSocket connection
export const initWebSocket = (userId, role) => {
  if (socket && socket.connected) {
    console.log("WebSocket already connected")
    return
  }

  try {
    console.log(`Connecting to WebSocket at ${WS_URL}`)

    socket = io(WS_URL, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
      path: "/socket.io", // Must match server path
    })

    socket.on("connect", () => {
      console.log("WebSocket connection established")
      reconnectAttempts = 0

      // Send authentication message
      if (userId && role) {
        sendAuth(userId, role)
      }
    })

    socket.on("auth_success", (data) => {
      console.log("WebSocket authentication successful:", data)
    })

    socket.on("auth_error", (data) => {
      console.error("WebSocket authentication failed:", data)
    })

    socket.on("message", (data) => {
      try {
        console.log("WebSocket message received:", data.type)
        // Dispatch event to listeners
        dispatchEvent(data)
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    })

    socket.on("disconnect", (reason) => {
      console.log(`WebSocket disconnected: ${reason}`)
    })

    socket.on("error", (error) => {
      console.error("WebSocket error:", error)
    })

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`WebSocket reconnection attempt ${attemptNumber}`)
    })

    socket.on("reconnect_failed", () => {
      console.error("WebSocket reconnection failed after all attempts")
    })
  } catch (error) {
    console.error("Error initializing WebSocket:", error)
  }
}

// Dispatch an event to registered listeners
const dispatchEvent = (data) => {
  if (eventListeners[data.type]) {
    eventListeners[data.type].forEach((callback) => {
      try {
        callback(data.data)
      } catch (error) {
        console.error(`Error in event listener for ${data.type}:`, error)
      }
    })
  }
}

// Send authentication message
export const sendAuth = (userId, role) => {
  if (!userId || !role) {
    console.error("Cannot authenticate WebSocket: missing userId or role")
    return
  }

  if (socket && socket.connected) {
    socket.emit("auth", { userId, role })
    console.log("WebSocket authentication sent")
  } else {
    console.log("WebSocket not connected, cannot send auth")
    // Try to initialize the connection
    initWebSocket(userId, role)
  }
}

// Send a message through WebSocket
export const sendMessage = (type, data) => {
  if (socket && socket.connected) {
    socket.emit(type, data)
    return true
  } else {
    console.log(`WebSocket not connected, cannot send message ${type}`)
    return false
  }
}

// Add event listener
export const addEventListener = (eventType, callback) => {
  if (!eventListeners[eventType]) {
    eventListeners[eventType] = []
  }

  // Prevent duplicate listeners
  if (!eventListeners[eventType].includes(callback)) {
    eventListeners[eventType].push(callback)
  }

  return () => {
    removeEventListener(eventType, callback)
  }
}

// Remove event listener
export const removeEventListener = (eventType, callback) => {
  if (eventListeners[eventType]) {
    eventListeners[eventType] = eventListeners[eventType].filter((cb) => cb !== callback)
  }
}

// Close WebSocket connection
export const closeWebSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  eventListeners = {}
  reconnectAttempts = 0
}

// Subscribe to an event
export const subscribeToEvent = (eventType, callback) => {
  return addEventListener(eventType, callback)
}

// Check if WebSocket is connected
export const isConnected = () => {
  return socket && socket.connected
}

// Ping to keep connection alive
export const ping = () => {
  sendMessage("ping", { timestamp: Date.now() })
}

// Setup periodic ping to keep connection alive
export const setupKeepAlive = (interval = 30000) => {
  const intervalId = setInterval(() => {
    if (isConnected()) {
      ping()
    }
  }, interval)

  return () => clearInterval(intervalId)
}

// Export WebSocket service
export default {
  initWebSocket,
  sendAuth,
  sendMessage,
  addEventListener,
  removeEventListener,
  closeWebSocket,
  subscribeToEvent,
  isConnected,
  ping,
  setupKeepAlive,
}

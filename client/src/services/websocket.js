import { io } from "socket.io-client"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

let socket = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const reconnectDelay = 3000 // 3 seconds

// Initialize socket connection
const initSocket = () => {
  if (socket) return socket

  socket = io(API_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay,
    timeout: 10000,
  })

  // Setup event listeners
  socket.on("connect", () => {
    console.log("WebSocket connected")
    reconnectAttempts = 0

    // Notify any components that need to know about reconnection
    window.dispatchEvent(new CustomEvent("websocket-reconnected"))
  })

  socket.on("disconnect", (reason) => {
    console.log(`WebSocket disconnected: ${reason}`)
  })

  socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error.message)
    reconnectAttempts++

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(`Failed to connect after ${maxReconnectAttempts} attempts`)
      // Notify UI about connection failure
      window.dispatchEvent(new CustomEvent("websocket-failed"))
    }
  })

  socket.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

  return socket
}

// Get socket instance (creates one if it doesn't exist)
const getSocket = () => {
  if (!socket) {
    return initSocket()
  }
  return socket
}

// Safely emit events with error handling
const safeEmit = (event, data, callback) => {
  const socket = getSocket()
  if (socket && socket.connected) {
    socket.emit(event, data, callback)
    return true
  } else {
    console.warn(`Cannot emit ${event} - socket not connected`)
    // Try to reconnect
    if (socket && !socket.connected) {
      socket.connect()
    }
    return false
  }
}

// Subscribe to an event
const subscribe = (event, callback) => {
  const socket = getSocket()
  socket.on(event, callback)

  // Return unsubscribe function
  return () => {
    socket.off(event, callback)
  }
}

// Manually reconnect
const reconnect = () => {
  if (socket) {
    socket.connect()
  } else {
    initSocket()
  }
}

// Disconnect socket
const disconnect = () => {
  if (socket) {
    socket.disconnect()
  }
}

export default {
  initSocket,
  getSocket,
  safeEmit,
  subscribe,
  reconnect,
  disconnect,
}

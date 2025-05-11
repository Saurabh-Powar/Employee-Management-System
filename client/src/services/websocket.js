// WebSocket service for real-time communication
let socket = null
let reconnectTimer = null
let isConnecting = false
let authSent = false
let messageQueue = []
let eventListeners = {}
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_DELAY = 3000

// Get WebSocket URL from environment or use default
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:5000"

// Initialize WebSocket connection
export const initWebSocket = (userId, role) => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("WebSocket already connected or connecting")
    return
  }

  if (isConnecting) {
    console.log("WebSocket connection already in progress")
    return
  }

  isConnecting = true
  authSent = false

  try {
    console.log(`Connecting to WebSocket at ${WS_URL}`)
    socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      console.log("WebSocket connection established")
      isConnecting = false
      reconnectAttempts = 0

      // Send authentication message
      if (userId && role) {
        sendAuth(userId, role)
      }

      // Process any queued messages
      processQueue()
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log("WebSocket message received:", data.type)

        // Handle authentication confirmation
        if (data.type === "auth_success") {
          console.log("WebSocket authentication successful")
          authSent = true
        }

        // Dispatch event to listeners
        dispatchEvent(data)
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    }

    socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`)
      socket = null
      isConnecting = false
      authSent = false

      // Attempt to reconnect after delay with exponential backoff
      scheduleReconnect(userId, role)
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
      isConnecting = false
    }
  } catch (error) {
    console.error("Error initializing WebSocket:", error)
    isConnecting = false

    // Attempt to reconnect after delay
    scheduleReconnect(userId, role)
  }
}

// Process the message queue
const processQueue = () => {
  while (messageQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
    const msg = messageQueue.shift()
    socket.send(JSON.stringify(msg))
  }
}

// Schedule a reconnection attempt with exponential backoff
const scheduleReconnect = (userId, role) => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("Maximum reconnection attempts reached. Giving up.")
    return
  }

  const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts)
  reconnectAttempts++

  console.log(`Scheduling reconnection attempt ${reconnectAttempts} in ${delay}ms`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    console.log("Attempting to reconnect WebSocket...")
    initWebSocket(userId, role)
  }, delay)
}

// Send authentication message
export const sendAuth = (userId, role) => {
  if (!userId || !role) {
    console.error("Cannot authenticate WebSocket: missing userId or role")
    return
  }

  const authMessage = {
    type: "auth",
    userId,
    role,
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(authMessage))
    authSent = true
    console.log("WebSocket authentication sent")
  } else {
    // Queue the message to be sent when connection is established
    messageQueue.push(authMessage)
    console.log("WebSocket not ready, authentication message queued")

    // Try to initialize the connection if it's not already connecting
    if (!isConnecting && !socket) {
      initWebSocket(userId, role)
    }
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

// Send a message through WebSocket
export const sendMessage = (type, data) => {
  const message = {
    type,
    data,
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
    return true
  } else {
    console.log(`WebSocket not ready, message ${type} queued`)
    messageQueue.push(message)

    // Try to initialize the connection if it's not already connecting
    if (!isConnecting && !socket) {
      initWebSocket()
    }
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
    socket.close()
    socket = null
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  isConnecting = false
  authSent = false
  messageQueue = []
  eventListeners = {}
  reconnectAttempts = 0
}

// Subscribe to an event
export const subscribeToEvent = (eventType, callback) => {
  return addEventListener(eventType, callback)
}

// Check if WebSocket is connected
export const isConnected = () => {
  return socket && socket.readyState === WebSocket.OPEN
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

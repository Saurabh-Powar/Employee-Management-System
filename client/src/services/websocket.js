// WebSocket service for real-time communication
let socket = null
let reconnectTimer = null
let isConnecting = false
let authSent = false
let messageQueue = []
let eventListeners = {}

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

      // Send authentication message
      if (userId && role) {
        sendAuth(userId, role)
      }

      // Process any queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()
        socket.send(JSON.stringify(msg))
      }
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
        if (eventListeners[data.type]) {
          eventListeners[data.type].forEach((callback) => {
            try {
              callback(data.data)
            } catch (error) {
              console.error(`Error in event listener for ${data.type}:`, error)
            }
          })
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    }

    socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`)
      socket = null
      isConnecting = false
      authSent = false

      // Attempt to reconnect after delay
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          console.log("Attempting to reconnect WebSocket...")
          initWebSocket(userId, role)
        }, 5000)
      }
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
      isConnecting = false
    }
  } catch (error) {
    console.error("Error initializing WebSocket:", error)
    isConnecting = false

    // Attempt to reconnect after delay
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        console.log("Attempting to reconnect WebSocket after error...")
        initWebSocket(userId, role)
      }, 5000)
    }
  }
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
  eventListeners[eventType].push(callback)

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
}

export const subscribeToEvent = (eventType, callback) => {
  return addEventListener(eventType, callback);
};

// Check if WebSocket is connected
export const isConnected = () => {
  return socket && socket.readyState === WebSocket.OPEN
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
  isConnected
}

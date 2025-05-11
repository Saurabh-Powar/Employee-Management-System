const socketIo = require("socket.io")

let io = null

// Initialize WebSocket server
const init = (server) => {
  if (io) return io

  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000, // 1 minute
    pingInterval: 25000, // 25 seconds
  })

  io.on("connection", (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`)

    // Set up authentication
    socket.on("authenticate", (data) => {
      if (data && data.userId) {
        socket.userId = data.userId
        socket.userRole = data.userRole
        socket.join(`user:${data.userId}`)

        if (data.userRole) {
          socket.join(`role:${data.userRole}`)
        }

        console.log(`User ${data.userId} authenticated on socket ${socket.id}`)
      }
    })

    // Handle client disconnection
    socket.on("disconnect", (reason) => {
      console.log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`)
    })

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for client ${socket.id}:`, error)
    })
  })

  // Global error handling for the io server
  io.engine.on("connection_error", (err) => {
    console.error("WebSocket connection error:", err)
  })

  console.log("WebSocket server initialized")
  return io
}

// Get the io instance
const getIo = () => {
  if (!io) {
    console.warn("WebSocket server not initialized yet")
    return null
  }
  return io
}

// Safely emit events with error handling
const safeEmit = (event, data, room = null) => {
  try {
    if (!io) {
      console.warn(`Cannot emit ${event} - WebSocket server not initialized`)
      return false
    }

    if (room) {
      io.to(room).emit(event, data)
    } else {
      io.emit(event, data)
    }
    return true
  } catch (error) {
    console.error(`Error emitting ${event}:`, error)
    return false
  }
}

// Emit to a specific user
const emitToUser = (userId, event, data) => {
  return safeEmit(event, data, `user:${userId}`)
}

// Emit to a specific role
const emitToRole = (role, event, data) => {
  return safeEmit(event, data, `role:${role}`)
}

module.exports = {
  init,
  getIo,
  safeEmit,
  emitToUser,
  emitToRole,
}

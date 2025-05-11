const WebSocket = require("ws")
const cookie = require("cookie")
const jwt = require("jsonwebtoken")
const { createAdapter } = require("@socket.io/postgres-adapter")
const pool = require("./db/sql")
const socketIo = require("socket.io")
const { Server } = require("socket.io")

// WebSocket server instance
let io = null
let wss = null
const connectedClients = new Map()

// Initialize WebSocket server
const init = (server) => {
  if (io) {
    console.log("WebSocket server already initialized")
    return io
  }

  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io", // Explicit path for socket.io
  })

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`)

    // Handle authentication
    socket.on("auth", (data) => {
      if (data.userId && data.role) {
        socket.userId = data.userId
        socket.userRole = data.role
        socket.join(`user:${data.userId}`)
        socket.join(`role:${data.role}`)

        socket.emit("auth_success", { message: "Authentication successful" })
        console.log(`User ${data.userId} (${data.role}) authenticated`)
      } else {
        socket.emit("auth_error", { message: "Authentication failed" })
      }
    })

    // Handle ping
    socket.on("ping", (data) => {
      socket.emit("pong", { timestamp: Date.now() })
    })

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })

  console.log("WebSocket server initialized")
  return io
}

// Create a WebSocket server (legacy)
const initWss = (server) => {
  try {
    wss = new WebSocket.Server({ server })

    wss.on("connection", (ws, req) => {
      console.log("WebSocket client connected")

      // Set up ping/pong to detect dead connections
      ws.isAlive = true
      ws.on("pong", () => {
        ws.isAlive = true
      })

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log("Received message:", data)

          // Handle ping messages
          if (data.type === "ping") {
            ws.send(
              JSON.stringify({
                type: "pong",
                data: { timestamp: Date.now() },
              }),
            )
            ws.isAlive = true
            return
          }

          // Broadcast to all clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data))
            }
          })
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      })

      ws.on("close", () => {
        console.log("WebSocket client disconnected")
      })
    })

    // Set up periodic checks for dead connections
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate()

        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // Check every 30 seconds

    wss.on("close", () => {
      clearInterval(interval)
    })

    return wss
  } catch (error) {
    console.error("Error initializing WebSocket server:", error)
    throw error
  }
}

// Send a message to a specific user
const sendToUser = (userId, message) => {
  if (!io) {
    console.log("WebSocket not initialized, message not sent")
    return false
  }

  io.to(`user:${userId}`).emit(message.type, message.data)
  return true
}

// Send a message to all users with a specific role
const sendToRole = (role, message) => {
  if (!io) {
    console.log("WebSocket not initialized, message not sent")
    return false
  }

  if (role === "manager" || role === "admin") {
    io.to("managers").emit(message.type, message.data)
  } else {
    // Broadcast to all clients for other roles
    io.emit(message.type, message.data)
  }
  return true
}

// Get client count
const getClientCount = () => {
  if (!io) return 0
  return io.sockets.sockets.size
}

// Get the io instance
const getIo = () => {
  if (!io) {
    throw new Error("WebSocket server not initialized")
  }
  return io
}

// Export WebSocket server
module.exports = {
  init,
  initWss,
  sendToUser,
  sendToRole,
  getClientCount,
  get io() {
    return getIo()
  },
  get wss() {
    if (!wss) {
      return {
        clients: { forEach: () => {} },
      }
    }
    return wss
  },
}

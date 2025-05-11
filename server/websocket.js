const WebSocket = require("ws")
const cookie = require("cookie")
const jwt = require("jsonwebtoken")
const { createAdapter } = require("@socket.io/postgres-adapter")
const { Server } = require("socket.io")
const pool = require("./db/sql")

// WebSocket server instance
let io = null
let wss = null
const connectedClients = new Map()

// Initialize WebSocket server
const init = (server) => {
  try {
    console.log("WebSocket server initialized")

    // Create Socket.IO server
    io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
    })

    // Set up PostgreSQL adapter for Socket.IO
    const pgClient = pool
    io.adapter(createAdapter(pgClient))

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        const cookies = cookie.parse(socket.handshake.headers.cookie || "")
        const token = cookies.token

        if (!token) {
          return next(new Error("Authentication error: No token provided"))
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
        socket.user = decoded

        // Store user info in socket
        socket.data.userId = decoded.id
        socket.data.role = decoded.role

        next()
      } catch (error) {
        console.error("WebSocket authentication error:", error)
        next(new Error("Authentication error"))
      }
    })

    // Connection handler
    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.data.userId}, Role: ${socket.data.role}`)

      // Store client connection
      connectedClients.set(socket.id, {
        userId: socket.data.userId,
        role: socket.data.role,
        lastActivity: Date.now(),
      })

      // Join room based on user role and ID
      socket.join(`user:${socket.data.userId}`)

      if (socket.data.role === "manager" || socket.data.role === "admin") {
        socket.join("managers")
      }

      // Handle ping messages to keep connection alive
      socket.on("ping", (data) => {
        if (connectedClients.has(socket.id)) {
          const clientInfo = connectedClients.get(socket.id)
          clientInfo.lastActivity = Date.now()
          connectedClients.set(socket.id, clientInfo)
        }

        socket.emit("pong", { timestamp: Date.now() })
      })

      // Handle attendance updates
      socket.on("attendance_update", (data) => {
        // Broadcast to relevant users
        io.to(`user:${data.employee_id}`).emit("attendance_update", data)
        io.to("managers").emit("attendance_update", data)
      })

      // Handle leave requests
      socket.on("leave_request", (data) => {
        // Broadcast to relevant users
        io.to(`user:${data.employee_id}`).emit("leave_request", data)
        io.to("managers").emit("leave_request", data)
      })

      // Handle task updates
      socket.on("task_update", (data) => {
        // Broadcast to relevant users
        if (data.assignee_id) {
          io.to(`user:${data.assignee_id}`).emit("task_update", data)
        }
        io.to("managers").emit("task_update", data)
      })

      // Handle notifications
      socket.on("notification", (data) => {
        // Send to specific user
        if (data.recipient_id) {
          io.to(`user:${data.recipient_id}`).emit("notification", data)
        }
      })

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.data.userId}`)
        connectedClients.delete(socket.id)
      })
    })

    // Set up periodic cleanup of inactive connections
    setInterval(
      () => {
        const now = Date.now()
        const INACTIVE_THRESHOLD = 10 * 60 * 1000 // 10 minutes

        for (const [socketId, clientInfo] of connectedClients.entries()) {
          if (now - clientInfo.lastActivity > INACTIVE_THRESHOLD) {
            console.log(`Cleaning up inactive connection for user: ${clientInfo.userId}`)

            // Get the socket and disconnect it if it still exists
            const socket = io.sockets.sockets.get(socketId)
            if (socket) {
              socket.disconnect(true)
            }

            connectedClients.delete(socketId)
          }
        }
      },
      5 * 60 * 1000,
    ) // Run every 5 minutes

    return io
  } catch (error) {
    console.error("Error initializing WebSocket server:", error)
    throw error
  }
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

// Export WebSocket server
module.exports = {
  init,
  initWss,
  sendToUser,
  sendToRole,
  getClientCount,
  get io() {
    // Return a dummy emitter if io is not initialized
    if (!io) {
      return {
        emit: () => console.log("WebSocket not initialized, event not emitted"),
        to: () => ({
          emit: () => console.log("WebSocket not initialized, event not emitted"),
        }),
      }
    }
    return io
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

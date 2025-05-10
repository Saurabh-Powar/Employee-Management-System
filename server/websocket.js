const WebSocket = require("ws")
const cookie = require("cookie")
const jwt = require("jsonwebtoken")
const { createAdapter } = require("@socket.io/postgres-adapter")
const { Server } = require("socket.io")
const pool = require("./db/sql")

// WebSocket server instance
let io = null
let wss = null

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

      // Join room based on user role and ID
      socket.join(`user:${socket.data.userId}`)

      if (socket.data.role === "manager" || socket.data.role === "admin") {
        socket.join("managers")
      }

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
      })
    })

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

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log("Received message:", data)

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

    return wss
  } catch (error) {
    console.error("Error initializing WebSocket server:", error)
    throw error
  }
}

// Export WebSocket server
module.exports = {
  init,
  initWss,
  get io() {
    // Return a dummy emitter if io is not initialized
    if (!io) {
      return {
        emit: () => console.log("WebSocket not initialized, event not emitted")
      };
    }
    return io
  },
  get wss() {
    if (!wss) {
      throw new Error("WebSocket server not initialized. Call initWss() first.")
    }
    return wss
  },
}

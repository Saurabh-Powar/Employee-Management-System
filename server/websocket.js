import { WebSocketServer } from "ws"
import jwt from "jsonwebtoken"
import url from "url"

// Store active connections
const activeConnections = new Map()

// Initialize WebSocket server
const initializeWebSocketServer = (server) => {
  const wss = new WebSocketServer({ noServer: true })

  // Handle upgrade requests
  server.on("upgrade", (request, socket, head) => {
    const { pathname, query } = url.parse(request.url, true)
    console.log("WebSocket request received:", { pathname, query })

    if (pathname === "/ws") {
      const { userId, token } = query

      if (!userId || !token) {
        console.error("WebSocket connection rejected: Missing userId or token")
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
        socket.destroy()
        return
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
        if (decoded.id.toString() !== userId) {
          console.error("WebSocket connection rejected: User ID mismatch")
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
          socket.destroy()
          return
        }

        console.log("WebSocket connection authenticated for user:", decoded)
        websocket.io.handleUpgrade(request, socket, head, (ws) => {
          websocket.io.emit("connection", ws, request)
        })
      } catch (err) {
        console.error("WebSocket connection rejected:", err.message)
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
        socket.destroy()
      }
    }
  })

  // Handle new connections
  wss.on("connection", (ws, request, userId) => {
    console.log(`WebSocket connection established for user ${userId}`)

    // Store the connection
    activeConnections.set(userId, ws)

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connection_established",
        message: "Connected to WebSocket server",
      }),
    )

    // Handle messages from client
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message)
        console.log(`Received message from user ${userId}:`, data)

        // Handle different message types
        switch (data.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
            break

          default:
            // Echo back the message (for testing)
            ws.send(
              JSON.stringify({
                type: "echo",
                originalMessage: data,
                timestamp: Date.now(),
              }),
            )
            break
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    })

    // Handle connection close
    ws.on("close", () => {
      console.log(`WebSocket connection closed for user ${userId}`)
      activeConnections.delete(userId)
    })

    // Handle errors
    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error)
      activeConnections.delete(userId)
    })
  })

  // Heartbeat to keep connections alive
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate()
      }

      ws.isAlive = false
      ws.ping()
    })
  }, 30000)

  wss.on("close", () => {
    clearInterval(interval)
  })

  return wss
}

// Send message to specific user
const sendToUser = (userId, message) => {
  const ws = activeConnections.get(userId.toString())

  if (ws && ws.readyState === WebSocketServer.OPEN) {
    ws.send(JSON.stringify(message))
    return true
  }

  return false
}

// Broadcast message to multiple users
const broadcastToUsers = (userIds, message) => {
  const results = userIds.map((userId) => sendToUser(userId, message))
  return results.some((result) => result === true)
}

// Broadcast message to all connected users
const broadcastToAll = (message) => {
  let sentCount = 0

  activeConnections.forEach((ws, userId) => {
    if (ws.readyState === WebSocketServer.OPEN) {
      ws.send(JSON.stringify(message))
      sentCount++
    }
  })

  return sentCount
}

// Get count of active connections
const getActiveConnectionsCount = () => {
  return activeConnections.size
}

export { initializeWebSocketServer, sendToUser, broadcastToUsers, broadcastToAll, getActiveConnectionsCount }

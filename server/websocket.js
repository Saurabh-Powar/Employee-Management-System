const WebSocket = require("ws")
const http = require("http")

// Initialize WebSocket server
function initWebSocket(server) {
  const wss = new WebSocket.Server({ server })

  // Store connected clients with their info
  const clients = new Map()

  console.log("WebSocket server initialized")

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress
    console.log(`WebSocket client connected from ${ip}`)

    // Set a ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping()
      }
    }, 30000)

    // Handle client authentication
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message)
        console.log("Received WebSocket message:", data.type)

        // Handle authentication message
        if (data.type === "auth") {
          const { userId, role } = data

          if (userId) {
            // Store client info for targeted messages
            clients.set(ws, { userId, role })
            console.log(`Client authenticated: User ID ${userId}, Role: ${role}`)

            // Send confirmation
            ws.send(
              JSON.stringify({
                type: "auth_success",
                data: { userId, role },
              }),
            )
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    })

    // Handle pong responses
    ws.on("pong", () => {
      // Client is still alive
    })

    // Handle disconnection
    ws.on("close", (code, reason) => {
      clearInterval(pingInterval)
      clients.delete(ws)
      console.log(`WebSocket client disconnected: ${code} ${reason}`)
    })

    // Handle errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error)
      clearInterval(pingInterval)
      clients.delete(ws)
    })
  })

  // Function to broadcast to all clients
  function broadcast(data) {
    const message = JSON.stringify(data)
    let count = 0

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
        count++
      }
    })

    console.log(`Broadcast message sent to ${count} clients`)
  }

  // Function to send to specific user
  function sendToUser(userId, data) {
    const message = JSON.stringify(data)
    let sent = false

    for (const [client, info] of clients.entries()) {
      if (info.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(message)
        sent = true
        console.log(`Message sent to user ${userId}`)
      }
    }

    if (!sent) {
      console.log(`User ${userId} not connected, message not delivered`)
    }

    return sent
  }

  // Function to send to users with specific role
  function sendToRole(role, data) {
    const message = JSON.stringify(data)
    let count = 0

    for (const [client, info] of clients.entries()) {
      if (info.role === role && client.readyState === WebSocket.OPEN) {
        client.send(message)
        count++
      }
    }

    console.log(`Message sent to ${count} users with role ${role}`)
    return count
  }

  // Return the WebSocket server interface
  return {
    broadcast,
    sendToUser,
    sendToRole,
    getConnectedClients: () => clients.size,
  }
}

module.exports = initWebSocket

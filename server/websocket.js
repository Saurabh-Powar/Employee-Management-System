const WebSocket = require("ws")
const http = require("http")

// Initialize WebSocket server
function initWebSocket(server) {
  const wss = new WebSocket.Server({ server })

  // Store connected clients
  const clients = new Map()

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected")

    // Handle client authentication
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message)

        // Handle authentication message
        if (data.type === "auth") {
          const { userId, role } = data

          if (userId) {
            // Store client info for targeted messages
            clients.set(ws, { userId, role })
            console.log(`Client authenticated: User ID ${userId}, Role: ${role}`)

            // Send confirmation
            ws.send(JSON.stringify({ type: "auth_success" }))
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    })

    // Handle disconnection
    ws.on("close", () => {
      clients.delete(ws)
      console.log("WebSocket client disconnected")
    })
  })

  // Function to broadcast to all clients
  function broadcast(data) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data))
      }
    })
  }

  // Function to send to specific user
  function sendToUser(userId, data) {
    for (const [client, info] of clients.entries()) {
      if (info.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data))
      }
    }
  }

  // Function to send to users with specific role
  function sendToRole(role, data) {
    for (const [client, info] of clients.entries()) {
      if (info.role === role && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data))
      }
    }
  }

  return {
    broadcast,
    sendToUser,
    sendToRole,
  }
}

module.exports = initWebSocket

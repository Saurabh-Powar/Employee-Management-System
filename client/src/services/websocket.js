let socket = null;
let reconnectTimer = null;
const reconnectionDelay = 5000; // 5 seconds delay for reconnection attempts

// Initialize WebSocket connection
export const initializeWebSocket = (userId, token) => {
  console.log("Initializing WebSocket with userId:", userId, "and token:", token);

  if (!userId || !token) {
    console.error("WebSocket initialization failed: Missing userId or token");
    return;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.hostname}:5000/ws?userId=${userId}&token=${token}`;
  console.log("WebSocket URL:", wsUrl);

  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Dispatch custom event with the received data
      window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
    
    // Attempt to reconnect unless the connection was closed intentionally
    if (!event.wasClean) {
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        initializeWebSocket(userId, token);
      }, reconnectionDelay);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return socket;
};

// Send message through WebSocket
export const sendWebSocketMessage = (message) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  } else {
    console.error('WebSocket is not connected');
    return false;
  }
};

// Close WebSocket connection
export const closeWebSocket = () => {
  if (socket) {
    socket.close(1000, 'User logged out');
    socket = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

// Check if WebSocket is connected
export const isWebSocketConnected = () => {
  return socket && socket.readyState === WebSocket.OPEN;
};

// Add event listener for WebSocket messages
export const addWebSocketListener = (callback) => {
  const handler = (event) => callback(event.detail);
  window.addEventListener('websocket-message', handler);
  return handler;
};

// Remove event listener for WebSocket messages
export const removeWebSocketListener = (handler) => {
  window.removeEventListener('websocket-message', handler);
};

export const handleLogin = async (userId, password) => {
  try {
    const userData = await login(userId, password);
    setUser(userData);

    // Pass the token and userId to initializeWebSocket
    initializeWebSocket(userData.userId, userData.token);
  } catch (err) {
    console.error("Login error:", err);
  }
};
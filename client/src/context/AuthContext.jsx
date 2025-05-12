import React, { createContext, useState, useEffect, useContext } from 'react';
import { login, logout, checkAuthStatus, refreshUser } from '../services/auth';
import { initializeWebSocket, closeWebSocket, addWebSocketListener, removeWebSocketListener } from '../services/websocket';
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const authData = await checkAuthStatus();
        const { user, token } = authData;
  
        if (user && user.id && token) {
          setUser(user);
  
          // Initialize WebSocket connection
          initializeWebSocket(user.id, token);
        } else {
          console.warn("Missing userId or token in checkAuth response");
        }
      } catch (err) {
        console.error("Auth check error:", err);
        setError("Failed to authenticate");
      } finally {
        setLoading(false);
      }
    };
  
    checkAuth();
  
    return () => {
      if (user) {
        closeWebSocket();
      }
    };
  }, []);

  // Set up WebSocket notification listener when user is logged in
  useEffect(() => {
    if (!user) return;

    const handleWebSocketMessage = (data) => {
      if (data.type === 'notification') {
        setNotifications(prev => [data.notification, ...prev]);
      }
    };

    const wsListener = addWebSocketListener(handleWebSocketMessage);

    return () => {
      removeWebSocketListener(wsListener);
    };
  }, [user]);

 // Login function
const handleLogin = async (email, password) => {
  try {
    setLoading(true);
    setError(null);
    const userData = await login(email, password);
    setUser(userData);

    // Store the token in localStorage
    localStorage.setItem("token", userData.token);

    // Set the default Authorization header
    axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;

    // Initialize WebSocket connection after successful login
    initializeWebSocket(userData.id, userData.token);

    return userData;
  } catch (err) {
    console.error("Login error:", err);
    setError(err.message || "Failed to login");
    throw err;
  } finally {
    setLoading(false);
  }
};

// Logout function
const handleLogout = async () => {
  try {
    setLoading(true);
    await logout();

    // Clear the token from localStorage
    localStorage.removeItem("token");

    // Remove the default Authorization header
    delete axios.defaults.headers.common["Authorization"];

    // Close WebSocket connection
    closeWebSocket();

    setUser(null);
    setNotifications([]);
  } catch (err) {
    console.error("Logout error:", err);
    setError(err.message || "Failed to logout");
  } finally {
    setLoading(false);
  }
};

// Axios interceptor
useEffect(() => {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        console.log("Unauthorized access, redirecting to login");
        localStorage.removeItem("token");
        delete axios.defaults.headers.common["Authorization"];
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  );
}, []);

  // Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };

  // Clear notification
  const clearNotification = (notificationId) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const value = {
    user,
    loading,
    error,
    notifications,
    login: handleLogin,
    logout: handleLogout,
    markNotificationAsRead,
    clearNotification
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
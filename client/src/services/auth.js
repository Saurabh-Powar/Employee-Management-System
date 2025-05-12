import api from "./api"

const authService = {
  // Login user
  login: async (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
  
    try {
      const userResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = userResult.rows[0];
  
      if (!user) {
        console.log(`Login attempt failed: User '${username}' not found`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
  
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log(`Login attempt failed: Incorrect password for user '${username}'`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
  
      const token = generateToken(user);
  
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
  
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed due to session error" });
        }
  
        console.log(`User '${username}' logged in successfully with role: ${user.role}`);
        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
          token,
          message: "Login successful",
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed due to server error", error: error.message });
    }
  },

  // Logout user
  logout: async () => {
    try {
      const response = await api.post("/auth/logout")
      return response.data
    } catch (error) {
      console.error("Logout API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Get current user
  getUser: async () => {
    try {
      const response = await api.get("/auth/user")
      console.log("Get user API response:", response.data)
      return response.data
    } catch (error) {
      console.error("Get user API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },

  // Check authentication status
  checkAuthStatus: async () => {
    try {
      const response = await api.get("/auth/check");
      console.log("Check auth API response:", response.data);
  
      // Ensure the response includes userId and token
      if (!response.data.user || !response.data.user.id || !response.data.token) {
        throw new Error("Invalid auth response: Missing userId or token");
      }
  
      return response.data; // Ensure this includes { user: { id }, token }
    } catch (error) {
      console.error("Check auth API error:", error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Refresh user data
  refreshUser: async () => {
    try {
      const response = await api.get("/auth/refresh")
      console.log("Refresh user API response:", response.data)
      return response.data
    } catch (error) {
      console.error("Refresh user API error:", error.response?.data || error.message)
      throw error.response?.data || error
    }
  },
}

export const login = authService.login;
export const logout = authService.logout;
export const getUser = authService.getUser;
export const checkAuthStatus = authService.checkAuthStatus;
export const refreshUser = authService.refreshUser;

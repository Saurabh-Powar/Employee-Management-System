const bcrypt = require("bcrypt")
const db = require("../db/sql")
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

const authController = {
  // Login user
  login: async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    try {
      // Query the database to get the user details
      const userResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = userResult.rows[0];

      if (!user) {
        console.log(`Login attempt failed: User '${username}' not found`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Compare password with hashed password in the database
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log(`Login attempt failed: Incorrect password for user '${username}'`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = generateToken(user);

      // Store user info in the session, including role for role-based access
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };

      // Save the session explicitly to ensure it's stored before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed due to session error" });
        }

        console.log(`User '${username}' logged in successfully with role: ${user.role}`);

        // Return user data, token, and success message
        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
          token, // Include the token in the response
          message: "Login successful",
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed due to server error", error: error.message });
    }
  },

  // Logout user
  logout: (req, res) => {
    // Destroy the session to log out
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err)
        return res.status(500).json({ message: "Logout failed due to server error", error: err.message })
      }
      // Clear the cookie on the client side
      res.clearCookie("connect.sid", { path: "/" })
      res.json({ message: "Logged out successfully" })
    })
  },

  // Get the logged-in user's information
  getUser: (req, res) => {
    // Check if the user is authenticated (session-based check)
    if (req.session.user) {
      console.log("Get user: User is authenticated", req.session.user)
      return res.json({ user: req.session.user })
    } else {
      console.log("Get user: User is not authenticated")
      return res.status(401).json({ message: "Not authenticated" })
    }
  },

  // Check if the user is authenticated and return user info
  checkAuth: (req, res) => {
    // This is an endpoint to verify if the user is authenticated
    if (req.session.user) {
      console.log("Check auth: User is authenticated", req.session.user)
      res.json({ message: "Authenticated", user: req.session.user })
    } else {
      console.log("Check auth: User is not authenticated")
      res.status(401).json({ message: "Not authenticated" })
    }
  },

  refreshUser: (req, res) => {
    if (req.session.user) {
      console.log("Refresh user: User is authenticated", req.session.user)
      return res.json({ user: req.session.user })
    } else {
      console.log("Refresh user: User is not authenticated")
      return res.status(401).json({ message: "Not authenticated" })
    }
  },
}
module.exports = authController

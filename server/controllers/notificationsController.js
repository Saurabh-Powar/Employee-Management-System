const db = require("../db/sql")

const notificationsController = {
  // Get all notifications for the currently logged-in user
  getUserNotifications: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ message: "User not logged in" })
    }

    try {
      // Get notifications with sender details
      const result = await db.query(
        `
        SELECT n.*, 
               CASE 
                 WHEN n.sender_id IS NOT NULL THEN 
                   (SELECT CONCAT(e.first_name, ' ', e.last_name) 
                    FROM employees e 
                    JOIN users u ON e.user_id = u.id 
                    WHERE u.id = n.sender_id)
                 ELSE 'System'
               END as sender_name,
               CASE 
                 WHEN n.sender_id IS NOT NULL THEN 
                   (SELECT u.role 
                    FROM users u 
                    WHERE u.id = n.sender_id)
                 ELSE 'system'
               END as sender_role
        FROM notifications n
        WHERE n.user_id = $1 
        ORDER BY n.created_at DESC
      `,
        [sessionUser.id],
      )

      return res.status(200).json(result.rows)
    } catch (error) {
      console.error("Error fetching user notifications:", error)
      return res.status(500).json({
        message: "Failed to fetch user notifications",
        details: error.message,
      })
    }
  },

  // Create a new notification (for system use or managers)
  createNotification: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser || sessionUser.role !== "manager") {
      return res.status(403).json({
        message: "Unauthorized access",
        details: "Only managers can create notifications.",
      })
    }

    const { user_id, title, message, type } = req.body

    if (!user_id || !title || !message || !type) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Validate user_id (ensure the user exists in the system)
    try {
      const userCheck = await db.query("SELECT id FROM users WHERE id = $1", [user_id])
      if (userCheck.rowCount === 0) {
        return res.status(404).json({
          message: "User not found",
          details: "The specified user_id does not exist.",
        })
      }

      const result = await db.query(
        "INSERT INTO notifications (user_id, sender_id, title, message, type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [user_id, sessionUser.id, title, message, type],
      )
      return res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error creating notification:", error)
      return res.status(500).json({
        message: "Failed to create notification",
        details: error.message,
      })
    }
  },

  // Mark a notification as read (only if the user owns it)
  markNotificationAsRead: async (req, res) => {
    const { id } = req.params
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ message: "User not logged in" })
    }

    try {
      const notificationCheck = await db.query("SELECT * FROM notifications WHERE id = $1", [id])
      const notification = notificationCheck.rows[0]

      if (!notification || notification.user_id !== sessionUser.id) {
        return res.status(403).json({
          message: "Unauthorized to modify this notification",
          details: "You can only modify your own notifications.",
        })
      }

      const result = await db.query("UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *", [id])
      return res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error marking notification as read:", error)
      return res.status(500).json({
        message: "Failed to mark notification as read",
        details: error.message,
      })
    }
  },

  // Mark all notifications as read
  markAllNotificationsAsRead: async (req, res) => {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ message: "User not logged in" })
    }

    try {
      const result = await db.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 RETURNING *", [
        sessionUser.id,
      ])
      return res.status(200).json({
        message: "All notifications marked as read",
        count: result.rowCount,
      })
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      return res.status(500).json({
        message: "Failed to mark all notifications as read",
        details: error.message,
      })
    }
  },

  // Mark a notification as unread (optional, based on your requirements)
  markNotificationAsUnread: async (req, res) => {
    const { id } = req.params
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ message: "User not logged in" })
    }

    try {
      const notificationCheck = await db.query("SELECT * FROM notifications WHERE id = $1", [id])
      const notification = notificationCheck.rows[0]

      if (!notification || notification.user_id !== sessionUser.id) {
        return res.status(403).json({
          message: "Unauthorized to modify this notification",
          details: "You can only modify your own notifications.",
        })
      }

      const result = await db.query("UPDATE notifications SET is_read = FALSE WHERE id = $1 RETURNING *", [id])
      return res.status(200).json(result.rows[0])
    } catch (error) {
      console.error("Error marking notification as unread:", error)
      return res.status(500).json({
        message: "Failed to mark notification as unread",
        details: error.message,
      })
    }
  },
}

module.exports = notificationsController

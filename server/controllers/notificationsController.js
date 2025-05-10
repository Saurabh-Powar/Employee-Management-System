const pool = require('../db/sql');
const { io } = require('../websocket');

// Notification type mapping between UI and database
const TYPE_MAPPING = {
  // UI to DB mapping
  'success': 'task_update',      // Map UI type to allowed DB type
  'warning': 'attendance_alert',
  'info': 'general',
  'error': 'system_alert',
  
  // DB to UI mapping (reverse)
  'task_update': 'success',
  'attendance_alert': 'warning',
  'general': 'info',
  'system_alert': 'error'
};

// Map UI type to DB type
const mapToDbType = (uiType) => {
  return TYPE_MAPPING[uiType] || uiType;
};

// Map DB type to UI type
const mapToUiType = (dbType) => {
  // Find the UI type that maps to this DB type
  for (const [uiType, mappedDbType] of Object.entries(TYPE_MAPPING)) {
    if (mappedDbType === dbType) {
      return uiType;
    }
  }
  return dbType; // Default to the same if no mapping exists
};

// Get all notifications for an employee
const getEmployeeNotifications = async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT n.*, e.name as sender_name FROM notifications n LEFT JOIN employees e ON n.sender_id = e.id WHERE n.employee_id = $1 ORDER BY n.created_at DESC',
      [employeeId]
    );
    
    // Map DB types to UI types
    const notificationsWithUiType = result.rows.map(notification => ({
      ...notification,
      ui_type: mapToUiType(notification.type),
      type: notification.type // Keep the original DB type
    }));
    
    res.json(notificationsWithUiType);
  } catch (error) {
    console.error(`Error fetching notifications for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Create a new notification
const createNotification = async (req, res) => {
  const { employee_id, sender_id, title, message, type } = req.body;
  
  try {
    // Map UI type to allowed DB type
    const dbType = mapToDbType(type);
    
    const result = await pool.query(
      'INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [employee_id, sender_id, title, message, dbType, false]
    );
    
    const newNotification = {
      ...result.rows[0],
      ui_type: type // Use the original UI type
    };
    
    // Emit WebSocket event
    io.emit('notification', { 
      employee_id, 
      type: dbType, 
      message,
      notification: newNotification
    });
    
    res.status(201).json(newNotification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  const { notificationId } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [notificationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const updatedNotification = {
      ...result.rows[0],
      ui_type: mapToUiType(result.rows[0].type)
    };
    
    res.json(updatedNotification);
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read:`, error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read for an employee
const markAllAsRead = async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE employee_id = $1',
      [employeeId]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error(`Error marking all notifications as read for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  const { notificationId } = req.params;
  
  try {
    await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error(`Error deleting notification ${notificationId}:`, error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Get unread notification count for an employee
const getUnreadCount = async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE employee_id = $1 AND is_read = false',
      [employeeId]
    );
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error(`Error fetching unread notification count for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
};

module.exports = {
  getEmployeeNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
};

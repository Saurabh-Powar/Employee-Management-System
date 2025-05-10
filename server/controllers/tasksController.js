const pool = require('../db/sql');
const { io } = require('../websocket');

// Status mapping between UI and database
const STATUS_MAPPING = {
  // UI to DB mapping
  'pending': 'pending',
  'in_progress': 'in_progress',
  'pending_completion': 'in_review', // Map UI status to allowed DB status
  'completed': 'completed',
  'cancelled': 'cancelled',
  
  // DB to UI mapping (reverse)
  'in_review': 'pending_completion'
};

// Map UI status to DB status
const mapToDbStatus = (uiStatus) => {
  return STATUS_MAPPING[uiStatus] || uiStatus;
};

// Map DB status to UI status
const mapToUiStatus = (dbStatus) => {
  // Find the UI status that maps to this DB status
  for (const [uiStatus, mappedDbStatus] of Object.entries(STATUS_MAPPING)) {
    if (mappedDbStatus === dbStatus) {
      return uiStatus;
    }
  }
  return dbStatus; // Default to the same if no mapping exists
};

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY due_date ASC');
    
    // Map DB statuses to UI statuses
    const tasksWithUiStatus = result.rows.map(task => ({
      ...task,
      ui_status: mapToUiStatus(task.status),
      status: task.status // Keep the original DB status
    }));
    
    res.json(tasksWithUiStatus);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// Get tasks by employee ID
const getEmployeeTasks = async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY due_date ASC',
      [employeeId]
    );
    
    // Map DB statuses to UI statuses
    const tasksWithUiStatus = result.rows.map(task => ({
      ...task,
      ui_status: mapToUiStatus(task.status),
      status: task.status // Keep the original DB status
    }));
    
    res.json(tasksWithUiStatus);
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch employee tasks' });
  }
};

// Get tasks by manager ID
const getManagerTasks = async (req, res) => {
  const { managerId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT t.*, e.name as employee_name FROM tasks t JOIN employees e ON t.assigned_to = e.id WHERE t.created_by = $1 ORDER BY t.due_date ASC',
      [managerId]
    );
    
    // Map DB statuses to UI statuses
    const tasksWithUiStatus = result.rows.map(task => ({
      ...task,
      ui_status: mapToUiStatus(task.status),
      status: task.status // Keep the original DB status
    }));
    
    res.json(tasksWithUiStatus);
  } catch (error) {
    console.error(`Error fetching tasks for manager ${managerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch manager tasks' });
  }
};

// Create a new task
const createTask = async (req, res) => {
  const { title, description, priority, due_date, assigned_to, created_by, estimated_hours } = req.body;
  
  try {
    // Default status is 'pending'
    const dbStatus = 'pending';
    
    const result = await pool.query(
      'INSERT INTO tasks (assigned_to, title, description, priority, due_date, status, created_by, estimated_hours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [assigned_to, title, description, priority, due_date, dbStatus, created_by, estimated_hours]
    );
    
    const newTask = {
      ...result.rows[0],
      ui_status: mapToUiStatus(result.rows[0].status)
    };
    
    // Create notification for the assigned employee
    await pool.query(
      'INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
      [assigned_to, created_by, 'New Task Assigned', `You have been assigned a new task: "${title}"`, 'task', false]
    );
    
    // Emit WebSocket event
    io.emit('task-created', newTask);
    io.emit('notification', { employee_id: assigned_to, type: 'task', message: `New task assigned: ${title}` });
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status, employee_id } = req.body;
  
  try {
    // Map UI status to allowed DB status
    const dbStatus = mapToDbStatus(status);
    
    console.log(`Updating task ${taskId} status from UI: ${status} to DB: ${dbStatus}`);
    
    const result = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [dbStatus, taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const updatedTask = {
      ...result.rows[0],
      ui_status: status // Use the original UI status
    };
    
    // Get task details for notification
    const taskDetails = await pool.query('SELECT title, assigned_to, created_by FROM tasks WHERE id = $1', [taskId]);
    const { title, assigned_to, created_by } = taskDetails.rows[0];
    
    // Determine notification recipient and message based on status
    let recipientId, senderId, notificationTitle, message, notificationType;
    
    if (status === 'pending_completion') {
      // Employee requesting completion approval
      recipientId = created_by; // Notify the manager
      senderId = assigned_to;
      notificationTitle = 'Task Completion Request';
      message = `Employee has requested approval for task completion: "${title}"`;
      notificationType = 'task_approval';
    } else if (status === 'completed') {
      // Manager approved completion or task marked as completed
      recipientId = assigned_to; // Notify the employee
      senderId = employee_id || created_by;
      notificationTitle = 'Task Completed';
      message = `Your task "${title}" has been marked as completed`;
      notificationType = 'task_update';
    } else {
      // Other status updates
      recipientId = assigned_to; // Notify the employee
      senderId = employee_id || created_by;
      notificationTitle = 'Task Status Updated';
      message = `Your task "${title}" status has been updated to ${status.replace('_', ' ')}`;
      notificationType = 'task_update';
    }
    
    // Create notification
    await pool.query(
      'INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
      [recipientId, senderId, notificationTitle, message, notificationType, false]
    );
    
    // Emit WebSocket events
    io.emit('task-updated', updatedTask);
    io.emit('notification', { 
      employee_id: recipientId, 
      type: notificationType, 
      message: message 
    });
    
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
};

// Update task details
const updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, priority, due_date, assigned_to, status, estimated_hours } = req.body;
  
  try {
    // Map UI status to allowed DB status if status is provided
    const dbStatus = status ? mapToDbStatus(status) : undefined;
    
    const result = await pool.query(
      'UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description), priority = COALESCE($3, priority), due_date = COALESCE($4, due_date), assigned_to = COALESCE($5, assigned_to), status = COALESCE($6, status), estimated_hours = COALESCE($7, estimated_hours), updated_at = NOW() WHERE id = $8 RETURNING *',
      [title, description, priority, due_date, assigned_to, dbStatus, estimated_hours, taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const updatedTask = {
      ...result.rows[0],
      ui_status: mapToUiStatus(result.rows[0].status)
    };
    
    // Create notification for task update
    if (assigned_to) {
      await pool.query(
        'INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
        [assigned_to, req.user.id, 'Task Updated', `Your task "${title}" has been updated`, 'task_update', false]
      );
      
      // Emit WebSocket events
      io.emit('task-updated', updatedTask);
      io.emit('notification', { 
        employee_id: assigned_to, 
        type: 'task_update', 
        message: `Task updated: ${title}` 
      });
    }
    
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  const { taskId } = req.params;
  
  try {
    // Get task details before deletion for notification
    const taskDetails = await pool.query('SELECT title, assigned_to FROM tasks WHERE id = $1', [taskId]);
    
    if (taskDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const { title, assigned_to } = taskDetails.rows[0];
    
    // Delete the task
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    
    // Create notification for task deletion
    await pool.query(
      'INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
      [assigned_to, req.user.id, 'Task Deleted', `The task "${title}" has been deleted`, 'task_update', false]
    );
    
    // Emit WebSocket events
    io.emit('task-deleted', { id: taskId });
    io.emit('notification', { 
      employee_id: assigned_to, 
      type: 'task_update', 
      message: `Task deleted: ${title}` 
    });
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// Get task by ID
const getTaskById = async (req, res) => {
  const { taskId } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = {
      ...result.rows[0],
      ui_status: mapToUiStatus(result.rows[0].status)
    };
    
    res.json(task);
  } catch (error) {
    console.error(`Error fetching task ${taskId}:`, error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

// Export all controller functions
module.exports = {
  getAllTasks,
  getEmployeeTasks,
  getManagerTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask,
  getTaskById
};

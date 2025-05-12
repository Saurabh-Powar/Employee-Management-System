const sql = require('../db/sql');
const { sendNotification } = require('./notificationsController');
const { broadcastToUsers } = require('../websocket');

// Get all tasks
exports.getAllTasks = async (req, res) => {
    try {
        const result = await sql`
            SELECT t.*, e.first_name, e.last_name 
            FROM tasks t
            LEFT JOIN employees e ON t.employee_id = e.id
            ORDER BY t.due_date ASC
        `;
        res.json(result);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
    }
};

// Get tasks by employee ID
exports.getTasksByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    
    try {
        const result = await sql`
            SELECT * FROM tasks 
            WHERE employee_id = ${employeeId}
            ORDER BY due_date ASC
        `;
        res.json(result);
    } catch (error) {
        console.error(`Error fetching tasks for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
    }
};

// Get task by ID
exports.getTaskById = async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await sql`
            SELECT t.*, e.first_name, e.last_name 
            FROM tasks t
            LEFT JOIN employees e ON t.employee_id = e.id
            WHERE t.id = ${id}
        `;
        
        if (result.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(result[0]);
    } catch (error) {
        console.error(`Error fetching task ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch task', error: error.message });
    }
};

// Create new task
exports.createTask = async (req, res) => {
    const { title, description, employee_id, due_date, priority, status } = req.body;
    
    try {
        // Validate required fields
        if (!title || !employee_id || !due_date) {
            return res.status(400).json({ message: 'Title, employee ID, and due date are required' });
        }
        
        const result = await sql`
            INSERT INTO tasks (title, description, employee_id, due_date, priority, status, created_at)
            VALUES (${title}, ${description}, ${employee_id}, ${due_date}, ${priority}, ${status || 'pending'}, NOW())
            RETURNING *
        `;
        
        // Send notification to the employee
        await sendNotification({
            user_id: employee_id,
            type: 'task_assigned',
            message: `You have been assigned a new task: ${title}`,
            related_id: result[0].id,
            created_at: new Date()
        });
        
        // Broadcast task update via WebSocket
        broadcastToUsers([employee_id], {
            type: 'task_update',
            action: 'created',
            task: result[0]
        });
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Failed to create task', error: error.message });
    }
};

// Update task
exports.updateTask = async (req, res) => {
    const { id } = req.params;
    const { title, description, employee_id, due_date, priority, status } = req.body;
    
    try {
        // Get the current task to check if employee has changed
        const currentTask = await sql`SELECT * FROM tasks WHERE id = ${id}`;
        
        if (currentTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        const result = await sql`
            UPDATE tasks
            SET 
                title = ${title || currentTask[0].title},
                description = ${description !== undefined ? description : currentTask[0].description},
                employee_id = ${employee_id || currentTask[0].employee_id},
                due_date = ${due_date || currentTask[0].due_date},
                priority = ${priority || currentTask[0].priority},
                status = ${status || currentTask[0].status},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `;
        
        // If employee has changed, notify the new employee
        if (employee_id && employee_id !== currentTask[0].employee_id) {
            await sendNotification({
                user_id: employee_id,
                type: 'task_assigned',
                message: `You have been assigned a task: ${result[0].title}`,
                related_id: result[0].id,
                created_at: new Date()
            });
            
            // Broadcast to both old and new employees
            broadcastToUsers([currentTask[0].employee_id, employee_id], {
                type: 'task_update',
                action: 'updated',
                task: result[0]
            });
        } else {
            // Broadcast to the current employee
            broadcastToUsers([currentTask[0].employee_id], {
                type: 'task_update',
                action: 'updated',
                task: result[0]
            });
        }
        
        res.json(result[0]);
    } catch (error) {
        console.error(`Error updating task ${id}:`, error);
        res.status(500).json({ message: 'Failed to update task', error: error.message });
    }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
    const { id } = req.params;
    const { status, completion_notes } = req.body;
    
    try {
        // Validate status
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }
        
        // Get the current task
        const currentTask = await sql`SELECT * FROM tasks WHERE id = ${id}`;
        
        if (currentTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        const result = await sql`
            UPDATE tasks
            SET 
                status = ${status},
                completion_notes = ${completion_notes || currentTask[0].completion_notes},
                completed_at = ${status === 'completed' ? new Date() : null},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `;
        
        // If task is completed, notify manager
        if (status === 'completed') {
            // Get the employee's manager
            const managerQuery = await sql`
                SELECT m.id 
                FROM employees e
                JOIN employees m ON e.manager_id = m.id
                WHERE e.id = ${currentTask[0].employee_id}
            `;
            
            if (managerQuery.length > 0) {
                const managerId = managerQuery[0].id;
                
                await sendNotification({
                    user_id: managerId,
                    type: 'task_completed',
                    message: `Task "${result[0].title}" has been completed`,
                    related_id: result[0].id,
                    created_at: new Date()
                });
                
                // Broadcast to manager
                broadcastToUsers([managerId], {
                    type: 'task_update',
                    action: 'completed',
                    task: result[0]
                });
            }
        }
        
        // Broadcast to the employee
        broadcastToUsers([currentTask[0].employee_id], {
            type: 'task_update',
            action: 'status_updated',
            task: result[0]
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error(`Error updating task status ${id}:`, error);
        res.status(500).json({ message: 'Failed to update task status', error: error.message });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get the task to be deleted
        const taskToDelete = await sql`SELECT * FROM tasks WHERE id = ${id}`;
        
        if (taskToDelete.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        await sql`DELETE FROM tasks WHERE id = ${id}`;
        
        // Notify the employee
        await sendNotification({
            user_id: taskToDelete[0].employee_id,
            type: 'task_deleted',
            message: `Task "${taskToDelete[0].title}" has been deleted`,
            created_at: new Date()
        });
        
        // Broadcast to the employee
        broadcastToUsers([taskToDelete[0].employee_id], {
            type: 'task_update',
            action: 'deleted',
            taskId: id
        });
        
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error(`Error deleting task ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete task', error: error.message });
    }
};

// Get task statistics
exports.getTaskStatistics = async (req, res) => {
    try {
        const result = await sql`
            SELECT 
                COUNT(*) AS total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_tasks,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_tasks,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress_tasks,
                COUNT(CASE WHEN due_date < NOW() AND status != 'completed' THEN 1 END) AS overdue_tasks
            FROM tasks
        `;
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error fetching task statistics:', error);
        res.status(500).json({ message: 'Failed to fetch task statistics', error: error.message });
    }
};

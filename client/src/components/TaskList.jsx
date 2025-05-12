import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchTasks, updateTaskStatus } from '../services/api';
import { addWebSocketListener, removeWebSocketListener } from '../services/websocket';
import './TaskListS.css';

const TaskList = ({ employeeId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const { user } = useAuth();

  // Fetch tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = employeeId ? `/tasks/employee/${employeeId}` : '/tasks';
      const tasksData = await fetchTasks(endpoint);
      setTasks(tasksData);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // WebSocket listener for real-time updates
  useEffect(() => {
    const handleTaskUpdate = (data) => {
      if (data.type === 'task_update') {
        switch (data.action) {
          case 'created':
            // Add new task if it belongs to the current view
            if (!employeeId || data.task.employee_id === employeeId) {
              setTasks(prevTasks => [data.task, ...prevTasks]);
            }
            break;
          
          case 'updated':
          case 'status_updated':
            // Update existing task
            setTasks(prevTasks => 
              prevTasks.map(task => 
                task.id === data.task.id ? data.task : task
              )
            );
            break;
          
          case 'deleted':
            // Remove deleted task
            setTasks(prevTasks => 
              prevTasks.filter(task => task.id !== data.taskId)
            );
            break;
          
          default:
            // Reload all tasks for other updates
            loadTasks();
            break;
        }
      }
    };

    // Add WebSocket listener
    const wsListener = addWebSocketListener(handleTaskUpdate);

    // Cleanup
    return () => {
      removeWebSocketListener(wsListener);
    };
  }, [employeeId, loadTasks]);

  // Toggle task details
  const toggleTaskDetails = (taskId) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  // Handle status change
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, { status: newStatus });
      
      // Update local state (WebSocket will handle the real update)
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus, completed_at: newStatus === 'completed' ? new Date() : null } 
            : task
        )
      );
    } catch (err) {
      console.error('Error updating task status:', err);
      setError('Failed to update task status. Please try again.');
    }
  };

  // Get status class
  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'in_progress': return 'status-in-progress';
      case 'pending': return 'status-pending';
      default: return '';
    }
  };

  // Get priority class
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if task is overdue
  const isOverdue = (dueDate, status) => {
    return status !== 'completed' && new Date(dueDate) < new Date();
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (tasks.length === 0) {
    return <div className="no-tasks">No tasks found.</div>;
  }

  return (
    <div className="task-list-container">
      <h2>Tasks {employeeId ? 'Assigned to Employee' : ''}</h2>
      
      <div className="task-list">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`task-item ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}
          >
            <div className="task-header" onClick={() => toggleTaskDetails(task.id)}>
              <div className="task-title">{task.title}</div>
              <div className={`task-status ${getStatusClass(task.status)}`}>
                {task.status.replace('_', ' ')}
              </div>
            </div>
            
            <div className="task-meta">
              <div className={`task-priority ${getPriorityClass(task.priority)}`}>
                {task.priority || 'Normal'}
              </div>
              <div className="task-due-date">
                Due: {formatDate(task.due_date)}
              </div>
            </div>
            
            {expandedTaskId === task.id && (
              <div className="task-details">
                <div className="task-description">
                  <strong>Description:</strong> {task.description || 'No description provided.'}
                </div>
                
                {task.completion_notes && (
                  <div className="task-completion-notes">
                    <strong>Completion Notes:</strong> {task.completion_notes}
                  </div>
                )}
                
                {task.completed_at && (
                  <div className="task-completed-at">
                    <strong>Completed:</strong> {formatDate(task.completed_at)}
                  </div>
                )}
                
                {!employeeId && task.first_name && task.last_name && (
                  <div className="task-assigned-to">
                    <strong>Assigned to:</strong> {task.first_name} {task.last_name}
                  </div>
                )}
                
                {(user.role === 'employee' || !employeeId) && (
                  <div className="task-actions">
                    {task.status !== 'pending' && (
                      <button 
                        className="btn-status pending"
                        onClick={() => handleStatusChange(task.id, 'pending')}
                      >
                        Mark as Pending
                      </button>
                    )}
                    
                    {task.status !== 'in_progress' && (
                      <button 
                        className="btn-status in-progress"
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                      >
                        Mark as In Progress
                      </button>
                    )}
                    
                    {task.status !== 'completed' && (
                      <button 
                        className="btn-status completed"
                        onClick={() => handleStatusChange(task.id, 'completed')}
                      >
                        Mark as Completed
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;

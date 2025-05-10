const pool = require('../db/sql');
const { io } = require('../websocket');
const { calculateWorkHours, isLate, calculateOvertime } = require('../utils/attendanceUtils');

// Get all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, e.name as employee_name 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      ORDER BY a.date DESC, a.check_in_time DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
};

// Get attendance records for a specific employee
const getEmployeeAttendance = async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT * FROM attendance 
      WHERE employee_id = $1 
      ORDER BY date DESC, check_in_time DESC
    `, [employeeId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching attendance for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch employee attendance' });
  }
};

// Get attendance records for a date range
const getAttendanceByDateRange = async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT a.*, e.name as employee_name 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE a.date BETWEEN $1 AND $2 
      ORDER BY a.date DESC, a.check_in_time DESC
    `, [startDate, endDate]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching attendance for date range ${startDate} to ${endDate}:`, error);
    res.status(500).json({ error: 'Failed to fetch attendance for date range' });
  }
};

// Get today's attendance status for an employee
const getTodayStatus = async (req, res) => {
  const { employeeId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const result = await pool.query(`
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
    `, [employeeId, today]);
    
    if (result.rows.length === 0) {
      return res.json({ 
        checked_in: false, 
        checked_out: false,
        date: today
      });
    }
    
    const attendance = result.rows[0];
    res.json({
      id: attendance.id,
      checked_in: true,
      checked_out: attendance.check_out_time !== null,
      check_in_time: attendance.check_in_time,
      check_out_time: attendance.check_out_time,
      date: attendance.date,
      work_hours: attendance.work_hours
    });
  } catch (error) {
    console.error(`Error fetching today's attendance for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch today\'s attendance status' });
  }
};

// Create a new attendance record
const createAttendance = async (req, res) => {
  const { employee_id, date, check_in_time, check_out_time, work_hours, status } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO attendance (employee_id, date, check_in_time, check_out_time, work_hours, status) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `, [employee_id, date, check_in_time, check_out_time, work_hours, status]);
    
    const newAttendance = result.rows[0];
    
    // Emit WebSocket event
    io.emit('attendance-created', newAttendance);
    
    res.status(201).json(newAttendance);
  } catch (error) {
    console.error('Error creating attendance record:', error);
    res.status(500).json({ error: 'Failed to create attendance record' });
  }
};

// Check in
const checkIn = async (req, res) => {
  const { employee_id } = req.body;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  try {
    // Check if already checked in today
    const existingCheck = await pool.query(`
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
    `, [employee_id, today]);
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in today' });
    }
    
    // Get employee's shift
    const shiftResult = await pool.query(`
      SELECT * FROM shifts 
      WHERE employee_id = $1
    `, [employee_id]);
    
    let status = 'present';
    let isLateCheckIn = false;
    
    // Check if employee is late
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0];
      const [shiftHours, shiftMinutes] = shift.start_time.split(':').map(Number);
      
      const shiftStart = new Date();
      shiftStart.setHours(shiftHours, shiftMinutes, 0, 0);
      
      // If more than 15 minutes late
      if (now - shiftStart > 15 * 60 * 1000) {
        status = 'late';
        isLateCheckIn = true;
      }
    }
    
    // Create attendance record
    const result = await pool.query(`
      INSERT INTO attendance (employee_id, date, check_in_time, status) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [employee_id, today, now, status]);
    
    const newAttendance = result.rows[0];
    
    // Create notification if late
    if (isLateCheckIn) {
      await pool.query(`
        INSERT INTO notifications (employee_id, title, message, type, is_read) 
        VALUES ($1, $2, $3, $4, $5)
      `, [
        employee_id, 
        'Late Check-in', 
        `You checked in late today at ${now.toLocaleTimeString()}. This may affect your attendance record.`,
        'attendance_alert',
        false
      ]);
      
      // Also notify manager
      const employeeData = await pool.query('SELECT department_id FROM employees WHERE id = $1', [employee_id]);
      if (employeeData.rows.length > 0) {
        const departmentId = employeeData.rows[0].department_id;
        
        // Find manager of this department
        const managerData = await pool.query(`
          SELECT e.id FROM employees e 
          WHERE e.role = 'manager' AND e.department_id = $1
        `, [departmentId]);
        
        if (managerData.rows.length > 0) {
          const managerId = managerData.rows[0].id;
          
          await pool.query(`
            INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) 
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            managerId,
            employee_id,
            'Employee Late Check-in',
            `An employee has checked in late today at ${now.toLocaleTimeString()}.`,
            'attendance_alert',
            false
          ]);
        }
      }
    }
    
    // Emit WebSocket event
    io.emit('attendance-updated', {
      employee_id,
      action: 'check-in',
      attendance: newAttendance
    });
    
    res.status(201).json({
      id: newAttendance.id,
      checked_in: true,
      checked_out: false,
      check_in_time: newAttendance.check_in_time,
      date: newAttendance.date,
      status: newAttendance.status
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

// Check out
const checkOut = async (req, res) => {
  const { employee_id } = req.body;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  try {
    // Find today's attendance record
    const attendanceResult = await pool.query(`
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
    `, [employee_id, today]);
    
    if (attendanceResult.rows.length === 0) {
      return res.status(400).json({ error: 'No check-in record found for today' });
    }
    
    const attendance = attendanceResult.rows[0];
    
    if (attendance.check_out_time) {
      return res.status(400).json({ error: 'Already checked out today' });
    }
    
    // Calculate work hours
    const checkInTime = new Date(attendance.check_in_time);
    const workHours = (now - checkInTime) / (1000 * 60 * 60);
    const roundedWorkHours = Math.round(workHours * 100) / 100; // Round to 2 decimal places
    
    // Get employee's shift
    const shiftResult = await pool.query(`
      SELECT * FROM shifts 
      WHERE employee_id = $1
    `, [employee_id]);
    
    let overtimeHours = 0;
    
    // Check if employee worked overtime
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0];
      const [endHours, endMinutes] = shift.end_time.split(':').map(Number);
      
      const shiftEnd = new Date();
      shiftEnd.setHours(endHours, endMinutes, 0, 0);
      
      // If checked out after shift end
      if (now > shiftEnd) {
        overtimeHours = (now - shiftEnd) / (1000 * 60 * 60);
        overtimeHours = Math.round(overtimeHours * 100) / 100; // Round to 2 decimal places
        
        // Only count as overtime if more than 30 minutes
        if (overtimeHours > 0.5) {
          // Create notification for overtime
          await pool.query(`
            INSERT INTO notifications (employee_id, title, message, type, is_read) 
            VALUES ($1, $2, $3, $4, $5)
          `, [
            employee_id, 
            'Overtime Worked', 
            `You worked ${overtimeHours.toFixed(2)} hours of overtime today.`,
            'attendance_alert',
            false
          ]);
          
          // Also notify manager
          const employeeData = await pool.query('SELECT department_id FROM employees WHERE id = $1', [employee_id]);
          if (employeeData.rows.length > 0) {
            const departmentId = employeeData.rows[0].department_id;
            
            // Find manager of this department
            const managerData = await pool.query(`
              SELECT e.id FROM employees e 
              WHERE e.role = 'manager' AND e.department_id = $1
            `, [departmentId]);
            
            if (managerData.rows.length > 0) {
              const managerId = managerData.rows[0].id;
              
              await pool.query(`
                INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) 
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                managerId,
                employee_id,
                'Employee Overtime',
                `An employee worked ${overtimeHours.toFixed(2)} hours of overtime today.`,
                'attendance_alert',
                false
              ]);
            }
          }
        }
      }
    }
    
    // Update attendance record with check-out time and work hours
    const result = await pool.query(`
      UPDATE attendance 
      SET check_out_time = $1, work_hours = $2, overtime_hours = $3
      WHERE id = $4 
      RETURNING *
    `, [now, roundedWorkHours, overtimeHours > 0.5 ? overtimeHours : 0, attendance.id]);
    
    const updatedAttendance = result.rows[0];
    
    // Update salary information if needed
    if (attendance.status === 'late' || overtimeHours > 0.5) {
      // Get employee's salary info
      const salaryResult = await pool.query(`
        SELECT * FROM salaries 
        WHERE employee_id = $1
      `, [employee_id]);
      
      if (salaryResult.rows.length > 0) {
        const salary = salaryResult.rows[0];
        const hourlyRate = salary.base_salary / (22 * 8); // Assuming 22 working days per month and 8 hours per day
        
        let deduction = 0;
        let addition = 0;
        
        // Calculate deduction for late check-in
        if (attendance.status === 'late') {
          // Deduct 25% of hourly rate for being late
          deduction = hourlyRate * 0.25;
        }
        
        // Calculate addition for overtime
        if (overtimeHours > 0.5) {
          // Add 150% of hourly rate for overtime
          addition = overtimeHours * hourlyRate * 1.5;
        }
        
        // Update salary adjustments
        await pool.query(`
          INSERT INTO salary_adjustments (employee_id, date, amount, reason, type)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          employee_id,
          today,
          deduction > 0 ? -deduction : addition,
          deduction > 0 ? 'Late check-in deduction' : 'Overtime payment',
          deduction > 0 ? 'deduction' : 'addition'
        ]);
      }
    }
    
    // Emit WebSocket event
    io.emit('attendance-updated', {
      employee_id,
      action: 'check-out',
      attendance: updatedAttendance
    });
    
    res.json({
      id: updatedAttendance.id,
      checked_in: true,
      checked_out: true,
      check_in_time: updatedAttendance.check_in_time,
      check_out_time: updatedAttendance.check_out_time,
      date: updatedAttendance.date,
      work_hours: updatedAttendance.work_hours,
      overtime_hours: updatedAttendance.overtime_hours
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

// Get employee attendance statistics
const getEmployeeStats = async (req, res) => {
  const { employeeId } = req.params;
  const { startDate, endDate } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        SUM(work_hours) as total_hours,
        SUM(overtime_hours) as total_overtime
      FROM attendance 
      WHERE employee_id = $1 
      AND date BETWEEN $2 AND $3
    `, [employeeId, startDate, endDate]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching attendance stats for employee ${employeeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
};

// Update attendance record
const updateAttendance = async (req, res) => {
  const { attendanceId } = req.params;
  const { check_in_time, check_out_time, work_hours, status } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE attendance 
      SET 
        check_in_time = COALESCE($1, check_in_time),
        check_out_time = COALESCE($2, check_out_time),
        work_hours = COALESCE($3, work_hours),
        status = COALESCE($4, status)
      WHERE id = $5 
      RETURNING *
    `, [check_in_time, check_out_time, work_hours, status, attendanceId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const updatedAttendance = result.rows[0];
    
    // Emit WebSocket event
    io.emit('attendance-updated', {
      employee_id: updatedAttendance.employee_id,
      action: 'update',
      attendance: updatedAttendance
    });
    
    res.json(updatedAttendance);
  } catch (error) {
    console.error(`Error updating attendance record ${attendanceId}:`, error);
    res.status(500).json({ error: 'Failed to update attendance record' });
  }
};

// Delete attendance record
const deleteAttendance = async (req, res) => {
  const { attendanceId } = req.params;
  
  try {
    // Get employee_id before deletion for WebSocket event
    const employeeResult = await pool.query('SELECT employee_id FROM attendance WHERE id = $1', [attendanceId]);
    
    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const employeeId = employeeResult.rows[0].employee_id;
    
    await pool.query('DELETE FROM attendance WHERE id = $1', [attendanceId]);
    
    // Emit WebSocket event
    io.emit('attendance-updated', {
      employee_id: employeeId,
      action: 'delete',
      attendance_id: attendanceId
    });
    
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error(`Error deleting attendance record ${attendanceId}:`, error);
    res.status(500).json({ error: 'Failed to delete attendance record' });
  }
};

module.exports = {
  getAllAttendance,
  getEmployeeAttendance,
  getAttendanceByDateRange,
  getTodayStatus,
  createAttendance,
  checkIn,
  checkOut,
  getEmployeeStats,
  updateAttendance,
  deleteAttendance
};

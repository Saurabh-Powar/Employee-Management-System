const pool = require("../db/sql")
const websocket = require("../websocket")
const { calculateWorkHours, isLate, calculateOvertime } = require("../utils/attendanceUtils")

// Safe access to io - will use the initialized instance or a dummy emitter
const getIo = () => {
  try {
    return (
      websocket.io || {
        emit: (event, data) => console.log(`WebSocket not initialized, event ${event} not emitted`),
      }
    )
  } catch (error) {
    console.warn("WebSocket not initialized yet, using dummy emitter")
    return {
      emit: (event, data) => console.log(`WebSocket not initialized, event ${event} not emitted`),
    }
  }
}

// Get all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, e.first_name, e.last_name, e.department 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      ORDER BY a.date DESC, a.check_in_time DESC
    `)

    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching attendance records:", error)
    res.status(500).json({ error: "Failed to fetch attendance records" })
  }
}

// Get attendance records for a specific employee
const getEmployeeAttendance = async (req, res) => {
  const { employeeId } = req.params

  try {
    const result = await pool.query(
      `
      SELECT * FROM attendance 
      WHERE employee_id = $1 
      ORDER BY date DESC, check_in_time DESC
    `,
      [employeeId],
    )

    res.json(result.rows)
  } catch (error) {
    console.error(`Error fetching attendance for employee ${employeeId}:`, error)
    res.status(500).json({ error: "Failed to fetch employee attendance" })
  }
}

// Get attendance records for a date range
const getAttendanceByDateRange = async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    // Validate date inputs
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Both startDate and endDate are required" })
    }

    const result = await pool.query(
      `
      SELECT a.*, e.first_name, e.last_name, e.department 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE a.date BETWEEN $1 AND $2 
      ORDER BY a.date DESC, a.check_in_time DESC
    `,
      [startDate, endDate],
    )

    res.json(result.rows)
  } catch (error) {
    console.error(`Error fetching attendance for date range ${startDate} to ${endDate}:`, error)
    res.status(500).json({ error: "Failed to fetch attendance for date range" })
  }
}

// Get today's attendance status for an employee
const getTodayStatus = async (req, res) => {
  const { employeeId } = req.params
  const today = new Date().toISOString().split("T")[0]

  try {
    const result = await pool.query(
      `
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
    `,
      [employeeId, today],
    )

    if (result.rows.length === 0) {
      return res.json({
        checked_in: false,
        checked_out: false,
        date: today,
      })
    }

    const attendance = result.rows[0]
    res.json({
      id: attendance.id,
      checked_in: true,
      checked_out: attendance.check_out_time !== null,
      check_in_time: attendance.check_in_time,
      check_out_time: attendance.check_out_time,
      date: attendance.date,
      work_hours: attendance.work_hours,
    })
  } catch (error) {
    console.error(`Error fetching today's attendance for employee ${employeeId}:`, error)
    res.status(500).json({ error: "Failed to fetch today's attendance status" })
  }
}

// Create a new attendance record with transaction support
const createAttendance = async (req, res) => {
  const { employee_id, date, check_in_time, check_out_time, work_hours, status } = req.body

  // Validate inputs
  if (!employee_id || !date) {
    return res.status(400).json({ error: "Employee ID and date are required" })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const result = await client.query(
      `
      INSERT INTO attendance (employee_id, date, check_in_time, check_out_time, work_hours, status) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `,
      [employee_id, date, check_in_time, check_out_time, work_hours, status],
    )

    const newAttendance = result.rows[0]

    // Log the action
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.session?.user?.id || null,
        "create",
        "attendance",
        newAttendance.id,
        JSON.stringify({ employee_id, date, status }),
      ],
    )

    await client.query("COMMIT")

    // Emit WebSocket event
    getIo().emit("attendance_update", {
      type: "created",
      employee_id,
      attendance: newAttendance,
    })

    res.status(201).json(newAttendance)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating attendance record:", error)
    res.status(500).json({ error: "Failed to create attendance record" })
  } finally {
    client.release()
  }
}

// Check in with transaction support
const checkIn = async (req, res) => {
  const { employee_id } = req.body
  const now = new Date()
  const today = now.toISOString().split("T")[0]

  // Start a transaction
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Use FOR UPDATE to lock the row during check
    const existingCheck = await client.query(
      `
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
      FOR UPDATE
      `,
      [employee_id, today],
    )

    if (existingCheck.rows.length > 0) {
      await client.query("ROLLBACK")
      return res.status(400).json({ error: "Already checked in today" })
    }

    // Get employee's shift with locking
    const shiftResult = await client.query(
      `
      SELECT * FROM shifts 
      WHERE employee_id = $1
      FOR UPDATE
      `,
      [employee_id],
    )

    let status = "present"
    let isLateCheckIn = false

    // Check if employee is late
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0]
      const [shiftHours, shiftMinutes] = shift.start_time.split(":").map(Number)

      const shiftStart = new Date()
      shiftStart.setHours(shiftHours, shiftMinutes, 0, 0)

      // If more than 15 minutes late
      if (now - shiftStart > 15 * 60 * 1000) {
        status = "late"
        isLateCheckIn = true
      }
    }

    // Create attendance record
    const result = await client.query(
      `
      INSERT INTO attendance (employee_id, date, check_in_time, status) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
      `,
      [employee_id, today, now, status],
    )

    const newAttendance = result.rows[0]

    // Create notification if late
    if (isLateCheckIn) {
      await client.query(
        `
        INSERT INTO notifications (employee_id, title, message, type, is_read) 
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          employee_id,
          "Late Check-in",
          `You checked in late today at ${now.toLocaleTimeString()}. This may affect your attendance record.`,
          "attendance_alert",
          false,
        ],
      )

      // Also notify manager
      const employeeData = await client.query("SELECT department_id FROM employees WHERE id = $1", [employee_id])
      if (employeeData.rows.length > 0) {
        const departmentId = employeeData.rows[0].department_id

        // Find manager of this department
        const managerData = await client.query(
          `
          SELECT e.id FROM employees e 
          WHERE e.role = 'manager' AND e.department_id = $1
          `,
          [departmentId],
        )

        if (managerData.rows.length > 0) {
          const managerId = managerData.rows[0].id

          await client.query(
            `
            INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) 
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
              managerId,
              employee_id,
              "Employee Late Check-in",
              `An employee has checked in late today at ${now.toLocaleTimeString()}.`,
              "attendance_alert",
              false,
            ],
          )
        }
      }
    }

    // Log the check-in action
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.session?.user?.id || null,
        "check-in",
        "attendance",
        newAttendance.id,
        JSON.stringify({ employee_id, date: today, status }),
      ],
    )

    // Commit the transaction
    await client.query("COMMIT")

    // Emit WebSocket event
    getIo().emit("attendance_update", {
      employee_id,
      action: "check-in",
      attendance: newAttendance,
    })

    res.status(201).json({
      id: newAttendance.id,
      checked_in: true,
      checked_out: false,
      check_in_time: newAttendance.check_in_time,
      date: newAttendance.date,
      status: newAttendance.status,
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error checking in:", error)
    res.status(500).json({ error: "Failed to check in. Please try again." })
  } finally {
    client.release()
  }
}

// Check out with transaction support
const checkOut = async (req, res) => {
  const { employee_id } = req.body

  if (!employee_id) {
    return res.status(400).json({ error: "Employee ID is required" })
  }

  const now = new Date()
  const today = now.toISOString().split("T")[0]

  // Start a transaction
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Find today's attendance record with row locking
    const attendanceResult = await client.query(
      `
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date = $2
      FOR UPDATE
      `,
      [employee_id, today],
    )

    // Allow check-out even if no check-in exists (create a new record)
    let attendance
    let checkInTime
    let isNewRecord = false

    if (attendanceResult.rows.length === 0) {
      // No check-in record found, create one with default check-in time at the start of business day
      // For this, we'll get the employee's shift or use 9 AM as default

      // First check if employee has a shift
      const shiftResult = await client.query(
        `
        SELECT * FROM shifts 
        WHERE employee_id = $1
        `,
        [employee_id],
      )

      // Default check-in time at 9 AM
      checkInTime = new Date(today)
      checkInTime.setHours(9, 0, 0, 0)

      // If employee has a shift, use shift start time
      if (shiftResult.rows.length > 0) {
        const shift = shiftResult.rows[0]
        const [startHours, startMinutes] = shift.start_time.split(":").map(Number)

        checkInTime = new Date(today)
        checkInTime.setHours(startHours, startMinutes, 0, 0)
      }

      // Create a new attendance record with the determined check-in time
      const newAttendanceResult = await client.query(
        `
        INSERT INTO attendance (employee_id, date, check_in_time, status) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
        `,
        [employee_id, today, checkInTime, "auto_checkin"],
      )

      attendance = newAttendanceResult.rows[0]
      isNewRecord = true

      // Create notification about automatic check-in
      await client.query(
        `
        INSERT INTO notifications (employee_id, title, message, type, is_read) 
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          employee_id,
          "Automatic Check-in",
          `No check-in record found for today. System created an automatic check-in at ${checkInTime.toLocaleTimeString()}.`,
          "attendance_alert",
          false,
        ],
      )
    } else {
      attendance = attendanceResult.rows[0]
      checkInTime = new Date(attendance.check_in_time)

      // Check if already checked out
      if (attendance.check_out_time) {
        await client.query("ROLLBACK")
        return res.status(400).json({ error: "Already checked out today" })
      }
    }

    // Calculate work hours
    const workHours = (now - checkInTime) / (1000 * 60 * 60)
    const roundedWorkHours = Math.round(workHours * 100) / 100 // Round to 2 decimal places

    // Get employee's shift
    const shiftResult = await client.query(
      `
      SELECT * FROM shifts 
      WHERE employee_id = $1
      `,
      [employee_id],
    )

    let overtimeHours = 0

    // Check if employee worked overtime
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0]
      const [endHours, endMinutes] = shift.end_time.split(":").map(Number)

      const shiftEnd = new Date()
      shiftEnd.setHours(endHours, endMinutes, 0, 0)

      // If checked out after shift end
      if (now > shiftEnd) {
        overtimeHours = (now - shiftEnd) / (1000 * 60 * 60)
        overtimeHours = Math.round(overtimeHours * 100) / 100 // Round to 2 decimal places

        // Only count as overtime if more than 30 minutes
        if (overtimeHours > 0.5) {
          // Create notification for overtime
          await client.query(
            `
            INSERT INTO notifications (employee_id, title, message, type, is_read) 
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
              employee_id,
              "Overtime Worked",
              `You worked ${overtimeHours.toFixed(2)} hours of overtime today.`,
              "attendance_alert",
              false,
            ],
          )

          // Also notify manager
          const employeeData = await client.query("SELECT department_id FROM employees WHERE id = $1", [employee_id])
          if (employeeData.rows.length > 0) {
            const departmentId = employeeData.rows[0].department_id

            // Find manager of this department
            const managerData = await client.query(
              `
              SELECT e.id FROM employees e 
              WHERE e.role = 'manager' AND e.department_id = $1
              `,
              [departmentId],
            )

            if (managerData.rows.length > 0) {
              const managerId = managerData.rows[0].id

              await client.query(
                `
                INSERT INTO notifications (employee_id, sender_id, title, message, type, is_read) 
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
                [
                  managerId,
                  employee_id,
                  "Employee Overtime",
                  `An employee worked ${overtimeHours.toFixed(2)} hours of overtime today.`,
                  "attendance_alert",
                  false,
                ],
              )
            }
          }
        }
      }
    }

    // Update attendance record with check-out time and work hours
    const result = await client.query(
      `
      UPDATE attendance 
      SET check_out_time = $1, work_hours = $2, overtime_hours = $3
      WHERE id = $4 
      RETURNING *
      `,
      [now, roundedWorkHours, overtimeHours > 0.5 ? overtimeHours : 0, attendance.id],
    )

    const updatedAttendance = result.rows[0]

    // Update salary information for overtime and late check-ins
    if (attendance.status === "late" || isNewRecord || overtimeHours > 0.5) {
      // Get employee's salary info
      const salaryResult = await client.query(
        `
        SELECT * FROM salaries 
        WHERE employee_id = $1
        `,
        [employee_id],
      )

      if (salaryResult.rows.length > 0) {
        const salary = salaryResult.rows[0]
        const hourlyRate = salary.base_salary / (22 * 8) // Assuming 22 working days per month and 8 hours per day

        let deduction = 0
        let addition = 0

        // Calculate deduction for late check-in or auto check-in
        if (attendance.status === "late") {
          // Deduct 25% of hourly rate for being late
          deduction = hourlyRate * 0.25
        } else if (isNewRecord) {
          // For auto check-in (no check-in record), apply a larger deduction (50% of hourly rate)
          deduction = hourlyRate * 0.5
        }

        // Calculate addition for overtime
        if (overtimeHours > 0.5) {
          // Add 150% of hourly rate for overtime
          addition = overtimeHours * hourlyRate * 1.5
        }

        // Update salary adjustments
        if (deduction > 0) {
          await client.query(
            `
            INSERT INTO salary_adjustments (employee_id, date, amount, reason, type)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
              employee_id,
              today,
              -deduction,
              isNewRecord ? "Missing check-in deduction" : "Late check-in deduction",
              "deduction",
            ],
          )
        }

        if (addition > 0) {
          await client.query(
            `
            INSERT INTO salary_adjustments (employee_id, date, amount, reason, type)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [employee_id, today, addition, "Overtime payment", "addition"],
          )
        }
      }
    }

    // Log the check-out action
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.session?.user?.id || null,
        "check-out",
        "attendance",
        updatedAttendance.id,
        JSON.stringify({
          employee_id,
          date: today,
          work_hours: roundedWorkHours,
          overtime_hours: overtimeHours > 0.5 ? overtimeHours : 0,
        }),
      ],
    )

    // Commit the transaction
    await client.query("COMMIT")

    // Emit WebSocket event
    getIo().emit("attendance_update", {
      employee_id,
      action: "check-out",
      attendance: updatedAttendance,
    })

    res.json({
      id: updatedAttendance.id,
      checked_in: true,
      checked_out: true,
      check_in_time: updatedAttendance.check_in_time,
      check_out_time: updatedAttendance.check_out_time,
      date: updatedAttendance.date,
      work_hours: updatedAttendance.work_hours,
      overtime_hours: updatedAttendance.overtime_hours,
      was_auto_checkin: isNewRecord,
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error checking out:", error)
    res.status(500).json({ error: "Failed to check out. Please try again." })
  } finally {
    client.release()
  }
}

// Get employee attendance statistics
const getEmployeeStats = async (req, res) => {
  const { employeeId } = req.params
  const { startDate, endDate } = req.query

  try {
    // Validate date inputs
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Both startDate and endDate are required" })
    }

    // Get attendance records for the date range
    const attendanceResult = await pool.query(
      `
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
      `,
      [employeeId, startDate, endDate],
    )

    // Calculate statistics
    const totalDays = attendanceResult.rows.length
    const presentDays = attendanceResult.rows.filter((a) => a.status === "present").length
    const lateDays = attendanceResult.rows.filter((a) => a.status === "late").length
    const absentDays = attendanceResult.rows.filter((a) => a.status === "absent").length
    const totalWorkHours = attendanceResult.rows.reduce((sum, a) => sum + (a.work_hours || 0), 0)
    const totalOvertimeHours = attendanceResult.rows.reduce((sum, a) => sum + (a.overtime_hours || 0), 0)

    // Calculate average work hours per day (excluding absent days)
    const workingDays = totalDays - absentDays
    const avgWorkHours = workingDays > 0 ? totalWorkHours / workingDays : 0

    res.json({
      employeeId,
      period: { startDate, endDate },
      stats: {
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        totalWorkHours,
        totalOvertimeHours,
        avgWorkHours,
        attendanceRate: totalDays > 0 ? (presentDays / totalDays) * 100 : 0,
        punctualityRate: totalDays > 0 ? ((presentDays - lateDays) / totalDays) * 100 : 0,
      },
    })
  } catch (error) {
    console.error(`Error fetching attendance stats for employee ${employeeId}:`, error)
    res.status(500).json({ error: "Failed to fetch attendance statistics" })
  }
}

// Update attendance record
const updateAttendance = async (req, res) => {
  const { attendanceId } = req.params
  const { check_in_time, check_out_time, status, notes } = req.body

  // Start a transaction
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Check if attendance record exists
    const attendanceCheck = await client.query("SELECT * FROM attendance WHERE id = $1 FOR UPDATE", [attendanceId])

    if (attendanceCheck.rows.length === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "Attendance record not found" })
    }

    const oldAttendance = attendanceCheck.rows[0]

    // Calculate work hours if both check-in and check-out times are provided
    let workHours = oldAttendance.work_hours
    if (check_in_time && check_out_time) {
      const checkInTime = new Date(check_in_time)
      const checkOutTime = new Date(check_out_time)
      workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60)
      workHours = Math.round(workHours * 100) / 100 // Round to 2 decimal places
    }

    // Update attendance record
    const result = await client.query(
      `
      UPDATE attendance 
      SET check_in_time = COALESCE($1, check_in_time),
          check_out_time = COALESCE($2, check_out_time),
          status = COALESCE($3, status),
          notes = COALESCE($4, notes),
          work_hours = $5
      WHERE id = $6 
      RETURNING *
      `,
      [check_in_time, check_out_time, status, notes, workHours, attendanceId],
    )

    const updatedAttendance = result.rows[0]

    // Log the update action
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.session?.user?.id || null,
        "update",
        "attendance",
        updatedAttendance.id,
        JSON.stringify({
          previous: {
            check_in_time: oldAttendance.check_in_time,
            check_out_time: oldAttendance.check_out_time,
            status: oldAttendance.status,
            work_hours: oldAttendance.work_hours,
          },
          updated: {
            check_in_time: updatedAttendance.check_in_time,
            check_out_time: updatedAttendance.check_out_time,
            status: updatedAttendance.status,
            work_hours: updatedAttendance.work_hours,
          },
        }),
      ],
    )

    // Commit the transaction
    await client.query("COMMIT")

    // Emit WebSocket event
    getIo().emit("attendance_update", {
      employee_id: updatedAttendance.employee_id,
      action: "update",
      attendance: updatedAttendance,
    })

    res.json(updatedAttendance)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error(`Error updating attendance record ${attendanceId}:`, error)
    res.status(500).json({ error: "Failed to update attendance record" })
  } finally {
    client.release()
  }
}

// Delete attendance record
const deleteAttendance = async (req, res) => {
  const { attendanceId } = req.params

  // Start a transaction
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Check if attendance record exists
    const attendanceCheck = await client.query("SELECT * FROM attendance WHERE id = $1 FOR UPDATE", [attendanceId])

    if (attendanceCheck.rows.length === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "Attendance record not found" })
    }

    const attendance = attendanceCheck.rows[0]

    // Delete attendance record
    await client.query("DELETE FROM attendance WHERE id = $1", [attendanceId])

    // Log the delete action
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.session?.user?.id || null,
        "delete",
        "attendance",
        attendanceId,
        JSON.stringify({
          employee_id: attendance.employee_id,
          date: attendance.date,
          status: attendance.status,
        }),
      ],
    )

    // Commit the transaction
    await client.query("COMMIT")

    // Emit WebSocket event
    getIo().emit("attendance_update", {
      employee_id: attendance.employee_id,
      action: "delete",
      attendance_id: attendanceId,
    })

    res.json({ message: "Attendance record deleted successfully" })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error(`Error deleting attendance record ${attendanceId}:`, error)
    res.status(500).json({ error: "Failed to delete attendance record" })
  } finally {
    client.release()
  }
}

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
  deleteAttendance,
}

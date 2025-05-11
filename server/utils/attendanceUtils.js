/**
 * Calculate work hours between check-in and check-out times
 * @param {Date} checkInTime - Check-in time
 * @param {Date} checkOutTime - Check-out time
 * @returns {number} - Work hours (rounded to 2 decimal places)
 */
const calculateWorkHours = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) {
    return 0
  }

  const checkIn = new Date(checkInTime)
  const checkOut = new Date(checkOutTime)

  // Calculate difference in hours
  const diffHours = (checkOut - checkIn) / (1000 * 60 * 60)

  // Round to 2 decimal places
  return Math.round(diffHours * 100) / 100
}

/**
 * Check if employee is late based on shift start time
 * @param {Date} checkInTime - Check-in time
 * @param {string} shiftStartTime - Shift start time (format: "HH:MM")
 * @returns {Object} - Late status information
 */
const isLate = (checkInTime, shiftStartTime) => {
  if (!checkInTime || !shiftStartTime) {
    return { late: false, minutesLate: 0 }
  }

  const checkIn = new Date(checkInTime)

  // Parse shift start time
  const [hours, minutes] = shiftStartTime.split(":").map(Number)

  // Create date object for shift start time (using same day as check-in)
  const shiftStart = new Date(checkIn)
  shiftStart.setHours(hours, minutes, 0, 0)

  // Calculate difference in minutes
  const diffMinutes = Math.round((checkIn - shiftStart) / (1000 * 60))

  // Consider late if more than 15 minutes after shift start
  return {
    late: diffMinutes > 15,
    minutesLate: diffMinutes > 0 ? diffMinutes : 0,
  }
}

/**
 * Calculate overtime hours
 * @param {Date} checkOutTime - Check-out time
 * @param {string} shiftEndTime - Shift end time (format: "HH:MM")
 * @returns {number} - Overtime hours (rounded to 2 decimal places)
 */
const calculateOvertime = (checkOutTime, shiftEndTime) => {
  if (!checkOutTime || !shiftEndTime) {
    return 0
  }

  const checkOut = new Date(checkOutTime)

  // Parse shift end time
  const [hours, minutes] = shiftEndTime.split(":").map(Number)

  // Create date object for shift end time (using same day as check-out)
  const shiftEnd = new Date(checkOut)
  shiftEnd.setHours(hours, minutes, 0, 0)

  // Calculate difference in hours
  const diffHours = (checkOut - shiftEnd) / (1000 * 60 * 60)

  // Only count as overtime if more than 30 minutes (0.5 hours)
  if (diffHours <= 0.5) {
    return 0
  }

  // Round to 2 decimal places
  return Math.round(diffHours * 100) / 100
}

module.exports = {
  calculateWorkHours,
  isLate,
  calculateOvertime,
}

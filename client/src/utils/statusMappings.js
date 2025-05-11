/**
 * Status mapping utilities for consistent UI display
 */

// Task status mappings between UI and database values
export const taskStatusMapping = {
  // UI to DB mappings
  Pending: "pending",
  "In Progress": "in_progress",
  "Pending Approval": "pending_completion",
  Completed: "completed",
  Cancelled: "cancelled",

  // DB to UI mappings
  pending: "Pending",
  in_progress: "In Progress",
  pending_completion: "Pending Approval",
  completed: "Completed",
  cancelled: "Cancelled",
}

// Attendance status mappings between UI and database values
export const attendanceStatusMapping = {
  // UI to DB mappings
  Present: "present",
  Absent: "absent",
  Late: "late",
  "Half Day": "half_day",
  "On Leave": "on_leave",
  "Work From Home": "wfh",
  "Checked In": "check-in",
  "Checked Out": "check-out",

  // DB to UI mappings
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "On Leave",
  wfh: "Work From Home",
  "check-in": "Checked In",
  "check-out": "Checked Out",
}

// Leave status mappings between UI and database values
export const leaveStatusMapping = {
  // UI to DB mappings
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
  Cancelled: "cancelled",

  // DB to UI mappings
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

/**
 * Maps a value from UI to database format
 * @param {string} value - The value to map
 * @param {Object} mapping - The mapping object to use
 * @returns {string} The mapped value or the original if no mapping exists
 */
export const mapToDbValue = (value, mapping) => {
  return mapping[value] || value
}

/**
 * Maps a value from database to UI format
 * @param {string} value - The value to map
 * @param {Object} mapping - The mapping object to use
 * @returns {string} The mapped value or the original if no mapping exists
 */
export const mapToUiValue = (value, mapping) => {
  return mapping[value] || value
}

/**
 * Gets all UI values from a mapping
 * @param {Object} mapping - The mapping object to use
 * @returns {Array} Array of UI values
 */
export const getUiValues = (mapping) => {
  return Object.keys(mapping).filter((key) => !mapping[mapping[key]])
}

/**
 * Gets all DB values from a mapping
 * @param {Object} mapping - The mapping object to use
 * @returns {Array} Array of DB values
 */
export const getDbValues = (mapping) => {
  return Object.values(mapping).filter((value) => !mapping[value])
}

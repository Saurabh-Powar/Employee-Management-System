/**
 * Utility functions for mapping UI-friendly status values to database values and vice versa
 */

// Task status mappings
export const taskStatusMapping = {
    // UI to DB mapping
    pending: "pending",
    in_progress: "in_progress",
    pending_completion: "in_review",
    completed: "completed",
    cancelled: "cancelled",
  
    // DB to UI mapping (reverse)
    in_review: "pending_completion",
  }
  
  // Attendance status mappings
  export const attendanceStatusMapping = {
    // UI to DB mapping
    present: "present",
    late: "late",
    absent: "absent",
    half_day: "half_day",
  
    // DB to UI mapping (reverse)
  }
  
  // Leave request status mappings
  export const leaveStatusMapping = {
    // UI to DB mapping
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    cancelled: "cancelled",
  
    // DB to UI mapping (reverse)
  }
  
  // Notification type mappings
  export const notificationTypeMapping = {
    // UI to DB mapping
    success: "task_update",
    warning: "attendance_alert",
    info: "general",
    error: "system_alert",
  
    // DB to UI mapping (reverse)
    task_update: "success",
    attendance_alert: "warning",
    general: "info",
    system_alert: "error",
  }
  
  /**
   * Maps a UI status to its corresponding database status
   * @param {string} uiStatus - The status value displayed in the UI
   * @param {Object} mappingObject - The mapping object to use
   * @returns {string} - The database status value
   */
  export const mapToDbValue = (uiValue, mappingObject) => {
    return mappingObject[uiValue] || uiValue
  }
  
  /**
   * Maps a database status to its corresponding UI status
   * @param {string} dbStatus - The status value stored in the database
   * @param {Object} mappingObject - The mapping object to use
   * @returns {string} - The UI-friendly status value
   */
  export const mapToUiValue = (dbValue, mappingObject) => {
    // Find UI value that maps to this DB value
    for (const [uiValue, mappedDbValue] of Object.entries(mappingObject)) {
      if (mappedDbValue === dbValue) {
        return uiValue
      }
    }
    return dbValue // Default to the same if no mapping exists
  }
  
  /**
   * Creates an object with both DB and UI values
   * @param {Object} object - The object containing a status field
   * @param {string} field - The field name to map (e.g. 'status', 'type')
   * @param {Object} mappingObject - The mapping object to use
   * @returns {Object} - Object with additional ui_fieldname property
   */
  export const addUiMapping = (object, field, mappingObject) => {
    if (!object || object[field] === undefined) return object
  
    return {
      ...object,
      [`ui_${field}`]: mapToUiValue(object[field], mappingObject),
    }
  }
  
// Status mapping utilities for consistent UI display

// Task status mapping between UI and database
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
  
  // Attendance status mapping
  export const attendanceStatusMapping = {
    "check-in": "Checked In",
    "check-out": "Checked Out",
    absent: "Absent",
    late: "Late",
  }
  
  // Leave status mapping
  export const leaveStatusMapping = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  }
  
  // Map a value using the provided mapping
  export const mapToUiValue = (value, mapping) => {
    return mapping[value] || value
  }
  
  // Map a UI value to database value
  export const mapToDbValue = (uiValue, mapping) => {
    // First check if there's a direct mapping
    if (mapping[uiValue]) {
      return mapping[uiValue]
    }
  
    // If not, look for a reverse mapping
    for (const [dbValue, mappedUiValue] of Object.entries(mapping)) {
      if (mappedUiValue === uiValue) {
        return dbValue
      }
    }
  
    // If no mapping found, return the original value
    return uiValue
  }
  
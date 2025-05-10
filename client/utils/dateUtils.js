/**
 * Utility functions for handling dates and timezones
 */

/**
 * Converts a local date to UTC for storing in the database
 * @param {Date} localDate - Date in local timezone
 * @returns {Date} Date in UTC
 */
export const convertLocalToUTC = (localDate) => {
    if (!localDate) return null
    const date = new Date(localDate)
    return new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
      ),
    )
  }
  
  /**
   * Converts a UTC date from the database to local timezone for display
   * @param {string|Date} utcDate - UTC date string or Date object
   * @returns {Date} Date in local timezone
   */
  export const convertUTCToLocal = (utcDate) => {
    if (!utcDate) return null
    return new Date(utcDate)
  }
  
  /**
   * Formats a date for display with specified options
   * @param {string|Date} date - The date to format
   * @param {Object} options - Formatting options for toLocaleDateString
   * @returns {string} Formatted date string
   */
  export const formatDate = (
    date,
    options = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", options)
  }
  
  /**
   * Formats a time for display
   * @param {string|Date} time - The time to format
   * @param {Object} options - Formatting options for toLocaleTimeString
   * @returns {string} Formatted time string
   */
  export const formatTime = (
    time,
    options = {
      hour: "2-digit",
      minute: "2-digit",
    },
  ) => {
    if (!time) return "--"
    return new Date(time).toLocaleTimeString("en-US", options)
  }
  
  /**
   * Checks if a date is today
   * @param {string|Date} date - The date to check
   * @returns {boolean} True if the date is today
   */
  export const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    const checkDate = new Date(date)
    return (
      checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear()
    )
  }
  
  /**
   * Gets the current date in YYYY-MM-DD format
   * @returns {string} Today's date as YYYY-MM-DD
   */
  export const getTodayDateString = () => {
    return new Date().toISOString().split("T")[0]
  }
  
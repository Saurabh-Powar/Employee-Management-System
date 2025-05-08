export const isAbsentToday = (attendanceData = []) => {
  // Ensure attendanceData is an array and not empty
  if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
    console.error("Invalid attendance data.")
    return false
  }

  const today = new Date().toISOString().split("T")[0] // Get today's date in YYYY-MM-DD format

  // Check if any record matches today's date and is marked as 'absent'
  return attendanceData.some((record) => record?.date === today && record?.status?.toLowerCase() === "absent")
}

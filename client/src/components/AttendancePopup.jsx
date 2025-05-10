import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AttendancePopups.css';

const AttendancePopup = ({ onClose }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [lateStatus, setLateStatus] = useState(null);

  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/attendance/today/${user.id}`);
        setStatus(response.data);
        
        if (response.data.checked_in) {
          setCheckInTime(new Date(response.data.check_in_time));
        }
        
        // Fetch employee's shift information
        const shiftResponse = await api.get(`/shifts/employee/${user.id}`);
        if (shiftResponse.data) {
          setShiftInfo(shiftResponse.data);
          
          // Check if employee is late
          if (response.data.checked_in) {
            const checkInTime = new Date(response.data.check_in_time);
            const shiftStartTime = new Date();
            const [hours, minutes] = shiftResponse.data.start_time.split(':');
            shiftStartTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
            
            // Calculate minutes late
            const minutesLate = Math.round((checkInTime - shiftStartTime) / (1000 * 60));
            
            if (minutesLate > 15) {
              setLateStatus({
                late: true,
                minutesLate: minutesLate
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching attendance status:', err);
        setError('Failed to load attendance status. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user && user.id) {
      fetchAttendanceStatus();
    }
  }, [user]);

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      const response = await api.post('/attendance/check-in', { employee_id: user.id });
      setStatus(response.data);
      setCheckInTime(new Date());
      
      // Check if check-in is late
      if (shiftInfo) {
        const now = new Date();
        const shiftStartTime = new Date();
        const [hours, minutes] = shiftInfo.start_time.split(':');
        shiftStartTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        
        // Calculate minutes late
        const minutesLate = Math.round((now - shiftStartTime) / (1000 * 60));
        
        if (minutesLate > 15) {
          setLateStatus({
            late: true,
            minutesLate: minutesLate
          });
          
          // Create a notification about being late
          await api.post('/notifications', {
            employee_id: user.id,
            sender_id: null, // System notification
            title: 'Late Check-in',
            message: `You checked in ${minutesLate} minutes late today. This may affect your attendance record.`,
            type: 'attendance_alert'
          });
        }
      }
    } catch (err) {
      console.error('Error checking in:', err);
      setError('Failed to check in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLoading(true);
      const response = await api.post('/attendance/check-out', { employee_id: user.id });
      setStatus(response.data);
      
      // Calculate work hours
      if (checkInTime) {
        const checkOutTime = new Date();
        const hoursWorked = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2);
        
        // Check if employee worked overtime
        if (shiftInfo) {
          const shiftEndTime = new Date();
          const [hours, minutes] = shiftInfo.end_time.split(':');
          shiftEndTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          
          // Calculate minutes of overtime
          const minutesOvertime = Math.round((checkOutTime - shiftEndTime) / (1000 * 60));
          
          if (minutesOvertime > 30) {
            // Create a notification about overtime
            await api.post('/notifications', {
              employee_id: user.id,
              sender_id: null, // System notification
              title: 'Overtime Worked',
              message: `You worked ${Math.round(minutesOvertime / 60 * 100) / 100} hours of overtime today.`,
              type: 'attendance_alert'
            });
          }
        }
        
        // Show confirmation with hours worked
        alert(`Successfully checked out. You worked for ${hoursWorked} hours today.`);
      }
    } catch (err) {
      console.error('Error checking out:', err);
      setError('Failed to check out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attendance-popup">
      <div className="attendance-popup-content">
        <button 
          className="close-btn" 
          onClick={onClose}
          aria-label="Close attendance popup"
          title="Close attendance popup"
        >
          ×
        </button>
        
        <h2>Attendance</h2>
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="attendance-status">
            {shiftInfo && (
              <div className="shift-info">
                <p>Your shift: {shiftInfo.start_time} - {shiftInfo.end_time}</p>
              </div>
            )}
            
            <div className="status-display">
              <div className={`status-indicator ${status?.checked_in ? 'checked-in' : 'checked-out'}`}>
                {status?.checked_in ? 'Checked In' : 'Checked Out'}
              </div>
              
              {status?.checked_in && (
                <p className="check-in-time">
                  Checked in at: {new Date(status.check_in_time).toLocaleTimeString()}
                </p>
              )}
              
              {lateStatus?.late && (
                <div className="late-warning">
                  <p>You were {lateStatus.minutesLate} minutes late today.</p>
                  <p className="late-note">Note: This may affect your attendance record and salary calculation.</p>
                </div>
              )}
            </div>
            
            <div className="attendance-actions">
              {!status?.checked_in ? (
                <button 
                  className="check-in-btn" 
                  onClick={handleCheckIn}
                  disabled={loading}
                  aria-label="Check in"
                  title="Check in"
                >
                  Check In
                </button>
              ) : (
                <button 
                  className="check-out-btn" 
                  onClick={handleCheckOut}
                  disabled={loading}
                  aria-label="Check out"
                  title="Check out"
                >
                  Check Out
                </button>
              )}
            </div>
            
            {status?.checked_in && (
              <div className="attendance-notes">
                <p>Don't forget to check out at the end of your workday.</p>
                {lateStatus?.late && (
                  <p className="salary-impact">
                    Late check-ins may result in salary deductions as per company policy.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendancePopup;

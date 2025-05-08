const { query } = require("./sql")
const bcrypt = require("bcrypt")

const createTables = async () => {
  try {
    // Drop existing tables if they exist (for reset)
    await query(`
      DROP TABLE IF EXISTS task_timers CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS salaries CASCADE;
      DROP TABLE IF EXISTS performance CASCADE;
      DROP TABLE IF EXISTS leaves CASCADE;
      DROP TABLE IF EXISTS shifts CASCADE;
      DROP TABLE IF EXISTS attendance CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `)

    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        position VARCHAR(50) NOT NULL,
        department VARCHAR(50) NOT NULL,
        joining_date DATE NOT NULL,
        base_salary DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        date DATE NOT NULL,
        check_in TIMESTAMP WITH TIME ZONE,
        check_out TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL CHECK (status IN ('check-in', 'check-out', 'absent', 'late')),
        hours_worked DECIMAL(5, 2),
        is_late BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_attendance UNIQUE (employee_id, date)
      );
    `)

    // Update the database schema to include attendance correction fields
    await query(`
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS corrected_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS correction_time TIMESTAMP,
      ADD COLUMN IF NOT EXISTS correction_reason TEXT;
    `)

    // Create shifts table for employee work schedules
    await query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) UNIQUE,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        days TEXT[] NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create leaves table with approved_by and approved_at columns
    await query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_leave UNIQUE (employee_id, start_date)
      );
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS performance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        evaluation_date DATE NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comments TEXT,
        evaluated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_performance UNIQUE (employee_id, evaluation_date)
      );

      CREATE TABLE IF NOT EXISTS salaries (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        base_amount DECIMAL(10, 2) NOT NULL,
        overtime_amount DECIMAL(10, 2) DEFAULT 0,
        deductions DECIMAL(10, 2) DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processed', 'paid')),
        payment_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_salary UNIQUE (employee_id, month, year)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        sender_id INTEGER REFERENCES users(id),
        title VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('alert', 'reminder', 'update')),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_notification UNIQUE (user_id, title)
      );
    `)

    // Add these tables to the createTables function
    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        title VARCHAR(100) NOT NULL,
        description TEXT,
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed')),
        assigned_by INTEGER REFERENCES users(id),
        time_spent INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_timers (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Hash passwords for default users
    const hashedPasswordAdmin = await bcrypt.hash("admin123", 10)
    const hashedPasswordManager = await bcrypt.hash("manager123", 10)
    const hashedPasswordEmployee = await bcrypt.hash("employee123", 10)

    // Insert users (admin, manager, employee)
    await query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING", [
      "admin",
      hashedPasswordAdmin,
      "admin",
    ])

    await query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING", [
      "manager",
      hashedPasswordManager,
      "manager",
    ])

    await query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING", [
      "employee",
      hashedPasswordEmployee,
      "employee",
    ])

    // Insert additional test users
    const hashedPasswordEmployee2 = await bcrypt.hash("employee456", 10)
    const hashedPasswordEmployee3 = await bcrypt.hash("employee789", 10)

    await query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING", [
      "employee2",
      hashedPasswordEmployee2,
      "employee",
    ])

    await query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING", [
      "employee3",
      hashedPasswordEmployee3,
      "employee",
    ])

    // Insert default employees linked to users
    await query(`
      INSERT INTO employees (user_id, first_name, last_name, email, position, department, joining_date, base_salary)
      SELECT 
        (SELECT id FROM users WHERE username = 'admin'),
        'Alice', 'Admin', 'alice.admin@example.com',
        'System Admin', 'Admin Dept', '2024-01-10', 90000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    await query(`
      INSERT INTO employees (user_id, first_name, last_name, email, position, department, joining_date, base_salary)
      SELECT 
        (SELECT id FROM users WHERE username = 'manager'),
        'Bob', 'Manager', 'bob.manager@example.com',
        'Team Lead', 'IT', '2024-02-01', 75000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    await query(`
      INSERT INTO employees (user_id, first_name, last_name, email, position, department, joining_date, base_salary)
      SELECT 
        (SELECT id FROM users WHERE username = 'employee'),
        'John', 'Employee', 'john.employee@example.com',
        'Software Engineer', 'IT', '2024-03-01', 60000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    // Insert additional employees for testing
    await query(`
      INSERT INTO employees (user_id, first_name, last_name, email, position, department, joining_date, base_salary)
      SELECT 
        (SELECT id FROM users WHERE username = 'employee2'),
        'Sarah', 'Connor', 'sarah.connor@example.com',
        'Software Engineer', 'IT', '2024-03-15', 65000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    await query(`
      INSERT INTO employees (user_id, first_name, last_name, email, position, department, joining_date, base_salary)
      SELECT 
        (SELECT id FROM users WHERE username = 'employee3'),
        'Michael', 'Johnson', 'michael.johnson@example.com',
        'QA Engineer', 'IT', '2024-04-01', 62000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    // Insert default shifts for employees with correct day format (mon, tue, wed, thu, fri)
    await query(`
      INSERT INTO shifts (employee_id, start_time, end_time, days)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '09:00', '17:00', ARRAY['mon', 'tue', 'wed', 'thu', 'fri']),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), '08:30', '16:30', ARRAY['mon', 'tue', 'wed', 'thu', 'fri']),
        ((SELECT id FROM employees WHERE email = 'bob.manager@example.com'), '09:00', '17:00', ARRAY['mon', 'tue', 'wed', 'thu', 'fri']),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), '10:00', '18:00', ARRAY['mon', 'tue', 'wed', 'thu', 'fri'])
      ON CONFLICT (employee_id) DO NOTHING;
    `)

    // Get current date for attendance records
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const todayStr = today.toISOString().split("T")[0]
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    // Insert attendance records with proper type handling
    await query(
      `
      INSERT INTO attendance (employee_id, date, check_in, check_out, status, hours_worked, is_late)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), $1::date, ($1::date || ' 09:00:00')::timestamp with time zone, ($1::date || ' 17:00:00')::timestamp with time zone, 'check-out', 8.0, FALSE),
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), $2::date, ($2::date || ' 09:15:00')::timestamp with time zone, ($2::date || ' 17:15:00')::timestamp with time zone, 'check-out', 8.0, TRUE),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), $1::date, ($1::date || ' 08:45:00')::timestamp with time zone, ($1::date || ' 16:45:00')::timestamp with time zone, 'check-out', 8.0, TRUE),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), $1::date, ($1::date || ' 10:05:00')::timestamp with time zone, ($1::date || ' 18:05:00')::timestamp with time zone, 'check-out', 8.0, TRUE),
        ((SELECT id FROM employees WHERE email = 'bob.manager@example.com'), $1::date, ($1::date || ' 09:00:00')::timestamp with time zone, ($1::date || ' 17:30:00')::timestamp with time zone, 'check-out', 8.5, FALSE)
      ON CONFLICT (employee_id, date) DO NOTHING;
    `,
      [yesterdayStr, todayStr],
    )

    // Insert leave records
    await query(`
      INSERT INTO leaves (employee_id, start_date, end_date, reason, status)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', 'Vacation', 'pending'),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days', 'Family event', 'pending'),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', 'Medical appointment', 'pending')
      ON CONFLICT (employee_id, start_date) DO NOTHING;
    `)

    // Insert performance evaluations
    await query(`
      INSERT INTO performance (employee_id, evaluation_date, rating, comments, evaluated_by)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), CURRENT_DATE - INTERVAL '7 days', 4, 'Good performance overall', (SELECT id FROM users WHERE username = 'manager')),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), CURRENT_DATE - INTERVAL '7 days', 5, 'Excellent performance', (SELECT id FROM users WHERE username = 'manager')),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), CURRENT_DATE - INTERVAL '7 days', 3, 'Satisfactory performance', (SELECT id FROM users WHERE username = 'manager'))
      ON CONFLICT (employee_id, evaluation_date) DO NOTHING;
    `)

    // Insert salary records
    const currentMonth = new Date().getMonth() + 1 // JavaScript months are 0-indexed
    const currentYear = new Date().getFullYear()

    await query(
      `
      INSERT INTO salaries (employee_id, month, year, base_amount, total_amount, status)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), $1, $2, 5000.00, 5000.00, 'pending'),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), $1, $2, 5416.67, 5416.67, 'pending'),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), $1, $2, 5166.67, 5166.67, 'pending'),
        ((SELECT id FROM employees WHERE email = 'bob.manager@example.com'), $1, $2, 6250.00, 6250.00, 'pending')
      ON CONFLICT (employee_id, month, year) DO NOTHING;
    `,
      [currentMonth, currentYear],
    )

    // Insert notifications
    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES
        ((SELECT id FROM users WHERE username = 'employee'), 'Attendance Reminder', 'Please check in for today', 'reminder'),
        ((SELECT id FROM users WHERE username = 'employee2'), 'Leave Request Update', 'Your leave request is pending approval', 'update'),
        ((SELECT id FROM users WHERE username = 'employee3'), 'Performance Review', 'Your performance review is scheduled next week', 'alert'),
        ((SELECT id FROM users WHERE username = 'manager'), 'Leave Requests', 'You have 3 pending leave requests to review', 'alert'),
        ((SELECT id FROM users WHERE username = 'admin'), 'System Update', 'System maintenance scheduled this weekend', 'update')
      ON CONFLICT (user_id, title) DO NOTHING;
    `)

    // Add some sample tasks
    await query(`
      INSERT INTO tasks (employee_id, title, description, priority, due_date, status, assigned_by, time_spent)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), 
         'Complete Project Documentation', 
         'Write comprehensive documentation for the new feature', 
         'medium', 
         CURRENT_DATE + INTERVAL '3 days', 
         'assigned', 
         (SELECT id FROM users WHERE username = 'manager'), 
         0),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), 
         'Fix Login Bug', 
         'Investigate and fix the login issue reported by users', 
         'high', 
         CURRENT_DATE + INTERVAL '1 day', 
         'in_progress', 
         (SELECT id FROM users WHERE username = 'manager'), 
         3600),
        ((SELECT id FROM employees WHERE email = 'michael.johnson@example.com'), 
         'Test New Feature', 
         'Perform comprehensive testing of the new payment feature', 
         'high', 
         CURRENT_DATE + INTERVAL '2 days', 
         'assigned', 
         (SELECT id FROM users WHERE username = 'manager'), 
         0)
      ON CONFLICT DO NOTHING;
    `)

    console.log("Tables created and seeded successfully")
  } catch (err) {
    console.error("Error creating tables:", err)
    throw err
  }
}

module.exports = createTables

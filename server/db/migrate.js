const { query } = require("./sql")
const bcrypt = require("bcrypt")

const createTables = async () => {
  try {
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
        (SELECT id FROM users WHERE username = 'employee'),
        'Sarah', 'Connor', 'sarah.connor@example.com',
        'Software Engineer', 'IT', '2024-03-15', 65000.00
      ON CONFLICT (email) DO NOTHING;
    `)

    // Insert default shifts for employees
    await query(`
      INSERT INTO shifts (employee_id, start_time, end_time, days)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '09:00', '17:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), '08:30', '16:30', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
        ((SELECT id FROM employees WHERE email = 'bob.manager@example.com'), '09:00', '17:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
      ON CONFLICT (employee_id) DO NOTHING;
    `)

    // Insert attendance records
    await query(`
      INSERT INTO attendance (employee_id, date, check_in, check_out, status, hours_worked, is_late)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '2024-04-01', '2024-04-01 09:00:00', '2024-04-01 17:00:00', 'check-out', 8.0, FALSE),
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '2024-04-02', '2024-04-02 09:15:00', '2024-04-02 17:15:00', 'check-out', 8.0, TRUE),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), '2024-04-01', '2024-04-01 09:00:00', '2024-04-01 17:00:00', 'check-out', 8.0, TRUE)
      ON CONFLICT (employee_id, date) DO NOTHING;
    `)

    // Insert leave records
    await query(`
      INSERT INTO leaves (employee_id, start_date, end_date, reason, status)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '2024-04-05', '2024-04-07', 'Sick leave', 'approved'),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), '2024-04-10', '2024-04-12', 'Vacation', 'pending')
      ON CONFLICT (employee_id, start_date) DO NOTHING;
    `)

    // Insert performance evaluations
    await query(`
      INSERT INTO performance (employee_id, evaluation_date, rating, comments, evaluated_by)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), '2024-03-30', 4, 'Good performance overall', (SELECT id FROM users WHERE username = 'manager')),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), '2024-03-30', 5, 'Excellent performance', (SELECT id FROM users WHERE username = 'manager'))
      ON CONFLICT (employee_id, evaluation_date) DO NOTHING;
    `)

    // Insert salary records
    await query(`
      INSERT INTO salaries (employee_id, month, year, base_amount, total_amount, status)
      VALUES
        ((SELECT id FROM employees WHERE email = 'john.employee@example.com'), 4, 2024, 60000.00, 60000.00, 'pending'),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), 4, 2024, 65000.00, 65000.00, 'pending')
      ON CONFLICT (employee_id, month, year) DO NOTHING;
    `)

    // Insert notifications
    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES
        ((SELECT id FROM users WHERE username = 'employee'), 'Attendance Reminder', 'Please check in for today', 'reminder'),
        ((SELECT id FROM users WHERE username = 'manager'), 'Performance Review', 'Your performance review is ready', 'alert')
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
         NOW() + INTERVAL '3 days', 
         'assigned', 
         (SELECT id FROM users WHERE username = 'manager'), 
         0),
        ((SELECT id FROM employees WHERE email = 'sarah.connor@example.com'), 
         'Fix Login Bug', 
         'Investigate and fix the login issue reported by users', 
         'high', 
         NOW() + INTERVAL '1 day', 
         'in_progress', 
         (SELECT id FROM users WHERE username = 'manager'), 
         3600)
      ON CONFLICT DO NOTHING;
    `)

    console.log("Tables created and seeded successfully")
  } catch (err) {
    console.error("Error creating tables:", err)
    throw err
  }
}

module.exports = createTables

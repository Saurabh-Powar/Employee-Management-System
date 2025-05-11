const { pool, query } = require("./sql")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcrypt")

// Function to check if a table exists
const tableExists = async (tableName) => {
  try {
    const result = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName],
    )
    return result.rows[0].exists
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error.message)
    return false
  }
}

// Function to create tables
const createTables = async () => {
  let client = null

  try {
    client = await pool.connect()
    await client.query("BEGIN")

    console.log("Checking and creating database tables...")

    // Create users table if it doesn't exist
    const usersExists = await tableExists("users")
    if (!usersExists) {
      console.log("Creating users table...")
      await client.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(100) UNIQUE,
          role VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP
        )
      `)

      // Create default users
      const adminPassword = await bcrypt.hash("admin123", 10)
      const managerPassword = await bcrypt.hash("manager123", 10)
      const employeePassword = await bcrypt.hash("employee123", 10)

      await client.query(
        `
        INSERT INTO users (username, password, email, role) VALUES
        ('admin', $1, 'admin@example.com', 'admin'),
        ('manager', $2, 'manager@example.com', 'manager'),
        ('employee', $3, 'employee@example.com', 'employee')
      `,
        [adminPassword, managerPassword, employeePassword],
      )

      console.log("Created users table with default users")
    }

    // Create departments table if it doesn't exist
    const departmentsExists = await tableExists("departments")
    if (!departmentsExists) {
      console.log("Creating departments table...")
      await client.query(`
        CREATE TABLE departments (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create default departments
      await client.query(`
        INSERT INTO departments (name, description) VALUES
        ('HR', 'Human Resources Department'),
        ('IT', 'Information Technology Department'),
        ('Finance', 'Finance and Accounting Department'),
        ('Marketing', 'Marketing and Sales Department')
      `)

      console.log("Created departments table with default departments")
    }

    // Create employees table if it doesn't exist
    const employeesExists = await tableExists("employees")
    if (!employeesExists) {
      console.log("Creating employees table...")
      await client.query(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          email VARCHAR(100),
          phone VARCHAR(20),
          address TEXT,
          department_id INTEGER REFERENCES departments(id),
          position VARCHAR(100),
          hire_date DATE,
          role VARCHAR(20),
          manager_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create default employees
      await client.query(`
        INSERT INTO employees (user_id, first_name, last_name, email, phone, department_id, position, hire_date, role) VALUES
        (1, 'Admin', 'User', 'admin@example.com', '123-456-7890', 1, 'System Administrator', '2023-01-01', 'admin'),
        (2, 'Manager', 'User', 'manager@example.com', '123-456-7891', 2, 'IT Manager', '2023-01-15', 'manager'),
        (3, 'Employee', 'User', 'employee@example.com', '123-456-7892', 2, 'Software Developer', '2023-02-01', 'employee')
      `)

      console.log("Created employees table with default employees")
    }

    // Create attendance table if it doesn't exist
    const attendanceExists = await tableExists("attendance")
    if (!attendanceExists) {
      console.log("Creating attendance table...")
      await client.query(`
        CREATE TABLE attendance (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          date DATE NOT NULL,
          check_in_time TIMESTAMP,
          check_out_time TIMESTAMP,
          work_hours NUMERIC(5,2),
          overtime_hours NUMERIC(5,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'present',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created attendance table")
    }

    // Create leaves table if it doesn't exist
    const leavesExists = await tableExists("leaves")
    if (!leavesExists) {
      console.log("Creating leaves table...")
      await client.query(`
        CREATE TABLE leaves (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          type VARCHAR(50) NOT NULL,
          reason TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          approved_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created leaves table")
    }

    // Create tasks table if it doesn't exist
    const tasksExists = await tableExists("tasks")
    if (!tasksExists) {
      console.log("Creating tasks table...")
      await client.query(`
        CREATE TABLE tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          employee_id INTEGER REFERENCES employees(id),
          assigned_by INTEGER,
          due_date DATE,
          priority VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created tasks table")
    }

    // Create shifts table if it doesn't exist
    const shiftsExists = await tableExists("shifts")
    if (!shiftsExists) {
      console.log("Creating shifts table...")
      await client.query(`
        CREATE TABLE shifts (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          days TEXT[] NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create default shifts
      await client.query(`
        INSERT INTO shifts (employee_id, start_time, end_time, days) VALUES
        (1, '09:00', '17:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
        (2, '09:00', '17:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
        (3, '09:00', '17:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
      `)

      console.log("Created shifts table with default shifts")
    }

    // Create salaries table if it doesn't exist
    const salariesExists = await tableExists("salaries")
    if (!salariesExists) {
      console.log("Creating salaries table...")
      await client.query(`
        CREATE TABLE salaries (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          base_salary NUMERIC(10,2) NOT NULL,
          allowances NUMERIC(10,2) DEFAULT 0,
          deductions NUMERIC(10,2) DEFAULT 0,
          effective_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create default salaries
      await client.query(`
        INSERT INTO salaries (employee_id, base_salary, allowances, effective_date) VALUES
        (1, 100000, 5000, '2023-01-01'),
        (2, 80000, 4000, '2023-01-15'),
        (3, 60000, 3000, '2023-02-01')
      `)

      console.log("Created salaries table with default salaries")
    }

    // Create salary_adjustments table if it doesn't exist
    const salaryAdjustmentsExists = await tableExists("salary_adjustments")
    if (!salaryAdjustmentsExists) {
      console.log("Creating salary_adjustments table...")
      await client.query(`
        CREATE TABLE salary_adjustments (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          date DATE NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          reason TEXT,
          type VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created salary_adjustments table")
    }

    // Create notifications table if it doesn't exist
    const notificationsExists = await tableExists("notifications")
    if (!notificationsExists) {
      console.log("Creating notifications table...")
      await client.query(`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          sender_id INTEGER,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50),
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created notifications table")
    }

    // Create performance_reviews table if it doesn't exist
    const performanceReviewsExists = await tableExists("performance_reviews")
    if (!performanceReviewsExists) {
      console.log("Creating performance_reviews table...")
      await client.query(`
        CREATE TABLE performance_reviews (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id),
          reviewer_id INTEGER REFERENCES employees(id),
          review_date DATE NOT NULL,
          performance_score INTEGER,
          strengths TEXT,
          areas_to_improve TEXT,
          comments TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created performance_reviews table")
    }

    // Create activity_logs table if it doesn't exist
    const activityLogsExists = await tableExists("activity_logs")
    if (!activityLogsExists) {
      console.log("Creating activity_logs table...")
      await client.query(`
        CREATE TABLE activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50),
          entity_id INTEGER,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created activity_logs table")
    }

    // Create user_sessions table if it doesn't exist
    const userSessionsExists = await tableExists("user_sessions")
    if (!userSessionsExists) {
      console.log("Creating user_sessions table...")
      await client.query(`
        CREATE TABLE user_sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `)

      // Create index on expire
      await client.query(`
        CREATE INDEX IDX_user_sessions_expire ON user_sessions (expire)
      `)

      console.log("Created user_sessions table")
    }

    await client.query("COMMIT")
    console.log("All database tables created successfully")
    return true
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK")
    }
    console.error("Error creating database tables:", error.message)

    if (process.env.NODE_ENV !== "production") {
      console.warn("⚠️ Continuing with limited functionality in development mode")
      return false
    }
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}

module.exports = createTables

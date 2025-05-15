const { sql } = require("./sql")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcrypt")

// Function to run migrations
const runMigrations = async () => {
  console.log("Starting database migrations...")

  try {
    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `

    // Get list of applied migrations
    const appliedMigrations = await sql`SELECT name FROM migrations`
    const appliedMigrationNames = appliedMigrations.map((m) => m.name)

    // Read migration files
    const migrationsDir = path.join(__dirname, "migrations")

    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true })
      console.log("Created migrations directory")
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort() // Ensure migrations run in alphabetical order

    // Run migrations that haven't been applied yet
    for (const migrationFile of migrationFiles) {
      if (!appliedMigrationNames.includes(migrationFile)) {
        console.log(`Applying migration: ${migrationFile}`)

        // Read migration file
        const migrationPath = path.join(migrationsDir, migrationFile)
        const migrationSql = fs.readFileSync(migrationPath, "utf8")

        // Start a transaction
        await sql.begin(async (sql) => {
          try {
            // Run the migration
            await sql.unsafe(migrationSql)

            // Record the migration
            await sql`
              INSERT INTO migrations (name)
              VALUES (${migrationFile})
            `

            console.log(`Migration ${migrationFile} applied successfully`)
          } catch (error) {
            console.error(`Error applying migration ${migrationFile}:`, error)
            throw error // This will trigger a rollback
          }
        })
      } else {
        console.log(`Migration already applied: ${migrationFile}`)
      }
    }

    console.log("Database migrations completed successfully")
  } catch (error) {
    console.error("Migration error:", error)
    process.exit(1)
  }
}

// Create initial schema and add test data
const createInitialSchema = async () => {
  try {
    // Check if any tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `

    if (tables.length === 0) {
      console.log("No tables found. Creating initial schema...")

      // Create basic schema
      await sql`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Employees table
        CREATE TABLE IF NOT EXISTS employees (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          position VARCHAR(100),
          department VARCHAR(100),
          hire_date DATE,
          manager_id INTEGER REFERENCES employees(id),
          contact_number VARCHAR(20),
          emergency_contact VARCHAR(100),
          address TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Attendance table
        CREATE TABLE IF NOT EXISTS attendance (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          clock_in TIMESTAMP,
          clock_out TIMESTAMP,
          status VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Leaves table
        CREATE TABLE IF NOT EXISTS leaves (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          reason TEXT,
          approved_by INTEGER REFERENCES employees(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Tasks table
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          due_date TIMESTAMP NOT NULL,
          priority VARCHAR(50),
          status VARCHAR(50) NOT NULL,
          completion_notes TEXT,
          completed_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Salaries table
        CREATE TABLE IF NOT EXISTS salaries (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          effective_date DATE NOT NULL,
          end_date DATE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Shifts table
        CREATE TABLE IF NOT EXISTS shifts (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          break_duration INTEGER,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Performance evaluations table
        CREATE TABLE IF NOT EXISTS performance_evaluations (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          evaluator_id INTEGER REFERENCES employees(id),
          evaluation_date DATE NOT NULL,
          rating INTEGER NOT NULL,
          comments TEXT,
          goals TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Notifications table
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          related_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX idx_employees_user_id ON employees(user_id);
        CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
        CREATE INDEX idx_attendance_date ON attendance(date);
        CREATE INDEX idx_leaves_employee_id ON leaves(employee_id);
        CREATE INDEX idx_tasks_employee_id ON tasks(employee_id);
        CREATE INDEX idx_tasks_status ON tasks(status);
        CREATE INDEX idx_salaries_employee_id ON salaries(employee_id);
        CREATE INDEX idx_shifts_employee_id ON shifts(employee_id);
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_read ON notifications(read);
      `

      console.log("Initial schema created successfully")

      // Add test users
      await addTestUsers()
    } else {
      console.log("Database already contains tables. Checking for test users...")

      // Check if test users exist
      const adminUser = await sql`SELECT * FROM users WHERE email = 'admin@example.com'`

      if (adminUser.length === 0) {
        console.log("Test users not found. Adding test users...")
        await addTestUsers()
      } else {
        console.log("Test users already exist. Skipping...")
      }
    }
  } catch (error) {
    console.error("Error creating initial schema:", error)
    throw error
  }
}

// Function to add test users and example data
const addTestUsers = async () => {
  try {
    console.log("Adding test users and example data...")

    // Hash passwords
    const saltRounds = 10
    const adminPassword = await bcrypt.hash("admin123", saltRounds)
    const managerPassword = await bcrypt.hash("manager123", saltRounds)
    const employee1Password = await bcrypt.hash("employee123", saltRounds)
    const employee2Password = await bcrypt.hash("employee123", saltRounds)

    // Insert admin user
    const [adminUser] = await sql`
      INSERT INTO users (email, password, role)
      VALUES ('admin@example.com', ${adminPassword}, 'admin')
      RETURNING id
    `
    console.log("Admin user created with email: admin@example.com and password: admin123")

    // Insert manager user
    const [managerUser] = await sql`
      INSERT INTO users (email, password, role)
      VALUES ('manager@example.com', ${managerPassword}, 'manager')
      RETURNING id
    `
    console.log("Manager user created with email: manager@example.com and password: manager123")

    // Insert employee users
    const [employee1User] = await sql`
      INSERT INTO users (email, password, role)
      VALUES ('employee1@example.com', ${employee1Password}, 'employee')
      RETURNING id
    `
    console.log("Employee user created with email: employee1@example.com and password: employee123")

    const [employee2User] = await sql`
      INSERT INTO users (email, password, role)
      VALUES ('employee2@example.com', ${employee2Password}, 'employee')
      RETURNING id
    `
    console.log("Employee user created with email: employee2@example.com and password: employee123")

    // Insert employee records
    const [adminEmployee] = await sql`
      INSERT INTO employees (user_id, first_name, last_name, position, department, hire_date)
      VALUES (${adminUser.id}, 'Admin', 'User', 'System Administrator', 'IT', '2020-01-01')
      RETURNING id
    `

    const [managerEmployee] = await sql`
      INSERT INTO employees (user_id, first_name, last_name, position, department, hire_date, manager_id)
      VALUES (${managerUser.id}, 'Manager', 'User', 'Department Manager', 'Operations', '2020-02-01', ${adminEmployee.id})
      RETURNING id
    `

    const [employee1] = await sql`
      INSERT INTO employees (user_id, first_name, last_name, position, department, hire_date, manager_id)
      VALUES (${employee1User.id}, 'John', 'Doe', 'Software Developer', 'Engineering', '2020-03-01', ${managerEmployee.id})
      RETURNING id
    `

    const [employee2] = await sql`
      INSERT INTO employees (user_id, first_name, last_name, position, department, hire_date, manager_id)
      VALUES (${employee2User.id}, 'Jane', 'Smith', 'UI/UX Designer', 'Design', '2020-04-01', ${managerEmployee.id})
      RETURNING id
    `

    // Add example attendance records
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Format dates for SQL
    const todayStr = today.toISOString().split("T")[0]
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    // Add attendance for employee1
    await sql`
      INSERT INTO attendance (employee_id, date, clock_in, clock_out, status, notes)
      VALUES 
        (${employee1.id}, ${todayStr}, ${new Date(today.setHours(9, 0, 0))}, ${new Date(today.setHours(17, 0, 0))}, 'present', 'On time'),
        (${employee1.id}, ${yesterdayStr}, ${new Date(yesterday.setHours(9, 15, 0))}, ${new Date(yesterday.setHours(17, 30, 0))}, 'present', 'Slightly late')
    `

    // Add attendance for employee2
    await sql`
      INSERT INTO attendance (employee_id, date, clock_in, clock_out, status, notes)
      VALUES 
        (${employee2.id}, ${todayStr}, ${new Date(today.setHours(8, 45, 0))}, ${new Date(today.setHours(16, 45, 0))}, 'present', 'Left early with permission'),
        (${employee2.id}, ${yesterdayStr}, ${new Date(yesterday.setHours(9, 0, 0))}, ${new Date(yesterday.setHours(17, 0, 0))}, 'present', 'Regular day')
    `

    // Add example leave requests
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const weekAfter = new Date(nextWeek)
    weekAfter.setDate(weekAfter.getDate() + 7)

    await sql`
      INSERT INTO leaves (employee_id, start_date, end_date, type, status, reason, approved_by)
      VALUES 
        (${employee1.id}, ${nextWeek.toISOString().split("T")[0]}, ${nextWeek.toISOString().split("T")[0]}, 'sick', 'approved', 'Doctor appointment', ${managerEmployee.id}),
        (${employee2.id}, ${weekAfter.toISOString().split("T")[0]}, ${new Date(weekAfter.setDate(weekAfter.getDate() + 5)).toISOString().split("T")[0]}, 'vacation', 'pending', 'Family vacation', null)
    `

    // Add example tasks
    await sql`
      INSERT INTO tasks (title, description, employee_id, due_date, priority, status)
      VALUES 
        ('Complete project documentation', 'Finalize all documentation for the client project', ${employee1.id}, ${new Date(today.setDate(today.getDate() + 3)).toISOString()}, 'high', 'in_progress'),
        ('Design new landing page', 'Create mockups for the new company website', ${employee2.id}, ${new Date(today.setDate(today.getDate() + 5)).toISOString()}, 'medium', 'not_started'),
        ('Code review', 'Review pull requests for the backend team', ${managerEmployee.id}, ${new Date(today.setDate(today.getDate() + 1)).toISOString()}, 'high', 'in_progress')
    `

    // Add example salaries
    await sql`
      INSERT INTO salaries (employee_id, amount, effective_date)
      VALUES 
        (${adminEmployee.id}, 120000.00, '2020-01-01'),
        (${managerEmployee.id}, 90000.00, '2020-02-01'),
        (${employee1.id}, 75000.00, '2020-03-01'),
        (${employee2.id}, 70000.00, '2020-04-01')
    `

    // Add example shifts
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    await sql`
      INSERT INTO shifts (employee_id, start_time, end_time, break_duration, notes)
      VALUES 
        (${employee1.id}, ${new Date(tomorrow.setHours(9, 0, 0)).toISOString()}, ${new Date(tomorrow.setHours(17, 0, 0)).toISOString()}, 60, 'Regular shift'),
        (${employee2.id}, ${new Date(tomorrow.setHours(9, 0, 0)).toISOString()}, ${new Date(tomorrow.setHours(17, 0, 0)).toISOString()}, 60, 'Regular shift'),
        (${managerEmployee.id}, ${new Date(tomorrow.setHours(8, 0, 0)).toISOString()}, ${new Date(tomorrow.setHours(16, 0, 0)).toISOString()}, 60, 'Early shift')
    `

    // Add example performance evaluations
    const lastMonth = new Date(today)
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    await sql`
      INSERT INTO performance_evaluations (employee_id, evaluator_id, evaluation_date, rating, comments, goals)
      VALUES 
        (${employee1.id}, ${managerEmployee.id}, ${lastMonth.toISOString().split("T")[0]}, 4, 'Excellent work on the client project. Consistently meets deadlines.', 'Work on communication skills and documentation.'),
        (${employee2.id}, ${managerEmployee.id}, ${lastMonth.toISOString().split("T")[0]}, 5, 'Outstanding design work. Creative and innovative solutions.', 'Take on more leadership responsibilities in the design team.')
    `

    // Add example notifications
    await sql`
      INSERT INTO notifications (user_id, type, message, read, related_id)
      VALUES 
        (${employee1User.id}, 'task', 'You have a new task assigned: Complete project documentation', false, 1),
        (${employee2User.id}, 'task', 'You have a new task assigned: Design new landing page', false, 2),
        (${managerUser.id}, 'leave_request', 'New leave request from Jane Smith pending approval', false, 2)
    `

    console.log("Example data added successfully")
  } catch (error) {
    console.error("Error adding test users:", error)
    throw error
  }
}

// Run the migrations
const initialize = async () => {
  try {
    await createInitialSchema()
    await runMigrations()
    console.log("Database initialization completed")
  } catch (error) {
    console.error("Database initialization failed:", error)
    process.exit(1)
  } finally {
    // Close the connection pool
    await sql.end()
  }
}

// Run if this script is executed directly
if (require.main === module) {
  initialize()
}

module.exports = { initialize, runMigrations, createInitialSchema }

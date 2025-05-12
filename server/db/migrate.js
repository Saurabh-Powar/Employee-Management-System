const {sql,testConnection} = require('./sql');
const fs = require('fs');
const path = require('path');

// Function to run migrations
const runMigrations = async () => {
  console.log('Starting database migrations...');
  
  try {
    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    // Get list of applied migrations
    const appliedMigrations = await sql`SELECT name FROM migrations`;
    const appliedMigrationNames = appliedMigrations.map(m => m.name);
    
    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('Created migrations directory');
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in alphabetical order
    
    // Run migrations that haven't been applied yet
    for (const migrationFile of migrationFiles) {
      if (!appliedMigrationNames.includes(migrationFile)) {
        console.log(`Applying migration: ${migrationFile}`);
        
        // Read migration file
        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // Start a transaction
        await sql.begin(async (sql) => {
          try {
            // Run the migration
            await sql.unsafe(migrationSql);
            
            // Record the migration
            await sql`
              INSERT INTO migrations (name)
              VALUES (${migrationFile})
            `;
            
            console.log(`Migration ${migrationFile} applied successfully`);
          } catch (error) {
            console.error(`Error applying migration ${migrationFile}:`, error);
            throw error; // This will trigger a rollback
          }
        });
      } else {
        console.log(`Migration already applied: ${migrationFile}`);
      }
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

// Create initial schema if database is empty
const createInitialSchema = async () => {
  try {
    // Check if any tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('No tables found. Creating initial schema...');
      
      // Create basic schema
      await sql`
        -- Users table
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Employees table
        CREATE TABLE employees (
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
        CREATE TABLE attendance (
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
        CREATE TABLE leaves (
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
        CREATE TABLE tasks (
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
        CREATE TABLE salaries (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          effective_date DATE NOT NULL,
          end_date DATE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP
        );
        
        -- Shifts table
        CREATE TABLE shifts (
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
        CREATE TABLE performance_evaluations (
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
        CREATE TABLE notifications (
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
      `;
      
      console.log('Initial schema created successfully');
      
      // Create admin user
      const hashedPassword = '$2b$10$1JlHU4vy0P6VQW9T8U5kEeUFVxaC9XnDpe8ZV.oLHxbDlbHqCCLIe'; // 'admin123'
      
      await sql`
        INSERT INTO users (email, password, role)
        VALUES ('admin@example.com', ${hashedPassword}, 'admin')
      `;
      
      console.log('Admin user created with email: admin@example.com and password: admin123');
    } else {
      console.log('Database already contains tables. Skipping initial schema creation.');
    }
  } catch (error) {
    console.error('Error creating initial schema:', error);
    throw error;
  }
};

// Run the migrations
const initialize = async () => {
  try {
    await createInitialSchema();
    await runMigrations();
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    // Close the connection pool
    await sql.end();
  }
};

// Run if this script is executed directly
if (require.main === module) {
  initialize();
}

module.exports = { initialize, runMigrations, createInitialSchema };

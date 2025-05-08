# Employee Management System

## Overview
This Employee Management System (EMS) is a full-stack application for managing employees, attendance, leave requests, performance evaluations, and salary processing.

## Features
- **User Authentication:** Secure login for employees, managers, and administrators
- **Employee Management:** Add, view, edit, and delete employee records
- **Attendance Tracking:** Clock-in, clock-out, and absence management
- **Leave Management:** Request, approve, and reject leave applications
- **Performance Evaluation:** Conduct and view performance reviews
- **Salary Management:** Calculate and process employee salaries
- **Real-time Notifications:** Get updates on important actions

## Tech Stack
- **Frontend:** React.js
- **Backend:** Node.js with Express
- **Database:** PostgreSQL
- **Authentication:** Session-based with cookies

## Installation and Setup

### Prerequisites
- Node.js (v14 or later)
- PostgreSQL (v12 or later)

### Database Setup
1. Create a new PostgreSQL database
2. Update the database connection string in `.env` file

### Server Setup
1. Navigate to the server directory: `cd server`
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`:
\`\`\`
PORT=5000
SESSION_SECRET=your_session_secret
POSTGRES_URL=postgres://username:password@localhost:5432/ems_db
CLIENT_URL=http://localhost:3000
\`\`\`
4. Start the server: `npm start`

### Client Setup
1. Navigate to the client directory: `cd client`
2. Install dependencies: `npm install`
3. Start the client: `npm start`

## User Roles
- **Admin:** Full system access
- **Manager:** Employee management, attendance approval, leave approval, performance reviews
- **Employee:** View own profile, mark attendance, request leave, view salary

## API Endpoints
- `/api/auth`: Authentication endpoints
- `/api/employees`: Employee management
- `/api/attendance`: Attendance management
- `/api/leaves`: Leave management
- `/api/performance`: Performance evaluation
- `/api/salaries`: Salary processing
- `/api/notifications`: System notifications

## Default Login Credentials
- Admin: username: `admin`, password: `admin123`
- Manager: username: `manager`, password: `manager123`
- Employee: username: `employee`, password: `employee123`
\`\`\`

Let's update the LeaveForm to handle leave requests properly:


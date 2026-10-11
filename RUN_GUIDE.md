# Project Execution Guide — Task Manager OS

This document details all requirements, commands, and steps necessary to run the project.

---

## 1. Prerequisites

Before starting, ensure the following services are installed and active on your system:

- **Node.js**: v20+ or v22 (Check with `node -v`)
- **npm**: v10+ (Check with `npm -v`)
- **MongoDB**: Active and listening on port `27017`
  - In Windows PowerShell, verify MongoDB service status:
    ```powershell
    Get-Service -Name *mongo*
    ```
  - Default URI: `mongodb://127.0.0.1:27017/workforce_os`

---

## 2. Environment Setup

Verify that `backend/.env` exists and contains the required environment variables:

File: `backend/.env`
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/workforce_os
JWT_SECRET=secret-key
JWT_EXPIRES_IN=1d
```

---

## 3. Installing Dependencies (One-time setup)

If you haven't installed dependencies or are on a fresh clone:

### Backend
```powershell
cd backend
npm install
```

### Frontend
```powershell
cd frontend
npm ci
```

---

## 4. Commands to Run the Application

You need two separate terminal windows (one for the backend, one for the frontend).

### Option A: From the Root Directory (`task-manger/`)

**Terminal 1 — Backend (Express API on Port 5000):**
```powershell
npm run backend
```

**Terminal 2 — Frontend (Vite + React on Port 5173):**
```powershell
npm run frontend
```

---

### Option B: From Individual Subdirectories

**Terminal 1 — Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
```

---

## 5. Accessing the Application

Once both servers are running:

- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:5000](http://localhost:5000)

### Demo Login Accounts

You can log in to the web interface with any of the seeded accounts:

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `john@apex.com` | `password123` |
| **Admin** | `jane@apex.com` | `password123` |
| **Manager** | `bob@apex.com` | `password123` |
| **HR** | `alice@apex.com` | `password123` |
| **Member** | `charlie@apex.com` | `password123` |

---

## 6. Additional Useful Commands

### Running Automated Integration Tests
Runs the Jest integration test suite (12 API test scenarios):
```powershell
npm test
# Or:
cd backend && npm test
```

### Resetting & Re-seeding Demo Database
> **Caution:** This will wipe and rebuild the database with default demo data.
```powershell
cd backend
npm run seed:fresh
```

### Building the Frontend for Production
```powershell
cd frontend
npm run build
```

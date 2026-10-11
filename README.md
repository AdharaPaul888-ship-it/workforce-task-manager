# Workforce & Task Manager OS

## Project Status: S4-S8 Complete

Backend API, seeded MongoDB, and React frontend are all working. **12/12 integration tests pass.** Full Docker stack available.

---

## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
cd task-manger
docker compose up -d --build      # mongodb + backend + frontend
docker compose exec -T backend node seeders/seed.js --fresh   # seed demo data
```

| Service  | URL / Port                  |
|----------|-----------------------------|
| Frontend | http://localhost:3000       |
| Backend  | http://localhost:5000/api   |
| MongoDB  | localhost:27018 (host map; containers use 27017 internally) |

> The host MongoDB port `27017` is intentionally mapped to **27018** so it doesn't clash with a
> local mongod that may already be running.

### Option B — Local (Node.js)

**Prerequisites**
- Node.js **v22** (`.nvmrc` — `nvm use`; Vite 8 will not run on Node 18)
- MongoDB on `127.0.0.1:27017`
- npm v10+

**1. Start MongoDB**
```bash
mongod --replSet rs0 --bind_ip_all
# or: docker compose up -d mongodb
```

**2. Backend**
```bash
cd backend
npm install
npm run seed:fresh    # seed demo data
npm run dev           # nodemon  (or: npm start)
# runs on http://localhost:5000
```

**3. Frontend**
```bash
cd frontend
npm install --legacy-peer-deps   # required (Tailwind 4 ↔ Vite peer conflict)
nvm use                          # Node 22
npm run dev                      # vite dev
# runs on http://localhost:3000
```

**4. Tests**
```bash
cd backend && npm test   # Jest integration tests against workforce_os_test
```

---

## 📦 Package Lists

### Backend (`package.json`)
```json
{
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "dotenv": "^18.0.7",
    "express": "^5.3.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.11.1"
  },
  "devDependencies": {
    "jest": "^30.5.2",
    "mongodb-memory-server": "^11.3.0",
    "nodemon": "^3.1.14",
    "supertest": "^7.3.1"
  }
}
```

### Frontend (`package.json`)
```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "axios": "^1.7.9",
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "react-router-dom": "^7.1.4",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2",
    "vite": "^8.3.4"
  }
}
```

> Frontend must be installed with `npm install --legacy-peer-deps` (Tailwind 4 ↔ Vite peer conflict).

---

## 📁 Project Structure

```
/task-manger/
  ├── backend/          # Express 5, CommonJS, Mongoose
  │   ├── app.js        # Main app with middleware chain
  │   ├── server.js     # Entry point with MongoDB connect + crypto fix
  │   ├── routes/       # All API routes (10 modules)
  │   ├── controllers/  # Route controllers (Org, RBAC, Tasks, Time, Leave, Dashboard, Notifications)
  │   ├── models/       # 17 Mongoose models with schemas, validation, indexes, toJSON plugin
  │   ├── middlewares/  # protect, tenantScope, authorize, errorHandler, logger
  │   ├── seeders/      # Database seeder (10 tenants, 10 users/tenant, roles, etc.)
  │   ├── utils/        # dates.js (workingDaysBetween, isoWeekStart)
  │   └── config/       # constants.js, db.js
  ├── frontend/         # Vite, React 19, TS, Tailwind 4
  │   ├── src/
  │   │   ├── context/AppContext.tsx      # AuthContext with can(perm)
  │   │   ├── components/ProtectedRoute.tsx
  │   │   ├── config/features.ts          # Feature flags for ❌ items
  │   │   ├── services/apiClient.ts       # Axios with JWT interceptors
  │   │   ├── pages/                      # 8 page components
  │   │   │   ├── Dashboard.tsx
  │   │   │   ├── Tasks.tsx
  │   │   │   ├── Leave.tsx
  │   │   │   ├── Timer.tsx
  │   │   │   ├── Org.tsx
  │   │   │   ├── Settings.tsx
  │   │   │   ├── UserWiseLog.tsx
  │   │   │   ├── Configuration.tsx
  │   │   │   └── TaskPresets.tsx
  │   │   ├── main.tsx
  │   │   ├── App.tsx                     # Router + AuthProvider + Topbar + Sidebar
  │   │   ├── index.css                   # @import "tailwindcss"; (Tailwind 4)
  │   │   └── services/apiClient.ts
  │   ├── vite.config.ts
  │   ├── package.json
  │   └── index.html
  ├── docker-compose.yml    # mongodb + backend + frontend services
  ├── backend/Dockerfile
  ├── frontend/Dockerfile
  ├── PROGRESS.md         # Sprint progress log
  └── package.json        # Root package.json
```

---

## 🗃️ Database seeding

```bash
cd backend
npm run seed:fresh   # Fresh seed with --fresh flag
# Or: node seeders/seed.js --fresh
```

Demo logins (seeded):
- **TECH-BD Super Admin**: sarah@techbd.com / password123
- **TECH-BD Admin**: mohammad@techbd.com / password123
- **TECH-BD Member**: karim@techbd.com / password123
- **APEX Super Admin**: john@apex.com / password123
- **APEX Admin**: jane@apex.com / password123
- **APEX Member**: charlie@apex.com / password123

---

## 🔧 Configuration

### Environment Variables (`backend/.env`)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/workforce_os
JWT_SECRET=secret-key
JWT_EXPIRES_IN=1d
```

### Key Settings (seeded per tenant)
- Idle threshold: 60 seconds (configurable via API)
- Working hours per day: 8 hours
- Working days: [0,1,2,3,4] (Sun-Thu for TECH-BD)
- Leave allowances: casual=10, sick=7, annual=15
- Sick certificate after: 1 day
- Monthly submission day: 25th
- Approval window day: 28th

---

## 📚 API Endpoints (S4 Complete)

### Configuration
- `GET/PUT /api/settings` - Settings (protected)
- `GET/PUT /api/tenant` - Tenant profile (protected, Super Admin X-Tenant-Id override)

### Org & RBAC
- `GET /api/org/tree` - Organization tree
- `POST/PUT/DELETE /api/org/departments/:id` - Department CRUD
- `POST /api/org/departments/:id/teams` - Add team
- `PUT/DELETE /api/org/teams/:deptId/:teamName` - Team CRUD
- `POST /api/org/users/assignment` - Assign user to dept/team/role
- `GET /api/rbac/matrix` - RBAC matrix (dynamic columns)
- `POST/PUT/DELETE /api/rbac/roles/:id` - Role CRUD

### Task Presets
- `GET/POST/PUT/DELETE /api/task-presets` - Preset CRUD + status

### Holidays & Leaves
- `GET/POST/DELETE /api/holidays` - Holiday management
- `GET/POST/DELETE /api/leaves` - Leave requests (2-stage workflow)
- `GET /api/leaves/balance` - Leave balance
- `POST /api/leaves/preview` - Preview leave working days

### Tasks
- `GET/POST/PUT/DELETE /api/tasks` - Task CRUD
- `POST /api/tasks/:id/submit` - Submit draft task
- `POST /api/tasks/submit-plan` - Submit monthly plan
- `PUT /api/tasks/:id/review` - Approve/reject task
- `PATCH /api/tasks/:id/progress` - Update progress
- `POST /api/tasks/:id/proofs` - Add proof attachments

### Time Tracker
- `GET/POST /api/time/timer` - Timer state machine
- `POST /api/time/timer/start {taskId}` - Start timer
- `POST /api/time/timer/pause` - Pause timer
- `POST /api/time/timer/resume` - Resume timer
- `POST /api/time/timer/stop {notes,location}` - Stop timer, create entry
- `POST /api/time/timer/discard` - Discard timer < 1 min
- `GET /api/time/timesheets/week?start=YYYY-MM-DD` - Weekly timesheet
- `PUT /api/time/timesheets/:id/cell {taskId, day, hours}` - Cell adjustment
- `POST /api/time/timesheets/:id/submit` - Submit timesheet
- `GET /api/time/timesheets?status=Submitted` - Team timesheets
- `POST /api/time/timesheets/:id/approve {action,remarks}` - Approve/flag
- `GET/POST/DELETE /api/time/entries` - Time entries

### User-wise Log
- `GET /api/reports/user-log?userId&from&to&status&category&page` - User log table
- `GET /api/reports/user-log/export?...` - CSV export

### Dashboard
- `GET /api/dashboard/stats?view=my|team` - Dashboard stats
- `GET /api/dashboard/member/:userId` - Member detail

### Notifications & badges
- `GET /api/notifications` - List notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `GET /api/me/badges` - Sidebar badges `{ leavesPending, myOpenTasks, timer }`
- `GET/POST /api/auth/login` - Login (public); `GET/PUT /api/auth/me` - Profile

---

## ⚠️ Known Issues & Notes

### Docker
- Host MongoDB port `27017` is remapped to **27018** to avoid clashing with a local mongod.
- Images use `node:22-slim`; frontend install uses `--legacy-peer-deps` (Tailwind 4 ↔ Vite peer conflict).
- Backend image is seeded separately: `docker compose exec -T backend node seeders/seed.js --fresh`.

### Backend
- Local runs expect MongoDB on `127.0.0.1:27017` (env `MONGO_URI`, see `backend/.env.example`).
- Password comparison uses simple string equality (bcrypt hashing skipped).
- `global.crypto` fix applied in `server.js`, seeders, and tests for the MongoDB driver.
- **Jest quirk:** under Jest's CJS sandbox the driver's dynamic `import('os')` fails, breaking the
  handshake (`Missing required sub-document 'driver'…`). Tests pass
  `runtimeAdapters: { os: require("os") }` to `mongoose.connect` to work around it.

### Frontend
- `npm install --legacy-peer-deps` required (Tailwind 4 ↔ Vite peer conflict); `vite@8` needs **Node ≥ 20.19**
  (system Node 18 is too old — use `nvm use`, `.nvmrc` = 22).
- `tsc --noEmit` and `vite build` both pass.
- API base: `http://localhost:5000/api/...`; JWT stored in `localStorage` as `token`.

### RBAC & Tenant Scope
- Every list endpoint calls `scopeUserIds(req)` to filter by user scope
- Scopes: `self` (own only), `team` (own + team members), `department` (all in dept), `tenant` (all users)
- Super Admin can override tenant via `X-Tenant-Id` header
- Other roles' headers are ignored
- Super Admin role carries `["*"]`; `can()` and the RBAC matrix both treat it as a wildcard

### Tests
- `cd backend && npm test` → **12/12 integration tests pass** (auth guards, settings, org/RBAC,
  tasks CRUD, timer, user-log, notifications) against `workforce_os_test`.

---

## 👥 Demo Accounts

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Super Admin | sarah@techbd.com | password123 | TECH-BD |
| Admin | mohammad@techbd.com | password123 | TECH-BD |
| Member | karim@techbd.com | password123 | TECH-BD |
| Super Admin | john@apex.com | password123 | APEX |
| Admin | jane@apex.com | password123 | APEX |
| Member | charlie@apex.com | password123 | APEX |

---

## 📦 Docker Commands

```bash
# From task-manger directory
docker compose up -d --build        # Build + start all services
docker compose up -d                # Start (already built)
docker compose down                 # Stop all services
docker compose logs -f backend      # View logs
docker compose exec -T backend node seeders/seed.js --fresh   # Re-seed demo data
docker compose ps                   # Status (all should be "healthy")
```

---

## 📊 Sprint Progress (PROGRESS.md)

S0-S8: ✅ All done (see `PROGRESS.md`; checkboxes ticked in `.claude/plan/06-phases.md`)
Tests: 12/12 green · Docs: this README · Docker: 3-container stack healthy
Backlog: Monthly Planning, HR & Attendance, Approvals & Reviews, Payroll, Analytics
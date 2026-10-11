import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./context/AppContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ComingSoon from "./components/ComingSoon";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Attendance from "./pages/Attendance";
import Timer from "./pages/Timer";

const navItems = [
  { to: "/dashboard", label: "Dashboard", dot: "bg-emerald-500" },
  { to: "/tasks", label: "Task Management", dot: "bg-purple-500", tasks: true },
  { to: "/attendance", label: "Attendance Management", dot: "bg-amber-500" },
  { to: "/timer", label: "Time Tracking", dot: "bg-blue-500", timer: true },
];

const Sidebar = () => {
  const { badges, can } = useAuth();
  return (
    <nav className="fixed top-0 left-0 h-full w-64 border-r bg-white p-4 overflow-y-auto">
      <h2 className="text-sm font-bold mb-6 uppercase tracking-wide">Workforce OS</h2>
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded hover:bg-gray-100 ${
                  isActive ? "bg-gray-100 font-medium" : ""
                }`
              }
            >
              <span className={`w-3 h-3 rounded-full ${item.dot} mr-3`}></span>
              <span>{item.label}</span>
              {item.timer && badges.timer.running && (
                <span className="ml-auto text-xs bg-green-200 rounded px-2">
                  {Math.floor(badges.timer.accumulatedSeconds / 60)}m
                </span>
              )}
              {item.tasks && badges.myOpenTasks > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white rounded px-2">
                  {badges.myOpenTasks}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      {!can("settings.manage") && (
        <p className="mt-6 text-xs text-gray-400 px-3">
          Some modules are hidden until you sign in with the right role.
        </p>
      )}
    </nav>
  );
};

const Topbar = () => {
  const { user, badges, refreshBadges } = useAuth();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="fixed top-0 left-64 right-0 z-10 flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-lg font-medium">Workforce & Task Manager OS</span>
        <button
          onClick={refreshBadges}
          className="relative text-gray-500 hover:text-gray-700"
          title="Refresh notifications"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {badges.leavesPending > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-xs text-white rounded w-4 h-4 flex items-center justify-center">
              {badges.leavesPending}
            </span>
          )}
        </button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">
          {user?.name}
          <span className="ml-2 text-xs text-gray-400">{user?.role}</span>
        </span>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">
          Logout
        </button>
      </div>
    </div>
  );
};

const MainLayout = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <Sidebar />
      <main className="ml-64 pt-16 p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/timer" element={<Timer />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/forbidden"
            element={
              <div className="min-h-screen flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold mb-2">403 — Forbidden</h1>
                <p className="text-gray-500">You don't have permission to view this page.</p>
                <NavLink to="/dashboard" className="mt-4 text-blue-600 underline">
                  Back to Dashboard
                </NavLink>
              </div>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

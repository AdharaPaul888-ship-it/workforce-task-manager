import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AppContext";
import { apiClient } from "../services/apiClient";

const DEMO_ACCOUNTS = [
  { email: "sarah@techbd.com", label: "TECH-BD Super Admin" },
  { email: "mohammad@techbd.com", label: "TECH-BD Admin" },
  { email: "karim@techbd.com", label: "TECH-BD Member" },
  { email: "john@apex.com", label: "APEX Super Admin" },
  { email: "jane@apex.com", label: "APEX Admin" },
  { email: "charlie@apex.com", label: "APEX Member" },
];

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser, setPermissions } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const resp = await apiClient.post("/auth/login", { email, password });
      const { token, user } = resp.data.data;
      localStorage.setItem("token", token);

      const me = await apiClient.get("/auth/me");
      const profile = me.data.data;
      setUser(profile);
      setPermissions(profile.permissions || []);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Login failed. Check that the backend is running.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Workforce & Task Manager OS</h2>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Login"}
          </button>
        </form>

        <div className="mt-6 border-t pt-4">
          <p className="text-xs text-gray-500 mb-2">
            Demo accounts (password: <code>password123</code>) — click to fill:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("password123");
                }}
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 text-left"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

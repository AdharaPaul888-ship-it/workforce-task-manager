import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AppContext";
import { getDashboardStats } from "../services/apiClient";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const resp = await getDashboardStats({ view: "my" });
        setStats(resp.data.data);
        setError("");
      } catch (err: any) {
        console.error("Failed to load dashboard stats:", err);
        setError(err?.response?.data?.message || "Failed to load dashboard stats");
      }
      setLoading(false);
    };
    loadStats();
  }, [user]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-2">
      <h1 className="text-2xl font-bold mb-6">Dashboard — My</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Hours Logged (this week)</h3>
              <p className="text-2xl font-bold">{stats.hoursLogged}h</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Target</h3>
              <p className="text-2xl font-bold">{stats.targetHours}h</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Fulfillment</h3>
              <p className="text-2xl font-bold">{stats.fulfillment}%</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Task Progress</h3>
              <p className="text-2xl font-bold">{stats.taskProgress}%</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Net Salary (est.)</h3>
              <p className="text-2xl font-bold">${stats.netSalary}</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="text-sm text-gray-500">Today's Focus</h3>
              <p className="text-gray-700">{stats.todayFocus}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

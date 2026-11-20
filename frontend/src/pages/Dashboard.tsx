import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AppContext";
import { getDashboardStats } from "../services/apiClient";
import { Link } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"workforce" | "my">("workforce");

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const resp = await getDashboardStats();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading workforce dashboard...</span>
      </div>
    );
  }

  const {
    employeeCount = 0,
    activeTasks = { active: 0, completed: 0, total: 0, progress: 0, recent: [] },
    attendanceSummary = { date: "", present: 0, late: 0, absent: 0, onLeave: 0, clockedInNow: 0 },
    payrollOverview = { totalMonthlyPayroll: 0, avgSalary: 0, maxSalary: 0, currency: "USD" },
    workforceStatistics = { departments: [], totalWorkforce: 0, clockedInNow: 0, onLeaveToday: 0 },
    myStats = { hoursLogged: 0, targetHours: 40, fulfillment: 0, activeTasks: 0, completedTasks: 0, taskProgress: 0, netSalary: 15000, attendanceToday: "Present" }
  } = stats || {};

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-blue-500/30 text-blue-100 text-xs uppercase px-2.5 py-1 rounded-full font-semibold tracking-wider">
            Module 1 — Dashboard Management
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">Workforce Operations & Monitoring</h1>
          <p className="text-blue-100 text-sm mt-1">
            Real-time workforce intelligence, employee attendance, active tasks, and payroll metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("workforce")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "workforce"
                ? "bg-white text-blue-900 shadow-sm"
                : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            Workforce Overview
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "my"
                ? "bg-white text-blue-900 shadow-sm"
                : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            My Workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* WORKFORCE OVERVIEW (THE 5 CORE FUNCTIONAL REQUIREMENTS) */}
      {activeTab === "workforce" && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards: Requirements 1, 2, 3, 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Employee Count */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  1. Employee Count
                </span>
                <span className="text-xl">👥</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{employeeCount}</div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                <span>{workforceStatistics.clockedInNow || 0} clocked in right now</span>
              </div>
            </div>

            {/* 2. Active Tasks */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  2. Active Tasks
                </span>
                <span className="text-xl">📋</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{activeTasks.active}</div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Completed: {activeTasks.completed}</span>
                  <span>{activeTasks.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${activeTasks.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 3. Attendance Summary */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  3. Attendance Summary
                </span>
                <span className="text-xl">⏱️</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 text-emerald-600">
                {attendanceSummary.present} <span className="text-sm font-normal text-gray-500">Present</span>
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">
                  Late: {attendanceSummary.late}
                </span>
                <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                  Absent: {attendanceSummary.absent}
                </span>
                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                  Leave: {attendanceSummary.onLeave}
                </span>
              </div>
            </div>

            {/* 4. Payroll Overview */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                  4. Payroll Overview
                </span>
                <span className="text-xl">💳</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                ${Number(payrollOverview.totalMonthlyPayroll).toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Avg: ${Number(payrollOverview.avgSalary).toLocaleString()}/mo</span>
                <span className="text-emerald-600 font-medium">On Schedule</span>
              </div>
            </div>
          </div>

          {/* Detailed Sections: 5. Workforce Statistics & Active Tasks Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workforce Statistics (Departments Distribution) */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>📊</span> 5. Workforce Statistics
                </h3>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                  {workforceStatistics.departments?.length || 0} Depts
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Distribution of workforce personnel across organizational departments.
              </p>

              <div className="space-y-3">
                {workforceStatistics.departments?.map((dept: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-700">{dept.department || "General"}</span>
                      <span className="text-gray-500">
                        {dept.count} members ({dept.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          idx % 4 === 0
                            ? "bg-blue-500"
                            : idx % 4 === 1
                            ? "bg-indigo-500"
                            : idx % 4 === 2
                            ? "bg-purple-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(10, dept.percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {(!workforceStatistics.departments || workforceStatistics.departments.length === 0) && (
                  <p className="text-xs text-gray-400 py-4 text-center">No department statistics available</p>
                )}
              </div>

              {/* Workforce Status Summary */}
              <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center text-xs">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-gray-400">Total Headcount</div>
                  <div className="text-lg font-bold text-gray-800">{employeeCount}</div>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <div className="text-blue-500">Clocked In Now</div>
                  <div className="text-lg font-bold text-blue-700">{workforceStatistics.clockedInNow || 0}</div>
                </div>
              </div>
            </div>

            {/* Active Tasks & Real-time Progress (Requirement 2 Extended) */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>📌</span> Active Tasks & Deliverables
                </h3>
                <Link
                  to="/time"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                >
                  Go to Time Tracker →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Assignee</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeTasks.recent && activeTasks.recent.length > 0 ? (
                      activeTasks.recent.map((task: any) => (
                        <tr key={task._id || task.id} className="hover:bg-gray-50/60">
                          <td className="py-3 px-3 font-medium text-gray-800">
                            {task.title}
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            {task.owner?.name || "Team Member"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.priority === "High" || task.priority === "Urgent"
                                  ? "bg-red-50 text-red-700"
                                  : task.priority === "Medium"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {task.priority || "Normal"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                task.status === "Approved"
                                  ? "bg-green-50 text-green-700"
                                  : task.status === "Submitted"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {task.status || "In Progress"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-400">
                          No active tasks registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Attendance Breakdown Bar (Requirement 3 Detail) */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-700">Today's Attendance Rate</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {employeeCount > 0 ? Math.round((attendanceSummary.present / employeeCount) * 100) : 0}% Present
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${employeeCount > 0 ? (attendanceSummary.present / employeeCount) * 100 : 0}%`
                    }}
                    title={`Present: ${attendanceSummary.present}`}
                  ></div>
                  <div
                    className="bg-amber-400 h-full"
                    style={{
                      width: `${employeeCount > 0 ? (attendanceSummary.late / employeeCount) * 100 : 0}%`
                    }}
                    title={`Late: ${attendanceSummary.late}`}
                  ></div>
                  <div
                    className="bg-purple-400 h-full"
                    style={{
                      width: `${employeeCount > 0 ? (attendanceSummary.onLeave / employeeCount) * 100 : 0}%`
                    }}
                    title={`Leave: ${attendanceSummary.onLeave}`}
                  ></div>
                  <div
                    className="bg-red-400 h-full"
                    style={{
                      width: `${employeeCount > 0 ? (attendanceSummary.absent / employeeCount) * 100 : 0}%`
                    }}
                    title={`Absent: ${attendanceSummary.absent}`}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present ({attendanceSummary.present})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span> Late ({attendanceSummary.late})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span> Leave ({attendanceSummary.onLeave})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span> Absent ({attendanceSummary.absent})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MY WORKSPACE / PERSONAL VIEW */}
      {activeTab === "my" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Hours Logged (Total)</span>
              <div className="text-3xl font-bold text-blue-600 mt-1">{myStats.hoursLogged}h</div>
              <p className="text-xs text-gray-400 mt-1">Based on recorded task timers</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Weekly Target</span>
              <div className="text-3xl font-bold text-gray-800 mt-1">{myStats.targetHours}h</div>
              <p className="text-xs text-gray-400 mt-1">Standard weekly requirement</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Work Fulfillment</span>
              <div className="text-3xl font-bold text-emerald-600 mt-1">{myStats.fulfillment}%</div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, myStats.fulfillment)}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Estimated Base Salary</span>
              <div className="text-3xl font-bold text-purple-600 mt-1">
                ${Number(myStats.netSalary).toLocaleString()}
              </div>
              <p className="text-xs text-gray-400 mt-1">Status: Active Payroll</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">Need to record your working hours?</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Start a live timer on your assigned tasks or view your weekly timesheet.
              </p>
            </div>
            <Link
              to="/time"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
            >
              Open Time Tracker & Timesheets
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

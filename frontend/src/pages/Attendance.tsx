import React, { useEffect, useState } from "react";
import { apiClient } from "../services/apiClient";
import { useAuth } from "../context/AppContext";

interface AttendanceRecord {
  _id: string;
  userName?: string;
  user?: {
    name: string;
    email: string;
    department?: string;
    role?: string;
    empCode?: string;
  };
  date: string;
  clockIn?: string;
  clockOut?: string;
  durationMinutes?: number;
  status: "Present" | "Late" | "Absent" | "Half-Day" | "Leave";
  location?: string;
  note?: string;
}

interface MonthlySummary {
  totalRecords: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  halfDay: number;
}

const Attendance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [summary, setSummary] = useState<MonthlySummary>({
    totalRecords: 0,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
  });

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;

      const [recordsRes, todayRes, summaryRes] = await Promise.all([
        apiClient.get("/attendance", { params }),
        apiClient.get("/attendance/today"),
        apiClient.get("/attendance/monthly-report"),
      ]);

      setRecords(recordsRes.data.data || []);
      setTodayRecord(todayRes.data.data);
      if (summaryRes.data.summary) {
        setSummary(summaryRes.data.summary);
      }
    } catch (err: any) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [filterStatus, filterFrom, filterTo]);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      setMessage("");
      const res = await apiClient.post("/attendance/check-in", { location: "Office" });
      setMessage("Checked in successfully!");
      setTodayRecord(res.data.data);
      fetchAttendance();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Check-in failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setMessage("");
      const res = await apiClient.post("/attendance/check-out");
      setMessage("Checked out successfully!");
      setTodayRecord(res.data.data);
      fetchAttendance();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Check-out failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-800 border-green-200";
      case "Late":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Absent":
        return "bg-red-100 text-red-800 border-red-200";
      case "Leave":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Half-Day":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-sm text-gray-500">
            Track daily check-ins, attendance records, and monthly statistics
          </p>
        </div>

        {/* Live Clock-in / Clock-out card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium">TODAY'S STATUS</div>
            <div className="font-semibold text-gray-800">
              {todayRecord ? (
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getStatusBadge(todayRecord.status)}`}>
                  {todayRecord.status}
                </span>
              ) : (
                <span className="text-gray-400 text-sm">Not Checked In</span>
              )}
            </div>
            {todayRecord?.clockIn && (
              <div className="text-xs text-gray-500 mt-0.5">
                In: {new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {todayRecord.clockOut && (
                  <span> • Out: {new Date(todayRecord.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!todayRecord?.clockIn ? (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Clock In"}
              </button>
            ) : !todayRecord?.clockOut ? (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Clock Out"}
              </button>
            ) : (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg font-medium border border-emerald-200">
                Shift Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="p-3 text-sm bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Present</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.present}</div>
          <div className="text-xs text-gray-400 mt-1">On-time attendances</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Late</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{summary.late}</div>
          <div className="text-xs text-gray-400 mt-1">Checked in past 9:30 AM</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Absent</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{summary.absent}</div>
          <div className="text-xs text-gray-400 mt-1">Unexcused absences</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">On Leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{summary.leave}</div>
          <div className="text-xs text-gray-400 mt-1">Approved leaves</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Total Records</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{summary.totalRecords}</div>
          <div className="text-xs text-gray-400 mt-1">Monthly log count</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Half-Day">Half-Day</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterFrom("");
                setFilterTo("");
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Attendance Records</h2>
          <span className="text-xs text-gray-500">{records.length} records shown</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading attendance data...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No attendance records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Clock In</th>
                  <th className="px-6 py-3">Clock Out</th>
                  <th className="px-6 py-3">Working Hours</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((rec) => {
                  const empName = rec.userName || rec.user?.name || "Employee";
                  const dept = rec.user?.department || "General";
                  const clockInFormatted = rec.clockIn
                    ? new Date(rec.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—";
                  const clockOutFormatted = rec.clockOut
                    ? new Date(rec.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—";
                  const hours = rec.durationMinutes
                    ? `${(rec.durationMinutes / 60).toFixed(1)} hrs`
                    : "—";

                  return (
                    <tr key={rec._id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {empName}
                        {rec.user?.empCode && (
                          <span className="block text-xs text-gray-400 font-normal">{rec.user.empCode}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{dept}</td>
                      <td className="px-6 py-4 text-gray-600">{rec.date}</td>
                      <td className="px-6 py-4 text-gray-600">{clockInFormatted}</td>
                      <td className="px-6 py-4 text-gray-600">{clockOutFormatted}</td>
                      <td className="px-6 py-4 text-gray-600">{hours}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 text-xs rounded-full font-medium border ${getStatusBadge(rec.status)}`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;

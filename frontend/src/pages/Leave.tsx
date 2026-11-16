import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AppContext";
import {
  getLeaveBalance,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveStatus,
  deleteLeaveRequest,
  previewLeave,
  getHolidays,
  createHoliday,
  deleteHoliday,
} from "../services/apiClient";

interface LeaveBalanceData {
  casualTotal: number;
  casualUsed: number;
  sickTotal: number;
  sickUsed: number;
  annualTotal: number;
  annualUsed: number;
  unpaidUsed: number;
}

interface LeaveRequestItem {
  _id: string;
  id?: string;
  applicantName?: string;
  user?: { _id: string; name: string; email: string; role: string };
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  duration?: string;
  reason?: string;
  status: "Pending Manager" | "Pending HR" | "Approved" | "Rejected";
  appliedAt?: string;
  remarks?: string;
  approvedByName?: string;
}

interface HolidayItem {
  _id: string;
  id?: string;
  title: string;
  date: string;
  type: "National" | "Religious" | "Company";
  description?: string;
  day?: string;
}

const Leave: React.FC = () => {
  const { user, refreshBadges } = useAuth();
  const [activeTab, setActiveTab] = useState<"my_leaves" | "approvals" | "holidays">("my_leaves");

  // State
  const [balance, setBalance] = useState<LeaveBalanceData | null>(null);
  const [myLeaves, setMyLeaves] = useState<LeaveRequestItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequestItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Leave Application Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    type: "Casual",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    halfDay: false,
    reason: "",
    certificate: "",
  });
  const [preview, setPreview] = useState<{ days: number; remaining: number; hasCertificate?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Approval Remarks State (keyed by leaveId)
  const [approvalRemarks, setApprovalRemarks] = useState<{ [key: string]: string }>({});

  // Add Holiday Form State
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    type: "National",
    description: "",
  });

  const canApprove =
    user?.role === "Super Admin" ||
    user?.role === "Admin" ||
    user?.role === "HR" ||
    user?.role === "Manager";

  const isAdminOrHR =
    user?.role === "Super Admin" ||
    user?.role === "Admin" ||
    user?.role === "HR";

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [balRes, leavesRes, holRes] = await Promise.all([
        getLeaveBalance(),
        getLeaveRequests({ scope: "mine" }),
        getHolidays(new Date().getFullYear()),
      ]);

      setBalance(balRes.data.data);
      setMyLeaves(leavesRes.data.data || []);
      setHolidays(holRes.data.data || []);

      if (canApprove) {
        const appRes = await getLeaveRequests({ scope: "pending" });
        setPendingApprovals(appRes.data.data || []);
      }
    } catch (err: any) {
      console.error("Error loading leave data:", err);
      setMessage({ kind: "err", text: "Failed to load leave data" });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live Preview on Form change
  useEffect(() => {
    if (!showApplyModal) return;
    const updatePreview = async () => {
      try {
        const res = await previewLeave({
          type: applyForm.type,
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          halfDay: applyForm.halfDay,
        });
        setPreview(res.data.data);
      } catch {
        setPreview(null);
      }
    };
    if (applyForm.startDate && applyForm.endDate) {
      updatePreview();
    }
  }, [applyForm.type, applyForm.startDate, applyForm.endDate, applyForm.halfDay, showApplyModal]);

  // Submit Leave Application
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.reason.trim()) {
      setMessage({ kind: "err", text: "Please provide a reason for leave." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await createLeaveRequest(applyForm);
      setMessage({ kind: "ok", text: "Leave application submitted successfully!" });
      setShowApplyModal(false);
      setApplyForm({
        type: "Casual",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        halfDay: false,
        reason: "",
        certificate: "",
      });
      refreshBadges();
      loadData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err?.response?.data?.message || "Failed to submit leave application" });
    }
    setSubmitting(false);
  };

  // Handle Approve / Reject
  const handleApprovalAction = async (id: string, status: "Approved" | "Rejected") => {
    setMessage(null);
    try {
      const remarks = approvalRemarks[id] || "";
      await updateLeaveStatus(id, { status, remarks });
      setMessage({ kind: "ok", text: `Leave request ${status.toLowerCase()} successfully!` });
      refreshBadges();
      loadData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err?.response?.data?.message || `Failed to ${status.toLowerCase()} leave` });
    }
  };

  // Delete/Cancel Leave Request
  const handleDeleteLeave = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this leave application?")) return;
    try {
      await deleteLeaveRequest(id);
      setMessage({ kind: "ok", text: "Leave application cancelled successfully." });
      loadData();
      refreshBadges();
    } catch (err: any) {
      setMessage({ kind: "err", text: err?.response?.data?.message || "Failed to cancel leave" });
    }
  };

  // Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.title.trim()) return;
    try {
      await createHoliday(holidayForm);
      setMessage({ kind: "ok", text: "Holiday added successfully!" });
      setShowHolidayModal(false);
      setHolidayForm({
        title: "",
        date: new Date().toISOString().split("T")[0],
        type: "National",
        description: "",
      });
      loadData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err?.response?.data?.message || "Failed to add holiday" });
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await deleteHoliday(id);
      setMessage({ kind: "ok", text: "Holiday deleted." });
      loadData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err?.response?.data?.message || "Failed to delete holiday" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Approved</span>;
      case "Rejected":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">Rejected</span>;
      case "Pending Manager":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Pending Manager</span>;
      case "Pending HR":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Pending HR</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-gray-500 font-medium">Loading Leave & Holiday Management...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave & Holiday Management</h1>
          <p className="text-sm text-gray-500">Track leave balances, applications, approvals, and official holidays</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowApplyModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>+ Apply for Leave</span>
          </button>
          {isAdminOrHR && (
            <button
              onClick={() => setShowHolidayModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition"
            >
              + Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center justify-between ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* 1. Leave Balances Overview Cards */}
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Casual Leave */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Casual Leave</span>
              <span className="text-xs text-gray-400 font-medium">{balance.casualTotal - balance.casualUsed} Left</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-gray-900">{balance.casualUsed}</span>
              <span className="text-sm text-gray-400">/ {balance.casualTotal} days used</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (balance.casualUsed / (balance.casualTotal || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Sick Leave */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Sick Leave</span>
              <span className="text-xs text-gray-400 font-medium">{balance.sickTotal - balance.sickUsed} Left</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-gray-900">{balance.sickUsed}</span>
              <span className="text-sm text-gray-400">/ {balance.sickTotal} days used</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (balance.sickUsed / (balance.sickTotal || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Annual Leave */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Annual Leave</span>
              <span className="text-xs text-gray-400 font-medium">{balance.annualTotal - balance.annualUsed} Left</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-gray-900">{balance.annualUsed}</span>
              <span className="text-sm text-gray-400">/ {balance.annualTotal} days used</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (balance.annualUsed / (balance.annualTotal || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Unpaid / Total Leave Taken */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Unpaid Leave</span>
              <span className="text-xs text-gray-400 font-medium">Record</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-gray-900">{balance.unpaidUsed || 0}</span>
              <span className="text-sm text-gray-400">days taken</span>
            </div>
            <p className="text-xs text-gray-400 mt-3">Calculated into monthly payroll deductions</p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab("my_leaves")}
            className={`pb-3 text-sm font-medium border-b-2 transition ${
              activeTab === "my_leaves"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            My Leave Applications ({myLeaves.length})
          </button>

          {canApprove && (
            <button
              onClick={() => setActiveTab("approvals")}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "approvals"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>Pending Approvals</span>
              {pendingApprovals.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab("holidays")}
            className={`pb-3 text-sm font-medium border-b-2 transition ${
              activeTab === "holidays"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Holidays Calendar ({holidays.length})
          </button>
        </nav>
      </div>

      {/* Tab 1: My Leave History */}
      {activeTab === "my_leaves" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Application History</h2>
            <span className="text-xs text-gray-500">Showing all submissions</span>
          </div>

          {myLeaves.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No leave applications found.</p>
              <button
                onClick={() => setShowApplyModal(true)}
                className="mt-3 text-blue-600 text-sm font-medium hover:underline"
              >
                Apply for your first leave
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Dates</th>
                    <th className="px-6 py-3">Working Days</th>
                    <th className="px-6 py-3">Reason</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Remarks / Approver</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myLeaves.map((item) => (
                    <tr key={item._id || item.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(item.startDate).toLocaleDateString()} — {new Date(item.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">{item.days} day{item.days > 1 ? "s" : ""}</td>
                      <td className="px-6 py-4 max-w-xs truncate" title={item.reason}>{item.reason || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {item.approvedByName && (
                          <div className="font-medium text-gray-700">By: {item.approvedByName}</div>
                        )}
                        {item.remarks && <div>Note: {item.remarks}</div>}
                        {!item.approvedByName && !item.remarks && "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(item.status === "Pending Manager" || item.status === "Pending HR") && (
                          <button
                            onClick={() => handleDeleteLeave(item._id || item.id!)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pending Approvals (For Managers/HR) */}
      {activeTab === "approvals" && canApprove && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Leave Requests Awaiting Approval</h2>
              <p className="text-xs text-gray-500">Review employee requests and approve or reject with comments</p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              {pendingApprovals.length} Pending
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No pending leave applications right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingApprovals.map((req) => (
                <div key={req._id || req.id} className="p-6 hover:bg-gray-50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-base">{req.applicantName || req.user?.name || "Employee"}</span>
                      <span className="text-xs text-gray-400">({req.user?.role || "Member"})</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-3">
                      <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs">{req.type} Leave</span>
                      <span>
                        📅 <strong>{new Date(req.startDate).toLocaleDateString()}</strong> to <strong>{new Date(req.endDate).toLocaleDateString()}</strong>
                      </span>
                      <span>⏱️ <strong>{req.days} working day{req.days > 1 ? "s" : ""}</strong></span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                      "{req.reason || "No reason specified"}"
                    </p>
                  </div>

                  {/* Actions & Remarks */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:w-96">
                    <input
                      type="text"
                      placeholder="Optional remarks/notes..."
                      value={approvalRemarks[req._id || req.id!] || ""}
                      onChange={(e) =>
                        setApprovalRemarks({
                          ...approvalRemarks,
                          [req._id || req.id!]: e.target.value,
                        })
                      }
                      className="px-3 py-2 text-xs border border-gray-200 rounded-lg flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovalAction(req._id || req.id!, "Approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalAction(req._id || req.id!, "Rejected")}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition shadow-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Holidays List */}
      {activeTab === "holidays" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Official Company & National Holidays</h2>
              <p className="text-xs text-gray-500">Days excluded automatically from employee leave deductions</p>
            </div>
            {isAdminOrHR && (
              <button
                onClick={() => setShowHolidayModal(true)}
                className="bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                + Add New Holiday
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holidays.map((h) => (
              <div key={h._id || h.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative group hover:border-blue-200 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        h.type === "National"
                          ? "bg-red-50 text-red-700"
                          : h.type === "Religious"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {h.type}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-2 text-base">{h.title}</h3>
                  </div>
                  {isAdminOrHR && (
                    <button
                      onClick={() => handleDeleteHoliday(h._id || h.id!)}
                      className="text-gray-300 hover:text-red-600 transition text-sm p-1"
                      title="Delete Holiday"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                  <span>📅 {new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {h.day && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{h.day}</span>}
                </div>
                {h.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{h.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Apply for Leave */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Apply for Leave</h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-4">
              {/* Leave Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Leave Type</label>
                <select
                  value={applyForm.type}
                  onChange={(e) => setApplyForm({ ...applyForm, type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Casual">Casual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Annual">Annual Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Half Day Option */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={applyForm.halfDay}
                  onChange={(e) => setApplyForm({ ...applyForm, halfDay: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="halfDay" className="text-xs text-gray-700 font-medium">
                  Half-day leave (0.5 day deduction)
                </label>
              </div>

              {/* Live Preview Calculation */}
              {preview && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-900 space-y-1">
                  <div className="flex justify-between">
                    <span>Working Days to be deducted:</span>
                    <strong className="font-bold text-sm">{preview.days} day{preview.days > 1 ? "s" : ""}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining {applyForm.type} balance after this:</span>
                    <strong>{preview.remaining} days</strong>
                  </div>
                  {preview.hasCertificate && (
                    <p className="text-amber-800 text-[11px] font-medium pt-1">
                      ⚠️ Medical certificate required for sick leave over 1 day.
                    </p>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the purpose of your leave..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Certificate URL/Note */}
              {applyForm.type === "Sick" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Medical Certificate Link / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. prescription link or doctor note reference"
                    value={applyForm.certificate}
                    onChange={(e) => setApplyForm({ ...applyForm, certificate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Holiday */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Official Holiday</h3>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Holiday Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day, Eid-ul-Fitr"
                  value={holidayForm.title}
                  onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                  <select
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="National">National</option>
                    <option value="Religious">Religious</option>
                    <option value="Company">Company</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leave;

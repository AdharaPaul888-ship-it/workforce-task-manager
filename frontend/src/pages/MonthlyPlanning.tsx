import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AppContext";
import apiClient from "../services/apiClient";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Plus,
  Search,
  Filter,
  Check,
  X,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  BarChart3,
  Layers,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  UserCheck,
} from "lucide-react";

// Types
interface ScheduleItem {
  id?: string;
  _id?: string;
  title: string;
  weekNumber: number;
  startDate?: string;
  endDate?: string;
  deliverables?: string;
  milestone?: string;
  status: "Pending" | "In Progress" | "Completed" | "Delayed";
  plannedHours: number;
  actualHours: number;
  notes?: string;
}

interface EmployeeAssignment {
  id?: string;
  _id?: string;
  employee: any;
  employeeName: string;
  employeeEmail?: string;
  roleInPlan: string;
  department?: string;
  targetHours: number;
  actualHours: number;
  assignedTasksCount: number;
  completedTasksCount: number;
  completionRate: number;
  status: "Assigned" | "In Progress" | "Completed" | "Behind Schedule";
  deliverables?: string;
  notes?: string;
}

interface MonthlyPlan {
  id: string;
  _id?: string;
  title: string;
  monthCycle: string;
  year: number;
  month: number;
  department: string;
  team?: string;
  lead?: any;
  leadName?: string;
  description?: string;
  objectives: string[];
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Draft" | "Submitted" | "Approved" | "In Progress" | "Completed" | "Rejected";
  totalPlannedHours: number;
  totalActualHours: number;
  targetBudget: number;
  actualCost: number;
  progressPercentage: number;
  schedules: ScheduleItem[];
  assignments: EmployeeAssignment[];
  submittedByName?: string;
  submittedAt?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  varianceNotes?: string;
  createdAt?: string;
}

interface PlanStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  draftPlans: number;
  submittedPlans: number;
  totalPlannedHours: number;
  totalActualHours: number;
  varianceHours: number;
  variancePercentage: number;
  totalTargetBudget: number;
  totalActualCost: number;
  avgProgress: number;
  onTrackCount: number;
  delayedCount: number;
  totalAssignments: number;
}

interface OrgMember {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  team?: string;
  designation?: string;
}

export default function MonthlyPlanning() {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<"overview" | "plans" | "schedules" | "assignments" | "tracking">("overview");
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [trackingData, setTrackingData] = useState<any[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-11");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);
  const [planFormData, setPlanFormData] = useState({
    title: "",
    monthCycle: "2026-11",
    department: "Engineering",
    team: "Backend & Cloud",
    lead: "",
    description: "",
    objectives: "",
    priority: "High" as "Low" | "Medium" | "High" | "Critical",
    targetBudget: 100000,
    totalPlannedHours: 160,
  });

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPlanForSchedule, setSelectedPlanForSchedule] = useState<MonthlyPlan | null>(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    title: "",
    weekNumber: 1,
    startDate: "",
    endDate: "",
    deliverables: "",
    milestone: "",
    status: "Pending" as "Pending" | "In Progress" | "Completed" | "Delayed",
    plannedHours: 40,
    actualHours: 0,
    notes: "",
  });

  // Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPlanForAssign, setSelectedPlanForAssign] = useState<MonthlyPlan | null>(null);
  const [assignFormData, setAssignFormData] = useState({
    employeeId: "",
    roleInPlan: "Contributor",
    targetHours: 40,
    deliverables: "",
    notes: "",
  });

  // Log Hours / Progress Modal
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedPlanForProgress, setSelectedPlanForProgress] = useState<MonthlyPlan | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<EmployeeAssignment | null>(null);
  const [progressFormData, setProgressFormData] = useState({
    actualHours: 0,
    completedTasksCount: 0,
    assignedTasksCount: 0,
    status: "In Progress" as "Assigned" | "In Progress" | "Completed" | "Behind Schedule",
    notes: "",
  });

  // Review / Remarks Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTargetPlan, setReviewTargetPlan] = useState<MonthlyPlan | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewRemarks, setReviewRemarks] = useState("");

  // Expand rows in tracking table
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, plansRes, trackingRes, membersRes] = await Promise.all([
        apiClient.get(`/monthly-plans/stats?monthCycle=${selectedMonth}`),
        apiClient.get(`/monthly-plans?monthCycle=${selectedMonth}`),
        apiClient.get(`/monthly-plans/tracking/variance?monthCycle=${selectedMonth}`),
        apiClient.get("/monthly-plans/members"),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (plansRes.data.success) setPlans(plansRes.data.data);
      if (trackingRes.data.success) setTrackingData(trackingRes.data.data);
      if (membersRes.data.success) {
        setMembers(membersRes.data.data);
        if (membersRes.data.data.length > 0 && !planFormData.lead) {
          setPlanFormData((prev) => ({ ...prev, lead: membersRes.data.data[0].id }));
        }
      }
    } catch (err: any) {
      console.error("Failed to load monthly planning data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesDept = selectedDept === "All" || plan.department === selectedDept;
      const matchesStatus = selectedStatus === "All" || plan.status === selectedStatus;
      const matchesSearch =
        !searchQuery ||
        plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (plan.leadName && plan.leadName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [plans, selectedDept, selectedStatus, searchQuery]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return ["All", ...Array.from(set)];
  }, [plans]);

  // Handlers
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanFormData({
      title: "",
      monthCycle: selectedMonth,
      department: "Engineering",
      team: "Backend & Cloud",
      lead: members[0]?.id || "",
      description: "",
      objectives: "",
      priority: "High",
      targetBudget: 100000,
      totalPlannedHours: 160,
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: MonthlyPlan) => {
    setEditingPlan(plan);
    setPlanFormData({
      title: plan.title,
      monthCycle: plan.monthCycle,
      department: plan.department,
      team: plan.team || "",
      lead: plan.lead?._id || plan.lead || "",
      description: plan.description || "",
      objectives: Array.isArray(plan.objectives) ? plan.objectives.join("\n") : "",
      priority: plan.priority,
      targetBudget: plan.targetBudget || 0,
      totalPlannedHours: plan.totalPlannedHours || 0,
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const objectivesList = planFormData.objectives
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...planFormData,
        objectives: objectivesList,
      };

      if (editingPlan) {
        await apiClient.put(`/monthly-plans/${editingPlan.id || (editingPlan as any)._id}`, payload);
      } else {
        await apiClient.post("/monthly-plans", payload);
      }

      setIsPlanModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save work plan");
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm("Are you sure you want to delete this monthly work plan?")) return;
    try {
      await apiClient.delete(`/monthly-plans/${planId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete plan");
    }
  };

  const handleStatusChange = async (plan: MonthlyPlan, newStatus: string) => {
    const planId = plan.id || (plan as any)._id;
    if (newStatus === "Approved" || newStatus === "Rejected") {
      setReviewTargetPlan(plan);
      setReviewAction(newStatus as "Approved" | "Rejected");
      setReviewRemarks("");
      setIsReviewModalOpen(true);
      return;
    }

    try {
      await apiClient.patch(`/monthly-plans/${planId}/status`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleConfirmReview = async () => {
    if (!reviewTargetPlan) return;
    const planId = reviewTargetPlan.id || (reviewTargetPlan as any)._id;
    try {
      await apiClient.patch(`/monthly-plans/${planId}/status`, {
        status: reviewAction,
        reviewRemarks,
      });
      setIsReviewModalOpen(false);
      setReviewTargetPlan(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Review action failed");
    }
  };

  // Add Schedule
  const handleOpenAddSchedule = (plan: MonthlyPlan) => {
    setSelectedPlanForSchedule(plan);
    setScheduleFormData({
      title: "",
      weekNumber: (plan.schedules?.length || 0) + 1,
      startDate: "",
      endDate: "",
      deliverables: "",
      milestone: "",
      status: "Pending",
      plannedHours: 40,
      actualHours: 0,
      notes: "",
    });
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForSchedule) return;
    const planId = selectedPlanForSchedule.id || (selectedPlanForSchedule as any)._id;
    try {
      await apiClient.post(`/monthly-plans/${planId}/schedules`, scheduleFormData);
      setIsScheduleModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add schedule item");
    }
  };

  // Add Assignment
  const handleOpenAssignModal = (plan: MonthlyPlan) => {
    setSelectedPlanForAssign(plan);
    setAssignFormData({
      employeeId: members[0]?.id || "",
      roleInPlan: "Contributor",
      targetHours: 40,
      deliverables: "",
      notes: "",
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForAssign) return;
    const planId = selectedPlanForAssign.id || (selectedPlanForAssign as any)._id;
    try {
      await apiClient.post(`/monthly-plans/${planId}/assignments`, assignFormData);
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to assign employee");
    }
  };

  // Update Progress / Log Hours
  const handleOpenProgressModal = (plan: MonthlyPlan, assignment: EmployeeAssignment) => {
    setSelectedPlanForProgress(plan);
    setSelectedAssignment(assignment);
    setProgressFormData({
      actualHours: assignment.actualHours || 0,
      completedTasksCount: assignment.completedTasksCount || 0,
      assignedTasksCount: assignment.assignedTasksCount || 5,
      status: assignment.status,
      notes: assignment.notes || "",
    });
    setIsProgressModalOpen(true);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForProgress || !selectedAssignment) return;
    const planId = selectedPlanForProgress.id || (selectedPlanForProgress as any)._id;
    const assignId = selectedAssignment.id || (selectedAssignment as any)._id;
    try {
      await apiClient.put(`/monthly-plans/${planId}/assignments/${assignId}`, progressFormData);
      setIsProgressModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update assignment progress");
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Approved</span>;
      case "In Progress":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">In Progress</span>;
      case "Completed":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Completed</span>;
      case "Submitted":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Submitted</span>;
      case "Rejected":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Draft</span>;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Critical</span>;
      case "High":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">High</span>;
      case "Medium":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Low</span>;
    }
  };

  const canManage = ["Super Admin", "Admin", "HR", "Manager"].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-cyan-100 text-cyan-700 rounded-lg">
                <Calendar className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Monthly Planning & Work Tracking</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Work plans, sprint schedules, employee assignments, and planned-versus-actual variance tracking
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5">
              <Clock className="w-4 h-4 text-gray-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="2026-10">October 2026</option>
                <option value="2026-11">November 2026 (Current)</option>
                <option value="2026-12">December 2026</option>
                <option value="2027-01">January 2027</option>
              </select>
            </div>

            <button
              onClick={fetchData}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {canManage && (
              <button
                onClick={handleOpenCreatePlan}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Work Plan</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mt-6 -mb-6 space-x-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview & Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
              activeTab === "plans"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Work Plans ({plans.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
              activeTab === "schedules"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Schedules & Sprints</span>
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
              activeTab === "assignments"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Assignments ({stats?.totalAssignments || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
              activeTab === "tracking"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Planned vs. Actual Tracker</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: OVERVIEW & ANALYTICS                                    */}
      {/* ============================================================== */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Work Plans</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPlans}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span className="text-blue-600 font-medium">{stats.activePlans} active</span>
                  <span>•</span>
                  <span className="text-purple-600 font-medium">{stats.completedPlans} completed</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned vs. Actual Hours</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">{stats.totalActualHours}h</span>
                  <span className="text-sm text-gray-500">/ {stats.totalPlannedHours}h</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-medium">
                  {stats.varianceHours <= 0 ? (
                    <span className="text-emerald-600 flex items-center">
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                      {Math.abs(stats.varianceHours)}h below planned ({stats.variancePercentage}%)
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                      +{stats.varianceHours}h overrun ({stats.variancePercentage}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Completion</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.avgProgress}%</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2.5">
                  <div
                    className="bg-cyan-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, stats.avgProgress)}%` }}
                  ></div>
                </div>
              </div>
              <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deliverable On-Track Health</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-emerald-600">{stats.onTrackCount}</span>
                  <span className="text-sm text-gray-500">on track</span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-rose-600 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 mr-0.5" />
                  <span>{stats.delayedCount} delayed / behind schedule</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Progress Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Monthly Plan Execution Status</h2>
                <span className="text-xs text-gray-500">Cycle: {selectedMonth}</span>
              </div>

              <div className="space-y-4">
                {plans.slice(0, 4).map((plan) => {
                  const planId = plan.id || (plan as any)._id;
                  const variance = (plan.totalActualHours || 0) - (plan.totalPlannedHours || 0);
                  return (
                    <div key={planId} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50/50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{plan.title}</span>
                            {renderStatusBadge(plan.status)}
                            {renderPriorityBadge(plan.priority)}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Dept: <span className="text-gray-700 font-medium">{plan.department}</span> • Lead:{" "}
                            <span className="text-gray-700 font-medium">{plan.leadName || "Not assigned"}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{plan.progressPercentage}%</span>
                          <p className="text-xs text-gray-500">
                            {plan.totalActualHours}h / {plan.totalPlannedHours}h ({variance <= 0 ? `${variance}h` : `+${variance}h`})
                          </p>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div
                          className="bg-cyan-600 h-2 rounded-full"
                          style={{ width: `${plan.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Action & Budget Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-4">Budget & Resource Overview</h2>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">Target Budget</span>
                    <span className="text-sm font-bold text-gray-900">৳{stats.totalTargetBudget?.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">Actual Expenditure</span>
                    <span className="text-sm font-bold text-emerald-600">৳{stats.totalActualCost?.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Sprints</span>
                    <span className="text-sm font-bold text-cyan-700">{plans.reduce((acc, p) => acc + (p.schedules?.length || 0), 0)} Milestones</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">Assigned Team</span>
                    <span className="text-sm font-bold text-indigo-700">{stats.totalAssignments} Members</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setActiveTab("tracking")}
                  className="w-full py-2 px-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>Open Full Variance Matrix</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: WORK PLANS LIST                                         */}
      {/* ============================================================== */}
      {activeTab === "plans" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search work plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    Dept: {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="All">Status: All</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-800">{filteredPlans.length}</span> of {plans.length} plans
            </div>
          </div>

          {/* Plans Grid */}
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">No monthly work plans found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create a new plan for {selectedMonth} or adjust your filters.
              </p>
              {canManage && (
                <button
                  onClick={handleOpenCreatePlan}
                  className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition"
                >
                  Create Plan
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredPlans.map((plan) => {
                const planId = plan.id || (plan as any)._id;
                const variance = (plan.totalActualHours || 0) - (plan.totalPlannedHours || 0);

                return (
                  <div
                    key={planId}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded">
                              {plan.monthCycle}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs font-medium text-gray-600">{plan.department}</span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 mt-1.5">{plan.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {renderStatusBadge(plan.status)}
                          {renderPriorityBadge(plan.priority)}
                        </div>
                      </div>

                      {/* Description */}
                      {plan.description && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{plan.description}</p>
                      )}

                      {/* Objectives */}
                      {plan.objectives && plan.objectives.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase">Key Objectives</p>
                          <ul className="mt-1 space-y-1">
                            {plan.objectives.slice(0, 3).map((obj, i) => (
                              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                <span className="text-cyan-500 mt-0.5">•</span>
                                <span className="line-clamp-1">{obj}</span>
                              </li>
                            ))}
                            {plan.objectives.length > 3 && (
                              <li className="text-xs text-gray-400 italic">
                                + {plan.objectives.length - 3} more objectives
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Hours & Budget metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-gray-50 rounded-lg text-center">
                        <div>
                          <p className="text-[11px] text-gray-500">Planned</p>
                          <p className="text-xs font-bold text-gray-900">{plan.totalPlannedHours}h</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500">Actual Logged</p>
                          <p className="text-xs font-bold text-gray-900">{plan.totalActualHours}h</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500">Variance</p>
                          <p
                            className={`text-xs font-bold ${
                              variance <= 0 ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {variance <= 0 ? `${variance}h` : `+${variance}h`}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Sprint Progress</span>
                          <span className="font-semibold text-gray-700">{plan.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-cyan-600 h-1.5 rounded-full"
                            style={{ width: `${plan.progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Lead & Sub-counts */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center font-bold text-[10px] text-gray-700">
                            {plan.leadName ? plan.leadName[0] : "L"}
                          </span>
                          <span>Lead: {plan.leadName || "Not assigned"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{plan.schedules?.length || 0} milestones</span>
                          <span>{plan.assignments?.length || 0} members</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5">
                        {plan.status === "Draft" && canManage && (
                          <button
                            onClick={() => handleStatusChange(plan, "Submitted")}
                            className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition"
                          >
                            Submit
                          </button>
                        )}

                        {plan.status === "Submitted" && canManage && (
                          <>
                            <button
                              onClick={() => handleStatusChange(plan, "Approved")}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusChange(plan, "Rejected")}
                              className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {plan.status === "Approved" && canManage && (
                          <button
                            onClick={() => handleStatusChange(plan, "In Progress")}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition"
                          >
                            Start Sprint
                          </button>
                        )}

                        {plan.status === "In Progress" && canManage && (
                          <button
                            onClick={() => handleStatusChange(plan, "Completed")}
                            className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition"
                          >
                            Complete Plan
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenAddSchedule(plan)}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-cyan-700 hover:bg-cyan-50 rounded transition"
                        >
                          + Milestone
                        </button>

                        <button
                          onClick={() => handleOpenAssignModal(plan)}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-cyan-700 hover:bg-cyan-50 rounded transition"
                        >
                          + Assign
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEditPlan(plan)}
                              className="p-1.5 text-gray-400 hover:text-cyan-600 transition"
                              title="Edit Plan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(planId)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition"
                              title="Delete Plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SCHEDULES & SPRINTS                                     */}
      {/* ============================================================== */}
      {activeTab === "schedules" && (
        <div className="space-y-6">
          {plans.map((plan) => {
            const planId = plan.id || (plan as any)._id;
            return (
              <div key={planId} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">{plan.title}</h3>
                      {renderStatusBadge(plan.status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {plan.department} • Lead: {plan.leadName || "N/A"}
                    </p>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleOpenAddSchedule(plan)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Milestone</span>
                    </button>
                  )}
                </div>

                {/* Schedules Table */}
                {!plan.schedules || plan.schedules.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No schedule milestones defined yet.</p>
                ) : (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50">
                          <th className="py-2.5 px-3">Week</th>
                          <th className="py-2.5 px-3">Milestone / Title</th>
                          <th className="py-2.5 px-3">Timeline</th>
                          <th className="py-2.5 px-3">Key Deliverables</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Planned</th>
                          <th className="py-2.5 px-3 text-right">Actual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {plan.schedules.map((s, idx) => (
                          <tr key={s.id || s._id || idx} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 font-semibold text-gray-700">Week {s.weekNumber}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-gray-900">{s.title}</p>
                              {s.milestone && <p className="text-[11px] text-cyan-600 font-medium">{s.milestone}</p>}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">
                              {s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"} to{" "}
                              {s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 max-w-xs truncate">{s.deliverables || "—"}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                  s.status === "Completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : s.status === "In Progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : s.status === "Delayed"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-gray-900">{s.plannedHours}h</td>
                            <td className="py-2.5 px-3 text-right font-medium text-cyan-700">{s.actualHours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: EMPLOYEE ASSIGNMENTS                                    */}
      {/* ============================================================== */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Workforce Assignments</h2>
              <p className="text-xs text-gray-500">Employee targets, actual logging, and task fulfillment</p>
            </div>
            <span className="text-xs bg-cyan-100 text-cyan-800 font-semibold px-2.5 py-1 rounded-full">
              {stats?.totalAssignments || 0} Total Assignees
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.flatMap((plan) =>
              (plan.assignments || []).map((assignment) => {
                const assignId = assignment.id || (assignment as any)._id;
                const variance = (assignment.actualHours || 0) - (assignment.targetHours || 0);

                return (
                  <div
                    key={assignId}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-sm">
                            {assignment.employeeName ? assignment.employeeName[0] : "E"}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">{assignment.employeeName}</h4>
                            <p className="text-xs text-gray-500">{assignment.roleInPlan}</p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            assignment.status === "Completed"
                              ? "bg-purple-100 text-purple-800"
                              : assignment.status === "Behind Schedule"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {assignment.status}
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-semibold text-gray-700">Plan:</span> {plan.title}
                      </div>

                      {assignment.deliverables && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                          <span className="font-medium text-gray-700">Deliverables:</span> {assignment.deliverables}
                        </p>
                      )}

                      {/* Hours & Tasks */}
                      <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 bg-gray-50/70 rounded text-center">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Hours (Act / Tgt)</p>
                          <p className="text-xs font-bold text-gray-800">
                            {assignment.actualHours}h / {assignment.targetHours}h
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Tasks (Done / All)</p>
                          <p className="text-xs font-bold text-gray-800">
                            {assignment.completedTasksCount} / {assignment.assignedTasksCount}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span className="font-bold text-cyan-700">{assignment.completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-cyan-600 h-1.5 rounded-full"
                            style={{ width: `${assignment.completionRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        Variance:{" "}
                        <strong className={variance <= 0 ? "text-emerald-600" : "text-amber-600"}>
                          {variance <= 0 ? `${variance}h` : `+${variance}h`}
                        </strong>
                      </span>

                      <button
                        onClick={() => handleOpenProgressModal(plan, assignment)}
                        className="px-2.5 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded transition"
                      >
                        Update Progress / Hours
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: PLANNED VS. ACTUAL TRACKER                              */}
      {/* ============================================================== */}
      {activeTab === "tracking" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Planned vs. Actual Work Tracking Matrix</h2>
              <p className="text-xs text-gray-500">
                Detailed variance analysis across monthly work plans and assigned team members
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-700 rounded">
                ● Green = Ahead/On Track
              </span>
              <span className="text-xs font-medium px-2 py-1 bg-amber-50 text-amber-700 rounded">
                ▲ Orange = Over Budget
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Plan & Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Planned Hours</th>
                  <th className="py-3 px-4 text-right">Actual Hours</th>
                  <th className="py-3 px-4 text-right">Variance (Hours)</th>
                  <th className="py-3 px-4 text-center">Variance %</th>
                  <th className="py-3 px-4 text-center">Health Status</th>
                  <th className="py-3 px-4 text-right">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trackingData.map((row) => {
                  const isExpanded = expandedPlanId === row.id;
                  const isPositiveVar = row.varianceHours <= 0;

                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-gray-50/70 transition cursor-pointer" onClick={() => setExpandedPlanId(isExpanded ? null : row.id)}>
                        <td className="py-3 px-4 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900 text-sm">{row.title}</p>
                          <p className="text-[11px] text-gray-500">
                            {row.department} {row.team ? `• ${row.team}` : ""} • Lead: {row.leadName || "N/A"}
                          </p>
                        </td>
                        <td className="py-3 px-4">{renderStatusBadge(row.status)}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-800">{row.plannedHours}h</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">{row.actualHours}h</td>
                        <td className={`py-3 px-4 text-right font-bold ${isPositiveVar ? "text-emerald-600" : "text-amber-600"}`}>
                          {row.varianceHours <= 0 ? `${row.varianceHours}h` : `+${row.varianceHours}h`}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-700">{row.variancePercentage}%</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              row.varianceStatus === "Ahead of Schedule" || row.varianceStatus === "On Track"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.varianceStatus === "Behind Schedule"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {row.varianceStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-cyan-700">{row.progressPercentage}%</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                              <div
                                className="bg-cyan-600 h-1.5 rounded-full"
                                style={{ width: `${row.progressPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Assignee Details */}
                      {isExpanded && row.assignments && row.assignments.length > 0 && (
                        <tr className="bg-cyan-50/30">
                          <td colSpan={9} className="py-3 px-8">
                            <div className="rounded-lg border border-cyan-100 bg-white p-4">
                              <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">
                                Member-Level Planned vs Actual Tracking Breakdown:
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {row.assignments.map((a: any) => (
                                  <div key={a.id} className="p-3 rounded border border-gray-100 bg-gray-50/50 text-xs">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-bold text-gray-900">{a.employeeName}</p>
                                        <p className="text-gray-500 text-[11px]">{a.roleInPlan}</p>
                                      </div>
                                      <span
                                        className={`font-semibold ${
                                          a.varianceHours <= 0 ? "text-emerald-600" : "text-amber-600"
                                        }`}
                                      >
                                        {a.varianceHours <= 0 ? `${a.varianceHours}h` : `+${a.varianceHours}h`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-gray-600 mt-2 text-[11px]">
                                      <span>Act: {a.actualHours}h / Tgt: {a.plannedHours}h</span>
                                      <span>Tasks: {a.completedTasks}/{a.assignedTasks}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT WORK PLAN                                 */}
      {/* ============================================================== */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPlan ? "Edit Monthly Work Plan" : "Create New Monthly Work Plan"}
              </h3>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Platform Modernization & APIs"
                  value={planFormData.title}
                  onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Month Cycle *</label>
                  <select
                    value={planFormData.monthCycle}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthCycle: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="2026-10">2026-10 (October)</option>
                    <option value="2026-11">2026-11 (November)</option>
                    <option value="2026-12">2026-12 (December)</option>
                    <option value="2027-01">2027-01 (January)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={planFormData.priority}
                    onChange={(e) => setPlanFormData({ ...planFormData, priority: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    placeholder="Engineering / Sales / HR"
                    value={planFormData.department}
                    onChange={(e) => setPlanFormData({ ...planFormData, department: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Team</label>
                  <input
                    type="text"
                    placeholder="e.g. Backend Pod"
                    value={planFormData.team}
                    onChange={(e) => setPlanFormData({ ...planFormData, team: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Lead / Manager</label>
                <select
                  value={planFormData.lead}
                  onChange={(e) => setPlanFormData({ ...planFormData, lead: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  <option value="">Select Plan Lead</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role} - {m.department || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Hours</label>
                  <input
                    type="number"
                    min="0"
                    value={planFormData.totalPlannedHours}
                    onChange={(e) => setPlanFormData({ ...planFormData, totalPlannedHours: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Budget (BDT)</label>
                  <input
                    type="number"
                    min="0"
                    value={planFormData.targetBudget}
                    onChange={(e) => setPlanFormData({ ...planFormData, targetBudget: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of this monthly focus..."
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Core Objectives (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Deliver Sprint milestone 1&#10;Reduce API latency below 100ms&#10;Complete QA integration"
                  value={planFormData.objectives}
                  onChange={(e) => setPlanFormData({ ...planFormData, objectives: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-sm transition"
                >
                  {editingPlan ? "Update Work Plan" : "Create Work Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD SCHEDULE MILESTONE                                  */}
      {/* ============================================================== */}
      {isScheduleModalOpen && selectedPlanForSchedule && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Add Schedule Milestone</h3>
                <p className="text-xs text-gray-500">{selectedPlanForSchedule.title}</p>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture & Database Design"
                  value={scheduleFormData.title}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Week Number (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={scheduleFormData.weekNumber}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, weekNumber: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={scheduleFormData.status}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, status: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={scheduleFormData.startDate}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={scheduleFormData.endDate}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Planned Hours</label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleFormData.plannedHours}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, plannedHours: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Actual Hours</label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleFormData.actualHours}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, actualHours: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Deliverables</label>
                <textarea
                  rows={2}
                  placeholder="Expected output or artifacts..."
                  value={scheduleFormData.deliverables}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, deliverables: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN EMPLOYEE                                         */}
      {/* ============================================================== */}
      {isAssignModalOpen && selectedPlanForAssign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Assign Employee to Plan</h3>
                <p className="text-xs text-gray-500">{selectedPlanForAssign.title}</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Organization Member *</label>
                <select
                  required
                  value={assignFormData.employeeId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.designation || m.role} - {m.department || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Role in Work Plan</label>
                  <input
                    type="text"
                    placeholder="e.g. Frontend Lead / Contributor"
                    value={assignFormData.roleInPlan}
                    onChange={(e) => setAssignFormData({ ...assignFormData, roleInPlan: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Hours (Monthly)</label>
                  <input
                    type="number"
                    min="0"
                    value={assignFormData.targetHours}
                    onChange={(e) => setAssignFormData({ ...assignFormData, targetHours: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Specific Deliverables</label>
                <textarea
                  rows={2}
                  placeholder="Key tasks or deliverables assigned to this employee..."
                  value={assignFormData.deliverables}
                  onChange={(e) => setAssignFormData({ ...assignFormData, deliverables: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Assign Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: UPDATE PROGRESS & HOURS                                 */}
      {/* ============================================================== */}
      {isProgressModalOpen && selectedPlanForProgress && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Update Assignment Progress</h3>
                <p className="text-xs text-gray-500">
                  {selectedAssignment.employeeName} ({selectedPlanForProgress.title})
                </p>
              </div>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProgress} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Total Actual Hours Logged (Target: {selectedAssignment.targetHours}h)
                </label>
                <input
                  type="number"
                  min="0"
                  value={progressFormData.actualHours}
                  onChange={(e) => setProgressFormData({ ...progressFormData, actualHours: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tasks Completed</label>
                  <input
                    type="number"
                    min="0"
                    value={progressFormData.completedTasksCount}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, completedTasksCount: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Total Tasks Assigned</label>
                  <input
                    type="number"
                    min="1"
                    value={progressFormData.assignedTasksCount}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, assignedTasksCount: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Assignment Status</label>
                <select
                  value={progressFormData.status}
                  onChange={(e) => setProgressFormData({ ...progressFormData, status: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Behind Schedule">Behind Schedule</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Progress Notes / Milestones Reached</label>
                <textarea
                  rows={2}
                  placeholder="Notes on current sprint status or blockers..."
                  value={progressFormData.notes}
                  onChange={(e) => setProgressFormData({ ...progressFormData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: APPROVAL / REJECTION REMARKS                            */}
      {/* ============================================================== */}
      {isReviewModalOpen && reviewTargetPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900">
              {reviewAction === "Approved" ? "Approve Monthly Plan" : "Reject Monthly Plan"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{reviewTargetPlan.title}</p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Review Remarks</label>
              <textarea
                rows={3}
                placeholder="Enter feedback or authorization notes..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReview}
                className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition ${
                  reviewAction === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm {reviewAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

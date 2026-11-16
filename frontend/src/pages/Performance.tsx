import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AppContext";
import apiClient from "../services/apiClient";
import {
  Award,
  Target,
  TrendingUp,
  BarChart2,
  MessageSquare,
  FileCheck,
  Star,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ThumbsUp,
  ShieldAlert,
  ChevronRight,
  ArrowUpRight,
  User,
  Users,
  X,
  Edit2,
  Trash2,
  Send,
  Sparkles,
  RefreshCw,
  Trophy,
} from "lucide-react";

// Types
interface Goal {
  id: string;
  _id?: string;
  employee: any;
  employeeName: string;
  department?: string;
  title: string;
  description?: string;
  category: string;
  cycle: string;
  startDate?: string;
  targetDate?: string;
  weightage: number;
  targetMetric?: string;
  currentMetric?: string;
  progress: number;
  status: "Not Started" | "In Progress" | "Achieved" | "At Risk" | "Cancelled";
  alignment?: string;
  managerNotes?: string;
  employeeNotes?: string;
}

interface KPIHistory {
  date: string;
  value: number;
  notes?: string;
  updatedByName?: string;
}

interface KPI {
  id: string;
  _id?: string;
  title: string;
  code?: string;
  description?: string;
  department: string;
  assignedToName?: string;
  category: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  calculationMethod?: string;
  status: "On Track" | "Exceeded" | "Behind" | "Critical";
  cycle?: string;
  history?: KPIHistory[];
}

interface PerformanceReview {
  id: string;
  _id?: string;
  employee: any;
  employeeName: string;
  department?: string;
  designation?: string;
  reviewer: any;
  reviewerName: string;
  cycle: string;
  status: "Draft" | "Self Review Pending" | "Manager Review Pending" | "Under Review" | "Completed";
  selfAssessment?: {
    rating?: number;
    keyAchievements?: string;
    challengesFaced?: string;
    skillsLearned?: string;
    futureAspirations?: string;
    submittedAt?: string;
  };
  managerAssessment?: {
    ratings?: {
      technicalCompetence: number;
      qualityOfWork: number;
      productivityAndTimeliness: number;
      communicationAndTeamwork: number;
      initiativeAndProblemSolving: number;
      attendanceAndDiscipline: number;
    };
    overallScore?: number;
    strengths?: string;
    areasForImprovement?: string;
    managerFeedback?: string;
    trainingRecommendations?: string;
    submittedAt?: string;
  };
  finalRating?: number;
  finalRatingLabel?: string;
  completedAt?: string;
}

interface ContinuousFeedback {
  id: string;
  _id?: string;
  fromUser: any;
  fromUserName: string;
  toUser: any;
  toUserName: string;
  type: "Praise" | "Constructive" | "1-on-1 Notes" | "General Feedback";
  category: string;
  badge: string;
  message: string;
  visibility: "Public" | "Manager & HR" | "Private";
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  createdAt?: string;
}

interface Appraisal {
  id: string;
  _id?: string;
  employee: any;
  employeeName: string;
  department?: string;
  currentDesignation?: string;
  proposedDesignation?: string;
  currentSalary: number;
  proposedSalary: number;
  incrementPercentage: number;
  bonusAmount: number;
  appraisalCycle: string;
  evaluationPeriod?: string;
  performanceScore: number;
  performanceGrade: string;
  promotionRecommended: boolean;
  promotionNotes?: string;
  status: "Draft" | "Pending HR Approval" | "Approved" | "Acknowledged" | "Rejected";
  signOff?: {
    managerSigned: boolean;
    managerSignerName?: string;
    hrSigned: boolean;
    hrSignerName?: string;
    employeeAcknowledged: boolean;
  };
}

interface PerformanceStats {
  avgScore: number;
  totalGoals: number;
  achievedGoals: number;
  inProgressGoals: number;
  atRiskGoals: number;
  goalAttainmentRate: number;
  goalCategories: Record<string, number>;
  totalKPIs: number;
  onTrackKPIs: number;
  behindKPIs: number;
  criticalKPIs: number;
  kpiHealthRate: number;
  totalReviews: number;
  completedReviews: number;
  pendingReviews: number;
  reviewCompletionRate: number;
  totalAppraisals: number;
  approvedAppraisals: number;
  promotionsRecommended: number;
  avgIncrementPct: number;
  totalFeedback: number;
  topPerformers: Array<{
    id: string;
    name: string;
    department: string;
    designation: string;
    score: number;
    label: string;
  }>;
}

interface OrgMember {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  baseSalary?: number;
}

export default function Performance() {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<"dashboard" | "goals" | "kpis" | "reviews" | "feedback" | "appraisals">("dashboard");
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kpis, setKPIs] = useState<KPI[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [feedbackList, setFeedbackList] = useState<ContinuousFeedback[]>([]);
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [employees, setEmployees] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCycle, setSelectedCycle] = useState("All");
  const [selectedDept, setSelectedDept] = useState("All");

  // Modals
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalFormData, setGoalFormData] = useState({
    employeeId: "",
    title: "",
    description: "",
    category: "Technical & Delivery",
    cycle: "Q4 2026",
    startDate: "",
    targetDate: "",
    weightage: 25,
    targetMetric: "",
    status: "In Progress" as const,
    progress: 0,
    alignment: "Company Objective: Speed & Quality",
  });

  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [kpiFormData, setKpiFormData] = useState({
    title: "",
    code: "",
    department: "Engineering",
    assignedTo: "",
    category: "Productivity",
    unit: "Percentage (%)",
    targetValue: 90,
    currentValue: 85,
    frequency: "Monthly",
    calculationMethod: "",
    description: "",
  });

  const [isKpiHistoryModalOpen, setIsKpiHistoryModalOpen] = useState(false);
  const [selectedKpiForUpdate, setSelectedKpiForUpdate] = useState<KPI | null>(null);
  const [kpiUpdateValue, setKpiUpdateValue] = useState<number>(0);
  const [kpiUpdateNotes, setKpiUpdateNotes] = useState<string>("");

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewFormData, setReviewFormData] = useState({
    employeeId: "",
    reviewerId: "",
    cycle: "Q4 2026 Review",
  });

  // Self assessment modal
  const [isSelfReviewModalOpen, setIsSelfReviewModalOpen] = useState(false);
  const [selectedReviewForSelf, setSelectedReviewForSelf] = useState<PerformanceReview | null>(null);
  const [selfFormData, setSelfFormData] = useState({
    rating: 4.5,
    keyAchievements: "",
    challengesFaced: "",
    skillsLearned: "",
    futureAspirations: "",
  });

  // Manager assessment modal
  const [isManagerReviewModalOpen, setIsManagerReviewModalOpen] = useState(false);
  const [selectedReviewForManager, setSelectedReviewForManager] = useState<PerformanceReview | null>(null);
  const [managerFormData, setManagerFormData] = useState({
    technicalCompetence: 4,
    qualityOfWork: 4,
    productivityAndTimeliness: 4,
    communicationAndTeamwork: 4,
    initiativeAndProblemSolving: 4,
    attendanceAndDiscipline: 5,
    strengths: "",
    areasForImprovement: "",
    managerFeedback: "",
    trainingRecommendations: "",
  });

  // Feedback modal
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFormData, setFeedbackFormData] = useState({
    toUserId: "",
    type: "Praise" as const,
    category: "Collaboration",
    badge: "Rockstar",
    message: "",
    visibility: "Public" as const,
  });

  // Appraisal modal
  const [isAppraisalModalOpen, setIsAppraisalModalOpen] = useState(false);
  const [appraisalFormData, setAppraisalFormData] = useState({
    employeeId: "",
    proposedDesignation: "",
    incrementPercentage: 15,
    bonusAmount: 20000,
    appraisalCycle: "Annual 2026",
    performanceScore: 4.5,
    performanceGrade: "A (Exceeds Expectations)",
    promotionRecommended: false,
    promotionNotes: "",
    remarks: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, goalsRes, kpisRes, reviewsRes, fbRes, appRes, empRes] = await Promise.all([
        apiClient.get("/performance/stats"),
        apiClient.get("/performance/goals"),
        apiClient.get("/performance/kpis"),
        apiClient.get("/performance/reviews"),
        apiClient.get("/performance/feedback"),
        apiClient.get("/performance/appraisals"),
        apiClient.get("/performance/employees"),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (goalsRes.data.success) setGoals(goalsRes.data.data);
      if (kpisRes.data.success) setKPIs(kpisRes.data.data);
      if (reviewsRes.data.success) setReviews(reviewsRes.data.data);
      if (fbRes.data.success) setFeedbackList(fbRes.data.data);
      if (appRes.data.success) setAppraisals(appRes.data.data);
      if (empRes.data.success) {
        setEmployees(empRes.data.data);
        if (empRes.data.data.length > 0) {
          setGoalFormData((prev) => ({ ...prev, employeeId: empRes.data.data[0].id }));
          setReviewFormData((prev) => ({
            ...prev,
            employeeId: empRes.data.data[0].id,
            reviewerId: user?.id || empRes.data.data[0].id,
          }));
          setFeedbackFormData((prev) => ({ ...prev, toUserId: empRes.data.data[0].id }));
          setAppraisalFormData((prev) => ({ ...prev, employeeId: empRes.data.data[0].id }));
        }
      }
    } catch (err: any) {
      console.error("Failed to load performance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for Goals
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/performance/goals", goalFormData);
      setIsGoalModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create goal");
    }
  };

  const handleUpdateGoalSlider = async (goalId: string, progress: number) => {
    try {
      await apiClient.patch(`/performance/goals/${goalId}/progress`, {
        progress,
        status: progress >= 100 ? "Achieved" : "In Progress",
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update progress");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    try {
      await apiClient.delete(`/performance/goals/${goalId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete goal");
    }
  };

  // Handlers for KPIs
  const handleSaveKPI = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/performance/kpis", kpiFormData);
      setIsKpiModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create KPI");
    }
  };

  const handleOpenKpiUpdate = (kpi: KPI) => {
    setSelectedKpiForUpdate(kpi);
    setKpiUpdateValue(kpi.currentValue);
    setKpiUpdateNotes("");
    setIsKpiHistoryModalOpen(true);
  };

  const handleSaveKpiUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKpiForUpdate) return;
    const kpiId = selectedKpiForUpdate.id || (selectedKpiForUpdate as any)._id;
    try {
      await apiClient.post(`/performance/kpis/${kpiId}/history`, {
        value: Number(kpiUpdateValue),
        notes: kpiUpdateNotes || "Updated current metric",
      });
      setIsKpiHistoryModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update KPI");
    }
  };

  // Handlers for Reviews
  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/performance/reviews", reviewFormData);
      setIsReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to initiate review");
    }
  };

  const handleOpenSelfReview = (review: PerformanceReview) => {
    setSelectedReviewForSelf(review);
    setSelfFormData({
      rating: review.selfAssessment?.rating || 4.5,
      keyAchievements: review.selfAssessment?.keyAchievements || "",
      challengesFaced: review.selfAssessment?.challengesFaced || "",
      skillsLearned: review.selfAssessment?.skillsLearned || "",
      futureAspirations: review.selfAssessment?.futureAspirations || "",
    });
    setIsSelfReviewModalOpen(true);
  };

  const handleSaveSelfReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewForSelf) return;
    const reviewId = selectedReviewForSelf.id || (selectedReviewForSelf as any)._id;
    try {
      await apiClient.put(`/performance/reviews/${reviewId}/self`, selfFormData);
      setIsSelfReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit self assessment");
    }
  };

  const handleOpenManagerReview = (review: PerformanceReview) => {
    setSelectedReviewForManager(review);
    const m = review.managerAssessment?.ratings;
    setManagerFormData({
      technicalCompetence: m?.technicalCompetence || 4,
      qualityOfWork: m?.qualityOfWork || 4,
      productivityAndTimeliness: m?.productivityAndTimeliness || 4,
      communicationAndTeamwork: m?.communicationAndTeamwork || 4,
      initiativeAndProblemSolving: m?.initiativeAndProblemSolving || 4,
      attendanceAndDiscipline: m?.attendanceAndDiscipline || 5,
      strengths: review.managerAssessment?.strengths || "",
      areasForImprovement: review.managerAssessment?.areasForImprovement || "",
      managerFeedback: review.managerAssessment?.managerFeedback || "",
      trainingRecommendations: review.managerAssessment?.trainingRecommendations || "",
    });
    setIsManagerReviewModalOpen(true);
  };

  const handleSaveManagerReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewForManager) return;
    const reviewId = selectedReviewForManager.id || (selectedReviewForManager as any)._id;
    try {
      await apiClient.put(`/performance/reviews/${reviewId}/manager`, {
        ratings: {
          technicalCompetence: managerFormData.technicalCompetence,
          qualityOfWork: managerFormData.qualityOfWork,
          productivityAndTimeliness: managerFormData.productivityAndTimeliness,
          communicationAndTeamwork: managerFormData.communicationAndTeamwork,
          initiativeAndProblemSolving: managerFormData.initiativeAndProblemSolving,
          attendanceAndDiscipline: managerFormData.attendanceAndDiscipline,
        },
        strengths: managerFormData.strengths,
        areasForImprovement: managerFormData.areasForImprovement,
        managerFeedback: managerFormData.managerFeedback,
        trainingRecommendations: managerFormData.trainingRecommendations,
      });
      setIsManagerReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit manager evaluation");
    }
  };

  // Handlers for Feedback
  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/performance/feedback", feedbackFormData);
      setIsFeedbackModalOpen(false);
      setFeedbackFormData((prev) => ({ ...prev, message: "" }));
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to post feedback");
    }
  };

  const handleAcknowledgeFeedback = async (feedbackId: string) => {
    try {
      await apiClient.patch(`/performance/feedback/${feedbackId}/acknowledge`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to acknowledge");
    }
  };

  // Handlers for Appraisals
  const handleSaveAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/performance/appraisals", appraisalFormData);
      setIsAppraisalModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create appraisal record");
    }
  };

  const handleSignOffAppraisal = async (appraisalId: string, roleType: "manager" | "hr" | "employee") => {
    try {
      await apiClient.patch(`/performance/appraisals/${appraisalId}/sign-off`, { roleType });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Sign-off failed");
    }
  };

  const canManage = ["Super Admin", "Admin", "HR", "Manager"].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-rose-100 text-rose-700 rounded-lg">
              <Trophy className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Management & Appraisals</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Employee SMART goals, department KPIs, 360° reviews, recognition feedback, and formal appraisal records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              title="Refresh Performance Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {canManage && (
              <>
                <button
                  onClick={() => setIsGoalModalOpen(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Set Goal</span>
                </button>
                <button
                  onClick={() => setIsKpiModalOpen(true)}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New KPI</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Give Kudos</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mt-6 -mb-6 space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "dashboard"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Performance Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("goals")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "goals"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Employee Goals ({goals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("kpis")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "kpis"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>KPI Tracking ({kpis.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "reviews"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Performance Reviews ({reviews.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "feedback"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Continuous Feedback ({feedbackList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("appraisals")}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "appraisals"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Appraisal Records ({appraisals.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PERFORMANCE DASHBOARD                                   */}
      {/* ============================================================== */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6">
          {/* Top 4 Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Performance Score</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-bold text-gray-900">{stats.avgScore}</h3>
                  <span className="text-xs text-gray-500">/ 5.0</span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                  <span>Exceeds Target Standard</span>
                </div>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Star className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Goal Attainment Rate</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.goalAttainmentRate}%</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span className="text-emerald-600 font-semibold">{stats.achievedGoals} achieved</span>
                  <span>•</span>
                  <span>{stats.inProgressGoals} active</span>
                </div>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
                <Target className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">KPIs On Track</p>
                <h3 className="text-2xl font-bold text-cyan-700 mt-1">{stats.kpiHealthRate}%</h3>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <span className="text-cyan-700 font-semibold">{stats.onTrackKPIs} On Track</span>
                  <span>/ {stats.totalKPIs} Total</span>
                </div>
              </div>
              <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Annual Merit Increments</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">+{stats.avgIncrementPct}%</h3>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{stats.promotionsRecommended} Promotions Recommended</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Leaderboard and Goal Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performers Leaderboard */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-gray-900">Top Performers Leaderboard</h3>
                </div>
                <span className="text-xs text-gray-400">Based on Q4 Reviews & Appraisals</span>
              </div>

              {stats.topPerformers.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No finalized performance scores yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.topPerformers.map((performer, idx) => (
                    <div
                      key={performer.id}
                      className="p-3.5 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            idx === 0
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : idx === 1
                              ? "bg-gray-200 text-gray-700"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{performer.name}</p>
                          <p className="text-xs text-gray-500">
                            {performer.designation} • {performer.department}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-rose-600 flex items-center justify-end gap-1">
                          <Star className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          {performer.score} / 5.0
                        </span>
                        <span className="text-[11px] font-medium text-emerald-600">{performer.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Goal Categories & Feedback shoutouts */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-4">Goal Strategic Alignment</h3>
                <div className="space-y-3">
                  {Object.entries(stats.goalCategories).map(([category, count]) => (
                    <div key={category} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">{category}</span>
                      <span className="text-xs font-bold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full">
                        {count} Goals
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setActiveTab("goals")}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition text-center"
                >
                  View All Employee Goals
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: EMPLOYEE GOALS (SMART GOALS)                            */}
      {/* ============================================================== */}
      {activeTab === "goals" && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search goals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none"
                />
              </div>

              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none"
              >
                <option value="All">Cycle: All</option>
                <option value="Q4 2026">Q4 2026</option>
                <option value="Annual 2026">Annual 2026</option>
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => setIsGoalModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add SMART Goal</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {goals
              .filter((g) => {
                const matchesCycle = selectedCycle === "All" || g.cycle === selectedCycle;
                const matchesSearch =
                  !searchQuery ||
                  g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  g.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCycle && matchesSearch;
              })
              .map((goal) => {
                const goalId = goal.id || (goal as any)._id;
                return (
                  <div
                    key={goalId}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 rounded">
                              {goal.category}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{goal.cycle}</span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 mt-1">{goal.title}</h3>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            goal.status === "Achieved"
                              ? "bg-emerald-100 text-emerald-800"
                              : goal.status === "At Risk"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {goal.status}
                        </span>
                      </div>

                      {goal.description && <p className="text-xs text-gray-600 mt-2">{goal.description}</p>}

                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Target Metric:</span>
                          <span className="font-semibold text-gray-900">{goal.targetMetric || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Current Progress:</span>
                          <span className="font-bold text-rose-600">{goal.currentMetric || `${goal.progress}%`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Goal Weightage:</span>
                          <span className="font-medium text-gray-700">{goal.weightage}% of review</span>
                        </div>
                      </div>

                      {/* Progress Slider */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-gray-600">Attainment Progress</span>
                          <span className="text-rose-600">{goal.progress}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={goal.progress}
                          onChange={(e) => handleUpdateGoalSlider(goalId, Number(e.target.value))}
                          className="w-full accent-rose-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-700">{goal.employeeName}</span>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleDeleteGoal(goalId)}
                          className="text-gray-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: KEY PERFORMANCE INDICATORS (KPIs)                       */}
      {/* ============================================================== */}
      {activeTab === "kpis" && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Key Performance Indicators</h2>
              <p className="text-xs text-gray-500">Quantitative benchmarks and SLA targets by department</p>
            </div>
            {canManage && (
              <button
                onClick={() => setIsKpiModalOpen(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create KPI</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {kpis.map((kpi) => {
              const kpiId = kpi.id || (kpi as any)._id;
              const isExceeded = kpi.status === "Exceeded";
              const isBehind = kpi.status === "Behind" || kpi.status === "Critical";

              return (
                <div
                  key={kpiId}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                          {kpi.code || "KPI"}
                        </span>
                        <h3 className="text-sm font-bold text-gray-900 mt-1">{kpi.title}</h3>
                        <p className="text-xs text-gray-500">{kpi.department}</p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isExceeded
                            ? "bg-purple-100 text-purple-800"
                            : kpi.status === "On Track"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {kpi.status}
                      </span>
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Current vs. Target</p>
                      <div className="flex items-baseline justify-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-gray-900">{kpi.currentValue}</span>
                        <span className="text-xs text-gray-500">/ {kpi.targetValue}</span>
                        <span className="text-xs font-semibold text-gray-600">({kpi.unit})</span>
                      </div>
                    </div>

                    {kpi.description && <p className="text-xs text-gray-600 mt-3 line-clamp-2">{kpi.description}</p>}

                    {/* Log History */}
                    {kpi.history && kpi.history.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase">Latest Entry</p>
                        <p className="text-xs text-gray-700 mt-0.5">
                          Value: <strong>{kpi.history[kpi.history.length - 1].value}</strong> —{" "}
                          {kpi.history[kpi.history.length - 1].notes || "No notes"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Freq: {kpi.frequency}</span>
                    <button
                      onClick={() => handleOpenKpiUpdate(kpi)}
                      className="px-2.5 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded transition"
                    >
                      Update Value
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: PERFORMANCE REVIEWS                                     */}
      {/* ============================================================== */}
      {activeTab === "reviews" && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Performance Review Cycles</h2>
              <p className="text-xs text-gray-500">Multi-stage 360° reviews with self-assessment & manager scoring</p>
            </div>
            {canManage && (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Initiate Review</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {reviews.map((rev) => {
              const revId = rev.id || (rev as any)._id;
              const isCompleted = rev.status === "Completed";

              return (
                <div
                  key={revId}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">{rev.employeeName}</h3>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">{rev.designation || rev.department}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 rounded">
                          {rev.cycle}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Reviewer: {rev.reviewerName}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isCompleted && rev.finalRating && (
                        <div className="text-right">
                          <span className="text-lg font-bold text-rose-600">{rev.finalRating} / 5.0</span>
                          <p className="text-[11px] text-emerald-600 font-semibold">{rev.finalRatingLabel}</p>
                        </div>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isCompleted
                            ? "bg-purple-100 text-purple-800"
                            : rev.status === "Manager Review Pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  {/* Two Column Layout: Self vs Manager */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                    {/* Self Assessment Card */}
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800 uppercase tracking-wider">Employee Self-Review</span>
                        {rev.selfAssessment?.rating ? (
                          <span className="font-bold text-cyan-700">{rev.selfAssessment.rating} / 5</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Pending Submission</span>
                        )}
                      </div>

                      {rev.selfAssessment?.keyAchievements ? (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-gray-700">
                            <strong>Key Achievements:</strong> {rev.selfAssessment.keyAchievements}
                          </p>
                          {rev.selfAssessment.challengesFaced && (
                            <p className="text-gray-600">
                              <strong>Challenges:</strong> {rev.selfAssessment.challengesFaced}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">Self-evaluation has not yet been submitted.</p>
                      )}

                      {!isCompleted && rev.status === "Self Review Pending" && (
                        <button
                          onClick={() => handleOpenSelfReview(rev)}
                          className="mt-3 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-medium transition"
                        >
                          Submit Self Assessment
                        </button>
                      )}
                    </div>

                    {/* Manager Evaluation Card */}
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800 uppercase tracking-wider">Manager Evaluation</span>
                        {rev.managerAssessment?.overallScore ? (
                          <span className="font-bold text-rose-700">{rev.managerAssessment.overallScore} / 5</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Pending Manager Rating</span>
                        )}
                      </div>

                      {rev.managerAssessment?.strengths ? (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-gray-700">
                            <strong>Strengths:</strong> {rev.managerAssessment.strengths}
                          </p>
                          <p className="text-gray-600">
                            <strong>Areas for Improvement:</strong> {rev.managerAssessment.areasForImprovement}
                          </p>
                          {rev.managerAssessment.managerFeedback && (
                            <p className="text-gray-600">
                              <strong>Feedback:</strong> {rev.managerAssessment.managerFeedback}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">Manager ratings and competency scores pending.</p>
                      )}

                      {canManage && rev.status === "Manager Review Pending" && (
                        <button
                          onClick={() => handleOpenManagerReview(rev)}
                          className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition"
                        >
                          Complete Manager Scoring
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: CONTINUOUS FEEDBACK & RECOGNITION                       */}
      {/* ============================================================== */}
      {activeTab === "feedback" && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Continuous Feedback & Peer Recognition</h2>
              <p className="text-xs text-gray-500">Real-time appreciation, 360 kudos, and core value shoutouts</p>
            </div>
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Give Feedback</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {feedbackList.map((fb) => {
              const fbId = fb.id || (fb as any)._id;
              return (
                <div
                  key={fbId}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        {fb.badge}
                      </span>
                      <span className="text-[11px] text-gray-400">{fb.type}</span>
                    </div>

                    <p className="text-xs text-gray-800 mt-3 font-normal leading-relaxed italic">
                      "{fb.message}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div>
                      <p className="font-semibold text-gray-800">{fb.toUserName}</p>
                      <p className="text-[11px] text-gray-400">from {fb.fromUserName}</p>
                    </div>

                    {!fb.isAcknowledged ? (
                      <button
                        onClick={() => handleAcknowledgeFeedback(fbId)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 transition"
                        title="Acknowledge feedback"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: APPRAISAL RECORDS                                       */}
      {/* ============================================================== */}
      {activeTab === "appraisals" && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Annual Appraisal & Increment Records</h2>
              <p className="text-xs text-gray-500">Formal evaluations, salary revisions, promotion decisions, and sign-offs</p>
            </div>
            {canManage && (
              <button
                onClick={() => setIsAppraisalModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Appraisal Record</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {appraisals.map((app) => {
              const appId = app.id || (app as any)._id;
              const isApproved = app.status === "Approved" || app.status === "Acknowledged";

              return (
                <div
                  key={appId}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">{app.employeeName}</h3>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs font-medium text-gray-700">{app.department}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                          {app.appraisalCycle}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Current: <span className="font-semibold">{app.currentDesignation}</span> → Proposed:{" "}
                        <span className="font-semibold text-emerald-700">{app.proposedDesignation || app.currentDesignation}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg">
                          Grade: {app.performanceGrade}
                        </span>
                        <p className="text-xs font-bold text-emerald-600 mt-1">+{app.incrementPercentage}% Increment</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : app.status === "Pending HR Approval"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>

                  {/* Compensation Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 p-4 bg-gray-50 rounded-lg text-xs text-center">
                    <div>
                      <p className="text-gray-500">Current Salary</p>
                      <p className="text-sm font-bold text-gray-900">৳{app.currentSalary?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Proposed Base Salary</p>
                      <p className="text-sm font-bold text-emerald-600">৳{app.proposedSalary?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Annual Bonus</p>
                      <p className="text-sm font-bold text-indigo-600">৳{app.bonusAmount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Promotion Decision</p>
                      <p className={`text-sm font-bold ${app.promotionRecommended ? "text-purple-600" : "text-gray-600"}`}>
                        {app.promotionRecommended ? "Recommended" : "Not Applicable"}
                      </p>
                    </div>
                  </div>

                  {app.promotionNotes && (
                    <p className="text-xs text-gray-600 mt-3">
                      <strong className="text-gray-800">Promotion Justification:</strong> {app.promotionNotes}
                    </p>
                  )}

                  {/* 3-Stage Sign-off Bar */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white ${
                            app.signOff?.managerSigned ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          ✓
                        </span>
                        <span className={app.signOff?.managerSigned ? "text-gray-800 font-semibold" : "text-gray-400"}>
                          Manager Approved
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white ${
                            app.signOff?.hrSigned ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          ✓
                        </span>
                        <span className={app.signOff?.hrSigned ? "text-gray-800 font-semibold" : "text-gray-400"}>
                          HR Committee Approved
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white ${
                            app.signOff?.employeeAcknowledged ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          ✓
                        </span>
                        <span
                          className={app.signOff?.employeeAcknowledged ? "text-gray-800 font-semibold" : "text-gray-400"}
                        >
                          Employee Acknowledged
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!app.signOff?.managerSigned && canManage && (
                        <button
                          onClick={() => handleSignOffAppraisal(appId, "manager")}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
                        >
                          Manager Sign-off
                        </button>
                      )}

                      {app.signOff?.managerSigned && !app.signOff?.hrSigned && canManage && (
                        <button
                          onClick={() => handleSignOffAppraisal(appId, "hr")}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition"
                        >
                          HR Approve & Execute
                        </button>
                      )}

                      {app.signOff?.hrSigned && !app.signOff?.employeeAcknowledged && (
                        <button
                          onClick={() => handleSignOffAppraisal(appId, "employee")}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition"
                        >
                          Acknowledge Appraisal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD GOAL                                                */}
      {/* ============================================================== */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Set Employee SMART Goal</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Assigned Employee *</label>
                <select
                  required
                  value={goalFormData.employeeId}
                  onChange={(e) => setGoalFormData({ ...goalFormData, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.department || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Goal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimize Database Latency < 100ms"
                  value={goalFormData.title}
                  onChange={(e) => setGoalFormData({ ...goalFormData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={goalFormData.category}
                    onChange={(e) => setGoalFormData({ ...goalFormData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Technical & Delivery">Technical & Delivery</option>
                    <option value="Leadership & Initiative">Leadership & Initiative</option>
                    <option value="Process Improvement">Process Improvement</option>
                    <option value="Customer Success">Customer Success</option>
                    <option value="Learning & Development">Learning & Development</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Review Cycle</label>
                  <input
                    type="text"
                    value={goalFormData.cycle}
                    onChange={(e) => setGoalFormData({ ...goalFormData, cycle: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Weightage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={goalFormData.weightage}
                    onChange={(e) => setGoalFormData({ ...goalFormData, weightage: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={goalFormData.targetDate}
                    onChange={(e) => setGoalFormData({ ...goalFormData, targetDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Target Quantitative Metric</label>
                <input
                  type="text"
                  placeholder="e.g. 99.9% uptime, < 5% defect rate"
                  value={goalFormData.targetMetric}
                  onChange={(e) => setGoalFormData({ ...goalFormData, targetMetric: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Goal Description & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Detailed breakdown of target expectations..."
                  value={goalFormData.description}
                  onChange={(e) => setGoalFormData({ ...goalFormData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE KPI                                              */}
      {/* ============================================================== */}
      {isKpiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Define Key Performance Indicator</h3>
              <button onClick={() => setIsKpiModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKPI} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">KPI Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Bug Resolution SLA"
                  value={kpiFormData.title}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={kpiFormData.department}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, department: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit of Measure</label>
                  <select
                    value={kpiFormData.unit}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Percentage (%)">Percentage (%)</option>
                    <option value="Count / Units">Count / Units</option>
                    <option value="Hours">Hours</option>
                    <option value="BDT / Currency ($)">BDT / Currency ($)</option>
                    <option value="Rating (1-5)">Rating (1-5)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Benchmark *</label>
                  <input
                    type="number"
                    required
                    value={kpiFormData.targetValue}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, targetValue: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Current Baseline</label>
                  <input
                    type="number"
                    value={kpiFormData.currentValue}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, currentValue: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Measurement Frequency</label>
                <select
                  value={kpiFormData.frequency}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, frequency: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annual">Annual</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKpiModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Save KPI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: UPDATE KPI METRIC                                       */}
      {/* ============================================================== */}
      {isKpiHistoryModalOpen && selectedKpiForUpdate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900">Update KPI Measurement</h3>
            <p className="text-xs text-gray-500 mt-0.5">{selectedKpiForUpdate.title}</p>

            <form onSubmit={handleSaveKpiUpdate} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  New Current Value (Target: {selectedKpiForUpdate.targetValue} {selectedKpiForUpdate.unit})
                </label>
                <input
                  type="number"
                  required
                  value={kpiUpdateValue}
                  onChange={(e) => setKpiUpdateValue(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Update Notes</label>
                <textarea
                  rows={2}
                  placeholder="Describe recent actions or measurements..."
                  value={kpiUpdateNotes}
                  onChange={(e) => setKpiUpdateNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKpiHistoryModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Update Metric
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: INITIATE REVIEW                                         */}
      {/* ============================================================== */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900">Initiate Performance Review</h3>
            <form onSubmit={handleCreateReview} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={reviewFormData.employeeId}
                  onChange={(e) => setReviewFormData({ ...reviewFormData, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation || e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Designated Reviewer</label>
                <select
                  value={reviewFormData.reviewerId}
                  onChange={(e) => setReviewFormData({ ...reviewFormData, reviewerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Appraisal Cycle</label>
                <input
                  type="text"
                  value={reviewFormData.cycle}
                  onChange={(e) => setReviewFormData({ ...reviewFormData, cycle: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition"
                >
                  Launch Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SUBMIT SELF ASSESSMENT                                  */}
      {/* ============================================================== */}
      {isSelfReviewModalOpen && selectedReviewForSelf && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900">Submit Self-Assessment</h3>
            <p className="text-xs text-gray-500 mt-0.5">{selectedReviewForSelf.cycle}</p>

            <form onSubmit={handleSaveSelfReview} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Self-Rating (1.0 to 5.0)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={selfFormData.rating}
                  onChange={(e) => setSelfFormData({ ...selfFormData, rating: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Key Achievements & Highlights *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Projects delivered, metrics improved, innovations..."
                  value={selfFormData.keyAchievements}
                  onChange={(e) => setSelfFormData({ ...selfFormData, keyAchievements: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Challenges Faced</label>
                <textarea
                  rows={2}
                  placeholder="Blockers or obstacles encountered..."
                  value={selfFormData.challengesFaced}
                  onChange={(e) => setSelfFormData({ ...selfFormData, challengesFaced: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSelfReviewModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SUBMIT MANAGER EVALUATION                               */}
      {/* ============================================================== */}
      {isManagerReviewModalOpen && selectedReviewForManager && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Manager Evaluation & Competency Scoring</h3>
            <p className="text-xs text-gray-500 mt-0.5">{selectedReviewForManager.employeeName}</p>

            <form onSubmit={handleSaveManagerReview} className="mt-4 space-y-3 text-xs">
              <p className="font-bold text-gray-700 uppercase tracking-wide">Core Competencies (1 to 5):</p>
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Technical Competence</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={managerFormData.technicalCompetence}
                    onChange={(e) =>
                      setManagerFormData({ ...managerFormData, technicalCompetence: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Quality of Work</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={managerFormData.qualityOfWork}
                    onChange={(e) => setManagerFormData({ ...managerFormData, qualityOfWork: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Productivity & Delivery</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={managerFormData.productivityAndTimeliness}
                    onChange={(e) =>
                      setManagerFormData({ ...managerFormData, productivityAndTimeliness: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Teamwork & Communication</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={managerFormData.communicationAndTeamwork}
                    onChange={(e) =>
                      setManagerFormData({ ...managerFormData, communicationAndTeamwork: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Key Strengths</label>
                <textarea
                  rows={2}
                  value={managerFormData.strengths}
                  onChange={(e) => setManagerFormData({ ...managerFormData, strengths: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Areas for Development</label>
                <textarea
                  rows={2}
                  value={managerFormData.areasForImprovement}
                  onChange={(e) => setManagerFormData({ ...managerFormData, areasForImprovement: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManagerReviewModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition"
                >
                  Finalize Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: GIVE RECOGNITION FEEDBACK                               */}
      {/* ============================================================== */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900">Send Kudos / Continuous Feedback</h3>
            <form onSubmit={handleSaveFeedback} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Recipient *</label>
                <select
                  required
                  value={feedbackFormData.toUserId}
                  onChange={(e) => setFeedbackFormData({ ...feedbackFormData, toUserId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.department || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Recognition Badge</label>
                  <select
                    value={feedbackFormData.badge}
                    onChange={(e) => setFeedbackFormData({ ...feedbackFormData, badge: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Rockstar">Rockstar</option>
                    <option value="Team Player">Team Player</option>
                    <option value="Problem Solver">Problem Solver</option>
                    <option value="Innovator">Innovator</option>
                    <option value="Great Communicator">Great Communicator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Feedback Type</label>
                  <select
                    value={feedbackFormData.type}
                    onChange={(e) => setFeedbackFormData({ ...feedbackFormData, type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="Praise">Praise</option>
                    <option value="Constructive">Constructive</option>
                    <option value="1-on-1 Notes">1-on-1 Notes</option>
                    <option value="General Feedback">General Feedback</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Appreciation Message *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share details of their contribution and impact..."
                  value={feedbackFormData.message}
                  onChange={(e) => setFeedbackFormData({ ...feedbackFormData, message: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition"
                >
                  Send Kudos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE APPRAISAL RECORD                                 */}
      {/* ============================================================== */}
      {isAppraisalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Record Annual Appraisal & Increment</h3>
            <form onSubmit={handleSaveAppraisal} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Employee *</label>
                <select
                  required
                  value={appraisalFormData.employeeId}
                  onChange={(e) => setAppraisalFormData({ ...appraisalFormData, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} (Current Base: ৳{e.baseSalary || 20000})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Increment %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={appraisalFormData.incrementPercentage}
                    onChange={(e) =>
                      setAppraisalFormData({ ...appraisalFormData, incrementPercentage: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Bonus Amount (BDT)</label>
                  <input
                    type="number"
                    value={appraisalFormData.bonusAmount}
                    onChange={(e) => setAppraisalFormData({ ...appraisalFormData, bonusAmount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Performance Grade</label>
                  <select
                    value={appraisalFormData.performanceGrade}
                    onChange={(e) => setAppraisalFormData({ ...appraisalFormData, performanceGrade: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="A+ (Outstanding)">A+ (Outstanding)</option>
                    <option value="A (Exceeds Expectations)">A (Exceeds Expectations)</option>
                    <option value="B (Meets Expectations)">B (Meets Expectations)</option>
                    <option value="C (Needs Improvement)">C (Needs Improvement)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Performance Score (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={appraisalFormData.performanceScore}
                    onChange={(e) =>
                      setAppraisalFormData({ ...appraisalFormData, performanceScore: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Proposed Designation / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  value={appraisalFormData.proposedDesignation}
                  onChange={(e) => setAppraisalFormData({ ...appraisalFormData, proposedDesignation: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="promoCheck"
                  checked={appraisalFormData.promotionRecommended}
                  onChange={(e) =>
                    setAppraisalFormData({ ...appraisalFormData, promotionRecommended: e.target.checked })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="promoCheck" className="font-semibold text-gray-700 cursor-pointer">
                  Recommend for Promotion
                </label>
              </div>

              {appraisalFormData.promotionRecommended && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Promotion Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Justification for promotion..."
                    value={appraisalFormData.promotionNotes}
                    onChange={(e) => setAppraisalFormData({ ...appraisalFormData, promotionNotes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAppraisalModalOpen(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition"
                >
                  Save Appraisal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

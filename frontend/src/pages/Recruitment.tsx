import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AppContext";
import { apiClient } from "../services/apiClient";

// Types
interface JobOpening {
  _id: string;
  id?: string;
  title: string;
  department: string;
  team?: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  vacancies: number;
  deadline?: string;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  skillsRequired?: string[];
  status: "Draft" | "Published" | "Closed";
  postedByName?: string;
  applicantCount?: number;
  createdAt?: string;
}

interface Applicant {
  _id: string;
  id?: string;
  job: string | JobOpening;
  jobTitle?: string;
  department?: string;
  name: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentPosition?: string;
  experienceYears?: number;
  education?: string;
  resumeUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
  skills?: string[];
  source?: string;
  status: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  rating?: number;
  notes?: string;
  rejectionReason?: string;
  offerDetails?: {
    offeredSalary?: number;
    joiningDate?: string;
    designation?: string;
    status?: "Pending" | "Accepted" | "Declined";
    notes?: string;
  };
  onboardingInitiated?: boolean;
  appliedDate?: string;
}

interface Interview {
  _id: string;
  id?: string;
  applicant: any;
  job: any;
  applicantName?: string;
  applicantEmail?: string;
  jobTitle?: string;
  stage: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewerNames?: string[];
  type: string;
  locationOrLink?: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
  feedback?: string;
  rating?: number;
  recommendation?: string;
}

interface OnboardingTask {
  _id?: string;
  id?: string;
  title: string;
  category: "Documentation" | "IT Setup" | "HR Orientation" | "Team Training" | "Policy Review";
  assignedToName?: string;
  dueDate?: string;
  isCompleted: boolean;
  completedAt?: string;
  notes?: string;
}

interface OnboardingRecord {
  _id: string;
  id?: string;
  applicant?: any;
  user?: any;
  employeeName: string;
  employeeEmail: string;
  department?: string;
  designation?: string;
  startDate?: string;
  mentorName?: string;
  status: "Pending" | "In Progress" | "Completed";
  progressPercentage: number;
  checklist: OnboardingTask[];
  welcomeNotes?: string;
}

interface StatsData {
  totalJobs: number;
  publishedJobs: number;
  totalApplicants: number;
  pipeline: {
    applied: number;
    screening: number;
    interview: number;
    offer: number;
    hired: number;
    rejected: number;
  };
  onboarding: {
    active: number;
    completed: number;
  };
}

const STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"] as const;
const INTERVIEW_STAGES = [
  "Screening Call",
  "Technical Round",
  "Managerial Round",
  "HR Round",
  "Final Culture Fit",
];

const Recruitment: React.FC = () => {
  const { user, can } = useAuth();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "jobs" | "applicants" | "interviews" | "offers" | "onboarding"
  >("overview");

  // State Collections
  const [stats, setStats] = useState<StatsData | null>(null);
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [onboardings, setOnboardings] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Filters
  const [jobFilterDept, setJobFilterDept] = useState("All");
  const [jobFilterStatus, setJobFilterStatus] = useState("All");
  const [jobSearch, setJobSearch] = useState("");

  const [applicantFilterJob, setApplicantFilterJob] = useState("All");
  const [applicantFilterStatus, setApplicantFilterStatus] = useState("All");
  const [applicantSearch, setApplicantSearch] = useState("");
  const [applicantViewMode, setApplicantViewMode] = useState<"pipeline" | "table">("pipeline");

  const [interviewFilterStatus, setInterviewFilterStatus] = useState("All");

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    department: "Engineering",
    team: "",
    location: "On-site (Dhaka)",
    employmentType: "Full-Time",
    experienceLevel: "Mid Level",
    salaryMin: 50000,
    salaryMax: 80000,
    currency: "BDT",
    vacancies: 1,
    deadline: "",
    description: "",
    requirements: "",
    responsibilities: "",
    skillsRequired: "",
    status: "Published",
  });

  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [applicantForm, setApplicantForm] = useState({
    jobId: "",
    name: "",
    email: "",
    phone: "",
    currentCompany: "",
    currentPosition: "",
    experienceYears: 2,
    education: "",
    resumeUrl: "",
    portfolioUrl: "",
    coverLetter: "",
    skills: "",
    source: "Website",
  });

  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    applicantId: "",
    stage: "Technical Round",
    title: "Round 1: Technical Assessment",
    scheduledAt: "",
    durationMinutes: 45,
    type: "Online Video (Meet/Zoom)",
    locationOrLink: "https://meet.google.com/new",
    notes: "",
  });

  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] =
    useState<Interview | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    feedback: "",
    rating: 4,
    recommendation: "Hire",
    status: "Completed",
  });

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    applicantId: "",
    offeredSalary: 80000,
    joiningDate: "",
    designation: "",
    notes: "Formal offer package approved by management.",
  });

  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState<OnboardingRecord | null>(null);
  const [onboardingForm, setOnboardingForm] = useState({
    applicantId: "",
    employeeName: "",
    employeeEmail: "",
    department: "Engineering",
    designation: "",
    startDate: "",
    welcomeNotes: "",
  });

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<OnboardingTask["category"]>("IT Setup");

  // Fetch all recruitment data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, jobsRes, applicantsRes, interviewsRes, onboardingRes] = await Promise.all([
        apiClient.get("/recruitment/stats"),
        apiClient.get("/recruitment/jobs"),
        apiClient.get("/recruitment/applicants"),
        apiClient.get("/recruitment/interviews"),
        apiClient.get("/recruitment/onboarding"),
      ]);

      setStats(statsRes.data.data);
      setJobs(jobsRes.data.data || []);
      setApplicants(applicantsRes.data.data || []);
      setInterviews(interviewsRes.data.data || []);
      setOnboardings(onboardingRes.data.data || []);
    } catch (err: any) {
      console.error("Failed to load recruitment data:", err);
      setActionMsg({
        type: "error",
        text: err?.response?.data?.message || "Failed to load recruitment data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (type: "success" | "error", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  // ----------------------------------------------------
  // JOB OPENINGS ACTIONS
  // ----------------------------------------------------
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...jobForm,
        requirements: jobForm.requirements
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
        responsibilities: jobForm.responsibilities
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
        skillsRequired: jobForm.skillsRequired
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (editingJob) {
        await apiClient.put(`/recruitment/jobs/${editingJob._id || editingJob.id}`, payload);
        showNotification("success", "Job opening updated successfully!");
      } else {
        await apiClient.post("/recruitment/jobs", payload);
        showNotification("success", "New job opening published!");
      }

      setShowJobModal(false);
      setEditingJob(null);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to save job opening");
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this job opening?")) return;
    try {
      await apiClient.delete(`/recruitment/jobs/${id}`);
      showNotification("success", "Job opening removed");
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to delete job");
    }
  };

  // ----------------------------------------------------
  // APPLICANTS ACTIONS
  // ----------------------------------------------------
  const handleSaveApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...applicantForm,
        skills: applicantForm.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await apiClient.post("/recruitment/applicants", payload);
      showNotification("success", "Applicant added successfully!");
      setShowApplicantModal(false);
      setApplicantForm({
        jobId: "",
        name: "",
        email: "",
        phone: "",
        currentCompany: "",
        currentPosition: "",
        experienceYears: 2,
        education: "",
        resumeUrl: "",
        portfolioUrl: "",
        coverLetter: "",
        skills: "",
        source: "Website",
      });
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to add applicant");
    }
  };

  const handleUpdateApplicantStage = async (applicantId: string, newStage: string) => {
    try {
      await apiClient.patch(`/recruitment/applicants/${applicantId}/status`, {
        status: newStage,
      });
      showNotification("success", `Candidate moved to ${newStage}`);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to update stage");
    }
  };

  const handleSetRating = async (applicantId: string, rating: number) => {
    try {
      await apiClient.patch(`/recruitment/applicants/${applicantId}/status`, { rating });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // INTERVIEW ACTIONS
  // ----------------------------------------------------
  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/recruitment/interviews", scheduleForm);
      showNotification("success", "Interview round scheduled successfully!");
      setShowScheduleModal(false);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to schedule interview");
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewForFeedback) return;
    try {
      await apiClient.patch(
        `/recruitment/interviews/${selectedInterviewForFeedback._id || selectedInterviewForFeedback.id}/feedback`,
        feedbackForm
      );
      showNotification("success", "Interview feedback recorded!");
      setSelectedInterviewForFeedback(null);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to submit feedback");
    }
  };

  // ----------------------------------------------------
  // OFFER ACTIONS
  // ----------------------------------------------------
  const handleExtendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/recruitment/applicants/offer", offerForm);
      showNotification("success", "Job offer extended to candidate!");
      setShowOfferModal(false);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to extend offer");
    }
  };

  const handleOfferDecision = async (
    applicantId: string,
    decision: "Accepted" | "Declined"
  ) => {
    try {
      await apiClient.patch(`/recruitment/applicants/${applicantId}/offer`, {
        offerStatus: decision,
      });
      showNotification(
        "success",
        `Offer marked as ${decision}. ${decision === "Accepted" ? "Candidate ready for onboarding!" : ""}`
      );
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to update offer decision");
    }
  };

  // ----------------------------------------------------
  // ONBOARDING ACTIONS
  // ----------------------------------------------------
  const handleInitiateOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/recruitment/onboarding/initiate", onboardingForm);
      showNotification("success", "Employee onboarding initiated with default checklist!");
      setShowOnboardingModal(false);
      fetchData();
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to initiate onboarding");
    }
  };

  const handleToggleOnboardingTask = async (
    onboardingId: string,
    taskId: string,
    currentStatus: boolean
  ) => {
    try {
      const res = await apiClient.patch(`/recruitment/onboarding/${onboardingId}/tasks/${taskId}`, {
        isCompleted: !currentStatus,
      });
      // Update local state smoothly
      setOnboardings((prev) =>
        prev.map((o) => (o._id === onboardingId ? res.data.data : o))
      );
      if (selectedOnboarding && selectedOnboarding._id === onboardingId) {
        setSelectedOnboarding(res.data.data);
      }
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to update task status");
    }
  };

  const handleAddCustomTask = async (onboardingId: string) => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await apiClient.post(`/recruitment/onboarding/${onboardingId}/tasks`, {
        title: newTaskTitle.trim(),
        category: newTaskCategory,
      });
      setNewTaskTitle("");
      setOnboardings((prev) =>
        prev.map((o) => (o._id === onboardingId ? res.data.data : o))
      );
      if (selectedOnboarding && selectedOnboarding._id === onboardingId) {
        setSelectedOnboarding(res.data.data);
      }
      showNotification("success", "New onboarding checklist item added!");
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to add checklist item");
    }
  };

  const handleDeleteTask = async (onboardingId: string, taskId: string) => {
    try {
      const res = await apiClient.delete(
        `/recruitment/onboarding/${onboardingId}/tasks/${taskId}`
      );
      setOnboardings((prev) =>
        prev.map((o) => (o._id === onboardingId ? res.data.data : o))
      );
      if (selectedOnboarding && selectedOnboarding._id === onboardingId) {
        setSelectedOnboarding(res.data.data);
      }
      showNotification("success", "Checklist item removed");
    } catch (err: any) {
      showNotification("error", err?.response?.data?.message || "Failed to remove task");
    }
  };

  // Filtered job openings
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchesDept = jobFilterDept === "All" || j.department === jobFilterDept;
      const matchesStatus = jobFilterStatus === "All" || j.status === jobFilterStatus;
      const matchesSearch =
        !jobSearch ||
        j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
        j.department.toLowerCase().includes(jobSearch.toLowerCase());
      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [jobs, jobFilterDept, jobFilterStatus, jobSearch]);

  // Filtered applicants
  const filteredApplicants = useMemo(() => {
    return applicants.filter((a) => {
      const aJobId = typeof a.job === "object" ? a.job?._id : a.job;
      const matchesJob = applicantFilterJob === "All" || aJobId === applicantFilterJob;
      const matchesStatus = applicantFilterStatus === "All" || a.status === applicantFilterStatus;
      const matchesSearch =
        !applicantSearch ||
        a.name.toLowerCase().includes(applicantSearch.toLowerCase()) ||
        a.email.toLowerCase().includes(applicantSearch.toLowerCase()) ||
        (a.skills && a.skills.some((s) => s.toLowerCase().includes(applicantSearch.toLowerCase())));
      return matchesJob && matchesStatus && matchesSearch;
    });
  }, [applicants, applicantFilterJob, applicantFilterStatus, applicantSearch]);

  // Candidates eligible for offer
  const interviewOrOfferCandidates = useMemo(() => {
    return applicants.filter((a) => a.status === "Interview" || a.status === "Offer");
  }, [applicants]);

  // Candidates in Offer/Hired stage
  const offerList = useMemo(() => {
    return applicants.filter(
      (a) => a.status === "Offer" || a.status === "Hired" || a.offerDetails?.status
    );
  }, [applicants]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600 font-medium">Loading Recruitment & Onboarding...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {actionMsg && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            actionMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{actionMsg.text}</span>
          <button
            onClick={() => setActionMsg(null)}
            className="text-xs font-bold uppercase underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-semibold">
              Module 2 — Member 3 (Rafsan Alam Rishad)
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              Multi-Tenant & RBAC Active
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Recruitment & Employee Onboarding OS
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage job vacancies, applicant tracking pipelines, multi-stage interviews, candidate selection offers, and automated employee onboarding.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingJob(null);
              setJobForm({
                title: "",
                department: "Engineering",
                team: "",
                location: "On-site (Dhaka)",
                employmentType: "Full-Time",
                experienceLevel: "Mid Level",
                salaryMin: 60000,
                salaryMax: 90000,
                currency: "BDT",
                vacancies: 1,
                deadline: "",
                description: "",
                requirements: "",
                responsibilities: "",
                skillsRequired: "",
                status: "Published",
              });
              setShowJobModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            + Post Job Opening
          </button>
          <button
            onClick={() => setShowApplicantModal(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            + Add Applicant
          </button>
          <button
            onClick={() => {
              if (applicants.length > 0) {
                setScheduleForm((prev) => ({
                  ...prev,
                  applicantId: applicants[0]._id,
                  scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                }));
              }
              setShowScheduleModal(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            + Schedule Interview
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview & Analytics", count: null },
          { key: "jobs", label: "Job Openings", count: jobs.length },
          { key: "applicants", label: "Applicant Pipeline", count: applicants.length },
          { key: "interviews", label: "Interview Stages", count: interviews.length },
          { key: "offers", label: "Offers & Selection", count: offerList.length },
          { key: "onboarding", label: "Employee Onboarding", count: onboardings.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? "bg-indigo-700 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================================================== */}
      {/* TAB 1: OVERVIEW & ANALYTICS                          */}
      {/* ==================================================== */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* High-level Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                Active Job Openings
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-gray-900">
                  {stats.publishedJobs}
                </span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {stats.totalJobs} Total
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                Total Applicants
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {stats.totalApplicants}
                </span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Active Pool
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                In Interview Stage
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-blue-600">
                  {stats.pipeline.interview}
                </span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {interviews.filter((i) => i.status === "Scheduled").length} Scheduled
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                Hired & Onboarding
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-emerald-600">
                  {stats.pipeline.hired}
                </span>
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {stats.onboarding.active} In-Progress
                </span>
              </div>
            </div>
          </div>

          {/* Recruitment Funnel Pipeline Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              Recruitment Conversion Funnel
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: "Applied", count: stats.pipeline.applied, color: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
                { label: "Screening", count: stats.pipeline.screening, color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
                { label: "Interview", count: stats.pipeline.interview, color: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50" },
                { label: "Offer", count: stats.pipeline.offer, color: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50" },
                { label: "Hired", count: stats.pipeline.hired, color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
                { label: "Rejected", count: stats.pipeline.rejected, color: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
              ].map((stage, idx) => (
                <div key={idx} className={`p-4 rounded-xl ${stage.bg} border border-gray-100 flex flex-col justify-between`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      {stage.label}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></span>
                  </div>
                  <div className="mt-3">
                    <span className={`text-2xl font-black ${stage.text}`}>
                      {stage.count}
                    </span>
                    <span className="text-xs text-gray-500 ml-1.5">candidates</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Split: Upcoming Interviews & Recent Onboardings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Interviews */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Upcoming Interviews</h3>
                <button
                  onClick={() => setActiveTab("interviews")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  View All &rarr;
                </button>
              </div>
              {interviews.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No interviews scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {interviews.slice(0, 4).map((item) => (
                    <div
                      key={item._id}
                      className="p-3.5 bg-gray-50 rounded-lg flex items-center justify-between border border-gray-100"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {item.applicantName || item.applicant?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.title} &bull; <span className="text-indigo-600 font-medium">{item.stage}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          📅 {new Date(item.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          item.status === "Scheduled"
                            ? "bg-blue-100 text-blue-700"
                            : item.status === "Completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Onboardings */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Active Employee Onboarding</h3>
                <button
                  onClick={() => setActiveTab("onboarding")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  View All &rarr;
                </button>
              </div>
              {onboardings.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No active employee onboarding programs.</p>
              ) : (
                <div className="space-y-3">
                  {onboardings.slice(0, 4).map((item) => (
                    <div
                      key={item._id}
                      className="p-3.5 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.employeeName}</p>
                          <p className="text-xs text-gray-500">
                            {item.designation} &bull; {item.department}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            item.status === "Completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {item.status} ({item.progressPercentage}%)
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${item.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: JOB OPENINGS                                  */}
      {/* ==================================================== */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search job title, skills..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={jobFilterDept}
                onChange={(e) => setJobFilterDept(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="All">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Operations">Operations</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Sales">Sales</option>
              </select>
              <select
                value={jobFilterStatus}
                onChange={(e) => setJobFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <button
              onClick={() => {
                setEditingJob(null);
                setShowJobModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
            >
              + Create New Opening
            </button>
          </div>

          {/* Job Openings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => (
              <div
                key={job._id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {job.department}
                      </span>
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {job.employmentType}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        job.status === "Published"
                          ? "bg-emerald-100 text-emerald-800"
                          : job.status === "Draft"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg mt-3">{job.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {job.location} &bull; {job.experienceLevel} &bull; {job.vacancies} {job.vacancies > 1 ? "vacancies" : "vacancy"}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{job.description}</p>

                  {job.skillsRequired && job.skillsRequired.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {job.skillsRequired.slice(0, 4).map((skill, sIdx) => (
                        <span key={sIdx} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skillsRequired.length > 4 && (
                        <span className="text-xs text-gray-400">+{job.skillsRequired.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div>
                      💰 <span className="font-semibold text-gray-800">
                        {job.currency} {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      👥 <span className="font-bold text-indigo-600">{job.applicantCount || 0}</span> applicants
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setApplicantFilterJob(job._id);
                      setActiveTab("applicants");
                    }}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    View Applicants &rarr;
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingJob(job);
                        setJobForm({
                          title: job.title,
                          department: job.department,
                          team: job.team || "",
                          location: job.location,
                          employmentType: job.employmentType,
                          experienceLevel: job.experienceLevel,
                          salaryMin: job.salaryMin,
                          salaryMax: job.salaryMax,
                          currency: job.currency,
                          vacancies: job.vacancies,
                          deadline: job.deadline ? job.deadline.slice(0, 10) : "",
                          description: job.description,
                          requirements: (job.requirements || []).join("\n"),
                          responsibilities: (job.responsibilities || []).join("\n"),
                          skillsRequired: (job.skillsRequired || []).join(", "),
                          status: job.status,
                        });
                        setShowJobModal(true);
                      }}
                      className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 px-2.5 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job._id)}
                      className="text-xs text-red-600 hover:text-red-800 bg-red-50 px-2.5 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: APPLICANT MANAGEMENT & PIPELINE               */}
      {/* ==================================================== */}
      {activeTab === "applicants" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search candidate name, email, skills..."
                value={applicantSearch}
                onChange={(e) => setApplicantSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={applicantFilterJob}
                onChange={(e) => setApplicantFilterJob(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="All">All Job Positions</option>
                {jobs.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <select
                value={applicantFilterStatus}
                onChange={(e) => setApplicantFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="All">All Stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button
                  onClick={() => setApplicantViewMode("pipeline")}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    applicantViewMode === "pipeline" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600"
                  }`}
                >
                  Kanban Stages
                </button>
                <button
                  onClick={() => setApplicantViewMode("table")}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    applicantViewMode === "table" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600"
                  }`}
                >
                  Table View
                </button>
              </div>
              <button
                onClick={() => setShowApplicantModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
              >
                + Add Applicant
              </button>
            </div>
          </div>

          {/* Kanban Pipeline View */}
          {applicantViewMode === "pipeline" ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const candidatesInStage = filteredApplicants.filter((a) => a.status === stage);
                return (
                  <div key={stage} className="bg-gray-50 rounded-xl p-3 border border-gray-200 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                      <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                        {stage}
                      </span>
                      <span className="bg-white text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200">
                        {candidatesInStage.length}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {candidatesInStage.map((cand) => (
                        <div
                          key={cand._id}
                          className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition text-left"
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-sm text-gray-900">{cand.name}</h4>
                            {cand.rating ? (
                              <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                                ★ {cand.rating}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-medium text-indigo-600 mt-0.5">{cand.jobTitle}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {cand.currentPosition ? `${cand.currentPosition} • ` : ""}
                            {cand.experienceYears}y exp
                          </p>

                          {/* Quick stage selector */}
                          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <select
                              value={cand.status}
                              onChange={(e) => handleUpdateApplicantStage(cand._id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-700 focus:outline-none"
                            >
                              {STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => setSelectedApplicant(cand)}
                              className="text-xs text-indigo-600 hover:underline font-medium"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}

                      {candidatesInStage.length === 0 && (
                        <div className="text-center py-6 text-xs text-gray-400">
                          No applicants in {stage}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Applied Position</th>
                      <th className="px-4 py-3">Experience</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Applied Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredApplicants.map((cand) => (
                      <tr key={cand._id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{cand.name}</p>
                          <p className="text-xs text-gray-500">{cand.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{cand.jobTitle}</p>
                          <p className="text-xs text-gray-400">{cand.department}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {cand.experienceYears} Years
                          {cand.currentCompany && (
                            <span className="block text-xs text-gray-400">@ {cand.currentCompany}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleSetRating(cand._id, star)}
                                className={`text-sm ${
                                  (cand.rating || 0) >= star ? "text-amber-400" : "text-gray-200"
                                } hover:text-amber-500`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={cand.status}
                            onChange={(e) => handleUpdateApplicantStage(cand._id, e.target.value)}
                            className="text-xs font-medium border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none"
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {cand.appliedDate ? new Date(cand.appliedDate).toLocaleDateString() : "Recent"}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedApplicant(cand)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Profile
                          </button>
                          {cand.status === "Interview" && (
                            <button
                              onClick={() => {
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  applicantId: cand._id,
                                  title: `Technical Round with ${cand.name}`,
                                  scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                                }));
                                setShowScheduleModal(true);
                              }}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              Schedule
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: INTERVIEW STAGES & SCHEDULING                 */}
      {/* ==================================================== */}
      {activeTab === "interviews" && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter Status:</span>
              <select
                value={interviewFilterStatus}
                onChange={(e) => setInterviewFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (applicants.length > 0) {
                  setScheduleForm((prev) => ({
                    ...prev,
                    applicantId: applicants[0]._id,
                    scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                  }));
                }
                setShowScheduleModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              + Schedule Interview Round
            </button>
          </div>

          {/* Interviews Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interviews
              .filter(
                (i) =>
                  interviewFilterStatus === "All" || i.status === interviewFilterStatus
              )
              .map((interview) => (
                <div
                  key={interview._id}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {interview.stage}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          interview.status === "Scheduled"
                            ? "bg-amber-100 text-amber-800"
                            : interview.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {interview.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base mt-3">
                      {interview.title}
                    </h3>
                    <p className="text-xs font-medium text-indigo-600 mt-1">
                      Candidate: {interview.applicantName || interview.applicant?.name}
                    </p>

                    <div className="mt-3 text-xs text-gray-500 space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <p>
                        📅 <span className="font-semibold text-gray-700">Time:</span>{" "}
                        {new Date(interview.scheduledAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        ({interview.durationMinutes} mins)
                      </p>
                      <p>
                        🔗 <span className="font-semibold text-gray-700">Platform:</span>{" "}
                        {interview.type}
                      </p>
                      {interview.locationOrLink && (
                        <p className="truncate">
                          📍{" "}
                          {interview.locationOrLink.startsWith("http") ? (
                            <a
                              href={interview.locationOrLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline font-medium"
                            >
                              Join Meeting
                            </a>
                          ) : (
                            interview.locationOrLink
                          )}
                        </p>
                      )}
                    </div>

                    {/* Feedback if completed */}
                    {interview.feedback && (
                      <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 text-xs">
                        <div className="flex items-center justify-between font-bold text-emerald-800 mb-1">
                          <span>Feedback & Rating:</span>
                          {interview.rating ? <span>★ {interview.rating}/5</span> : null}
                        </div>
                        <p className="text-gray-700 italic">"{interview.feedback}"</p>
                        {interview.recommendation && (
                          <span className="inline-block mt-1 font-semibold text-emerald-700">
                            Recommendation: {interview.recommendation}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    {interview.status === "Scheduled" ? (
                      <button
                        onClick={() => {
                          setSelectedInterviewForFeedback(interview);
                          setFeedbackForm({
                            feedback: interview.feedback || "",
                            rating: interview.rating || 4,
                            recommendation: interview.recommendation || "Hire",
                            status: "Completed",
                          });
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
                      >
                        Submit Feedback
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Completed</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (window.confirm("Cancel this interview?")) {
                            await apiClient.put(`/recruitment/interviews/${interview._id}`, {
                              status: "Cancelled",
                            });
                            showNotification("success", "Interview cancelled");
                            fetchData();
                          }
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: CANDIDATE SELECTION & OFFERS                  */}
      {/* ==================================================== */}
      {activeTab === "offers" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Job Offer & Candidate Selection</h2>
              <p className="text-xs text-gray-500">
                Review interview performance, extend formal offers, and record candidate decisions.
              </p>
            </div>
            <button
              onClick={() => {
                if (interviewOrOfferCandidates.length > 0) {
                  setOfferForm((prev) => ({
                    ...prev,
                    applicantId: interviewOrOfferCandidates[0]._id,
                    designation: interviewOrOfferCandidates[0].jobTitle || "Software Engineer",
                  }));
                }
                setShowOfferModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
            >
              + Extend New Offer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offerList.map((cand) => (
              <div
                key={cand._id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {cand.department || "Engineering"}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        cand.status === "Hired"
                          ? "bg-emerald-100 text-emerald-800 font-bold"
                          : cand.status === "Offer"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {cand.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg mt-2">{cand.name}</h3>
                  <p className="text-xs font-medium text-gray-500">
                    Position: <span className="text-indigo-600">{cand.offerDetails?.designation || cand.jobTitle}</span>
                  </p>

                  <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs space-y-1.5">
                    <p>
                      💰 <span className="font-semibold text-gray-700">Offered Salary:</span>{" "}
                      BDT {cand.offerDetails?.offeredSalary ? cand.offerDetails.offeredSalary.toLocaleString() : "TBD"} / mo
                    </p>
                    <p>
                      📅 <span className="font-semibold text-gray-700">Joining Date:</span>{" "}
                      {cand.offerDetails?.joiningDate
                        ? new Date(cand.offerDetails.joiningDate).toLocaleDateString()
                        : "Immediate"}
                    </p>
                    <p>
                      📌 <span className="font-semibold text-gray-700">Decision Status:</span>{" "}
                      <span className="font-bold text-indigo-700">{cand.offerDetails?.status || "Pending"}</span>
                    </p>
                    {cand.offerDetails?.notes && (
                      <p className="text-gray-500 italic mt-1">"{cand.offerDetails.notes}"</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  {cand.offerDetails?.status === "Pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOfferDecision(cand._id, "Accepted")}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
                      >
                        ✓ Candidate Accepted
                      </button>
                      <button
                        onClick={() => handleOfferDecision(cand._id, "Declined")}
                        className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition"
                      >
                        ✕ Declined
                      </button>
                    </div>
                  )}

                  {cand.status === "Hired" && !cand.onboardingInitiated && (
                    <button
                      onClick={() => {
                        setOnboardingForm({
                          applicantId: cand._id,
                          employeeName: cand.name,
                          employeeEmail: cand.email,
                          department: cand.department || "Engineering",
                          designation: cand.offerDetails?.designation || cand.jobTitle || "Software Engineer",
                          startDate: cand.offerDetails?.joiningDate
                            ? cand.offerDetails.joiningDate.slice(0, 10)
                            : new Date().toISOString().slice(0, 10),
                          welcomeNotes: `Welcome to the team, ${cand.name}!`,
                        });
                        setShowOnboardingModal(true);
                      }}
                      className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-bold shadow transition"
                    >
                      🚀 Initiate Employee Onboarding
                    </button>
                  )}

                  {cand.onboardingInitiated && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold bg-emerald-50 p-2 rounded">
                      <span>✓ Onboarding in Progress</span>
                      <button
                        onClick={() => setActiveTab("onboarding")}
                        className="underline"
                      >
                        View Checklist
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 6: EMPLOYEE ONBOARDING TRACKER                   */}
      {/* ==================================================== */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">New Employee Onboarding Workflows</h2>
              <p className="text-xs text-gray-500">
                Track compliance checklists, IT provisioning, documentation, and mentorship orientations.
              </p>
            </div>
            <button
              onClick={() => {
                setOnboardingForm({
                  applicantId: "",
                  employeeName: "",
                  employeeEmail: "",
                  department: "Engineering",
                  designation: "Software Engineer",
                  startDate: new Date().toISOString().slice(0, 10),
                  welcomeNotes: "",
                });
                setShowOnboardingModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
            >
              + New Onboarding Process
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onboardings.map((record) => (
              <div
                key={record._id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{record.employeeName}</h3>
                    <p className="text-xs text-gray-500">
                      {record.designation} &bull; <span className="text-indigo-600">{record.department}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">📧 {record.employeeEmail}</p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      record.status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {record.status} ({record.progressPercentage}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Checklist Completion</span>
                    <span className="font-bold text-indigo-700">{record.progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${record.progressPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Interactive Checklist Preview */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Onboarding Tasks ({record.checklist.filter((t) => t.isCompleted).length}/{record.checklist.length})
                    </span>
                    <button
                      onClick={() => setSelectedOnboarding(record)}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Manage Tasks &rarr;
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {record.checklist.map((task) => (
                      <label
                        key={task._id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer text-xs border border-transparent hover:border-gray-200 transition"
                      >
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={() =>
                            handleToggleOnboardingTask(record._id, task._id!, task.isCompleted)
                          }
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span
                          className={`flex-1 ${
                            task.isCompleted ? "line-through text-gray-400" : "text-gray-800 font-medium"
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {task.category}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: POST / EDIT JOB OPENING                      */}
      {/* ==================================================== */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingJob ? "Edit Job Opening" : "Post New Job Opening"}
              </h3>
              <button
                onClick={() => setShowJobModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Backend Engineer"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={jobForm.department}
                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={jobForm.employmentType}
                    onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={jobForm.experienceLevel}
                    onChange={(e) => setJobForm({ ...jobForm, experienceLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Entry Level">Entry Level</option>
                    <option value="Mid Level">Mid Level</option>
                    <option value="Senior Level">Senior Level</option>
                    <option value="Lead / Executive">Lead / Executive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vacancies
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={jobForm.vacancies}
                    onChange={(e) => setJobForm({ ...jobForm, vacancies: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Min Salary (BDT)
                  </label>
                  <input
                    type="number"
                    value={jobForm.salaryMin}
                    onChange={(e) => setJobForm({ ...jobForm, salaryMin: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Salary (BDT)
                  </label>
                  <input
                    type="number"
                    value={jobForm.salaryMax}
                    onChange={(e) => setJobForm({ ...jobForm, salaryMax: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={jobForm.deadline}
                    onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Job Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Outline role responsibilities and mission..."
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="React, Node.js, MongoDB, TypeScript, Docker"
                  value={jobForm.skillsRequired}
                  onChange={(e) => setJobForm({ ...jobForm, skillsRequired: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  {editingJob ? "Update Opening" : "Publish Opening"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD APPLICANT                                */}
      {/* ==================================================== */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Add New Applicant</h3>
              <button
                onClick={() => setShowApplicantModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveApplicant} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Job Position *
                </label>
                <select
                  required
                  value={applicantForm.jobId}
                  onChange={(e) => setApplicantForm({ ...applicantForm, jobId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Job Opening --</option>
                  {jobs.map((j) => (
                    <option key={j._id} value={j._id}>
                      {j.title} ({j.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanzim Ahmed"
                    value={applicantForm.name}
                    onChange={(e) => setApplicantForm({ ...applicantForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="tanzim@example.com"
                    value={applicantForm.email}
                    onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+880 1700 000000"
                    value={applicantForm.phone}
                    onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={applicantForm.experienceYears}
                    onChange={(e) =>
                      setApplicantForm({ ...applicantForm, experienceYears: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current Company / Institution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Brain Station 23 / DIU"
                    value={applicantForm.currentCompany}
                    onChange={(e) =>
                      setApplicantForm({ ...applicantForm, currentCompany: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current Position
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Junior Developer"
                    value={applicantForm.currentPosition}
                    onChange={(e) =>
                      setApplicantForm({ ...applicantForm, currentPosition: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="JavaScript, React, Node.js, Express, MongoDB"
                  value={applicantForm.skills}
                  onChange={(e) => setApplicantForm({ ...applicantForm, skills: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Resume Link (PDF/Drive)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={applicantForm.resumeUrl}
                    onChange={(e) =>
                      setApplicantForm({ ...applicantForm, resumeUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={applicantForm.source}
                    onChange={(e) => setApplicantForm({ ...applicantForm, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Website">Website</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Referral">Referral</option>
                    <option value="Job Board">Job Board</option>
                    <option value="Direct Application">Direct Application</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowApplicantModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SCHEDULE INTERVIEW                           */}
      {/* ==================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Schedule Interview Round</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleScheduleInterview} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Candidate *
                </label>
                <select
                  required
                  value={scheduleForm.applicantId}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, applicantId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Candidate --</option>
                  {applicants.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Interview Stage
                  </label>
                  <select
                    value={scheduleForm.stage}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, stage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {INTERVIEW_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={scheduleForm.durationMinutes}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        durationMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Interview Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Round 1: React & Node Coding Assessment"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Date and Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.scheduledAt}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Interview Medium
                  </label>
                  <select
                    value={scheduleForm.type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Online Video (Meet/Zoom)">Online Video (Meet/Zoom)</option>
                    <option value="In-Person">In-Person</option>
                    <option value="Phone Call">Phone Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Meeting Link or Room
                  </label>
                  <input
                    type="text"
                    placeholder="https://meet.google.com/xyz or Room 4A"
                    value={scheduleForm.locationOrLink}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, locationOrLink: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Schedule Interview
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SUBMIT INTERVIEW FEEDBACK                    */}
      {/* ==================================================== */}
      {selectedInterviewForFeedback && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Submit Interview Evaluation</h3>
              <button
                onClick={() => setSelectedInterviewForFeedback(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedInterviewForFeedback.title}
                </p>
                <p className="text-xs text-gray-500">
                  Candidate: {selectedInterviewForFeedback.applicantName || selectedInterviewForFeedback.applicant?.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Overall Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                      className={`text-2xl ${
                        feedbackForm.rating >= star ? "text-amber-400" : "text-gray-200"
                      } hover:text-amber-500`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-sm font-bold text-gray-700 ml-2">
                    {feedbackForm.rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Hiring Recommendation
                </label>
                <select
                  value={feedbackForm.recommendation}
                  onChange={(e) =>
                    setFeedbackForm({ ...feedbackForm, recommendation: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="Strong Hire">Strong Hire</option>
                  <option value="Hire">Hire</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Do Not Hire">Do Not Hire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Evaluation Feedback & Remarks *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail candidate technical strengths, soft skills, and recommendation notes..."
                  value={feedbackForm.feedback}
                  onChange={(e) =>
                    setFeedbackForm({ ...feedbackForm, feedback: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedInterviewForFeedback(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Save Feedback & Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EXTEND JOB OFFER                              */}
      {/* ==================================================== */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Extend Official Job Offer</h3>
              <button
                onClick={() => setShowOfferModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExtendOffer} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Selected Candidate *
                </label>
                <select
                  required
                  value={offerForm.applicantId}
                  onChange={(e) => setOfferForm({ ...offerForm, applicantId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Candidate --</option>
                  {interviewOrOfferCandidates.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Official Designation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={offerForm.designation}
                  onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Offered Salary (BDT/month) *
                  </label>
                  <input
                    type="number"
                    required
                    min="10000"
                    step="1000"
                    value={offerForm.offeredSalary}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, offeredSalary: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={offerForm.joiningDate}
                    onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Offer Letter Remarks / Instructions
                </label>
                <textarea
                  rows={3}
                  value={offerForm.notes}
                  onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Extend Job Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: INITIATE ONBOARDING                          */}
      {/* ==================================================== */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Initiate Employee Onboarding Process
              </h3>
              <button
                onClick={() => setShowOnboardingModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleInitiateOnboarding} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardingForm.employeeName}
                    onChange={(e) =>
                      setOnboardingForm({ ...onboardingForm, employeeName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={onboardingForm.employeeEmail}
                    onChange={(e) =>
                      setOnboardingForm({ ...onboardingForm, employeeEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={onboardingForm.department}
                    onChange={(e) =>
                      setOnboardingForm({ ...onboardingForm, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={onboardingForm.designation}
                    onChange={(e) =>
                      setOnboardingForm({ ...onboardingForm, designation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={onboardingForm.startDate}
                  onChange={(e) =>
                    setOnboardingForm({ ...onboardingForm, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Welcome Notes & Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Welcome message to be displayed on employee dashboard..."
                  value={onboardingForm.welcomeNotes}
                  onChange={(e) =>
                    setOnboardingForm({ ...onboardingForm, welcomeNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs text-indigo-800">
                💡 Standard onboarding tasks (Document verification, NDA signing, Workstation provisioning, Email setup, HR orientation, Repository setup) will be automatically assigned to this employee.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowOnboardingModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Start Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: APPLICANT PROFILE DETAILS                     */}
      {/* ==================================================== */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedApplicant.name}</h3>
                <p className="text-xs text-indigo-600 font-semibold">{selectedApplicant.jobTitle}</p>
              </div>
              <button
                onClick={() => setSelectedApplicant(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block">Email:</span>
                  <span className="font-semibold text-gray-800">{selectedApplicant.email}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Phone:</span>
                  <span className="font-semibold text-gray-800">{selectedApplicant.phone || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Experience:</span>
                  <span className="font-semibold text-gray-800">{selectedApplicant.experienceYears} Years</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Current Company:</span>
                  <span className="font-semibold text-gray-800">{selectedApplicant.currentCompany || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Education:</span>
                  <span className="font-semibold text-gray-800">{selectedApplicant.education || "B.Sc"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Current Stage:</span>
                  <span className="font-bold text-indigo-600">{selectedApplicant.status}</span>
                </div>
              </div>

              {selectedApplicant.skills && selectedApplicant.skills.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Skills & Competencies:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApplicant.skills.map((s, idx) => (
                      <span key={idx} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedApplicant.coverLetter && (
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Cover Letter:
                  </span>
                  <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                    {selectedApplicant.coverLetter}
                  </p>
                </div>
              )}

              {selectedApplicant.notes && (
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Recruiter Evaluation Notes:
                  </span>
                  <p className="text-xs text-gray-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    {selectedApplicant.notes}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setScheduleForm((prev) => ({
                      ...prev,
                      applicantId: selectedApplicant._id,
                      title: `Technical Round with ${selectedApplicant.name}`,
                      scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                    }));
                    setSelectedApplicant(null);
                    setShowScheduleModal(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Schedule Interview
                </button>

                <button
                  onClick={() => {
                    setOfferForm((prev) => ({
                      ...prev,
                      applicantId: selectedApplicant._id,
                      designation: selectedApplicant.jobTitle || "Software Engineer",
                    }));
                    setSelectedApplicant(null);
                    setShowOfferModal(true);
                  }}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Extend Job Offer
                </button>

                <button
                  onClick={() => {
                    handleUpdateApplicantStage(selectedApplicant._id, "Rejected");
                    setSelectedApplicant(null);
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                >
                  Mark as Rejected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: MANAGE ONBOARDING CHECKLIST TASKS            */}
      {/* ==================================================== */}
      {selectedOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Onboarding Checklist: {selectedOnboarding.employeeName}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedOnboarding.designation} &bull; {selectedOnboarding.department}
                </p>
              </div>
              <button
                onClick={() => setSelectedOnboarding(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Progress summary */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-semibold text-gray-700">Completion Status</span>
                  <span className="font-extrabold text-indigo-600 text-base">
                    {selectedOnboarding.progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${selectedOnboarding.progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Checklist Items ({selectedOnboarding.checklist.length})
                </span>
                {selectedOnboarding.checklist.map((task) => (
                  <div
                    key={task._id}
                    className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() =>
                          handleToggleOnboardingTask(
                            selectedOnboarding._id,
                            task._id!,
                            task.isCompleted
                          )
                        }
                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <div>
                        <p
                          className={`text-sm ${
                            task.isCompleted ? "line-through text-gray-400" : "font-semibold text-gray-800"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          Category: <span className="text-gray-600 font-medium">{task.category}</span>
                          {task.notes && ` • "${task.notes}"`}
                        </p>
                      </div>
                    </label>

                    <button
                      onClick={() => handleDeleteTask(selectedOnboarding._id, task._id!)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                      title="Remove task"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Custom Task */}
              <div className="pt-3 border-t border-gray-200">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  + Add Custom Checklist Item
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter onboarding task description..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={newTaskCategory}
                    onChange={(e) =>
                      setNewTaskCategory(e.target.value as OnboardingTask["category"])
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Documentation">Documentation</option>
                    <option value="IT Setup">IT Setup</option>
                    <option value="HR Orientation">HR Orientation</option>
                    <option value="Team Training">Team Training</option>
                    <option value="Policy Review">Policy Review</option>
                  </select>
                  <button
                    onClick={() => handleAddCustomTask(selectedOnboarding._id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recruitment;

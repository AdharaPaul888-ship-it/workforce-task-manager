import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AppContext";
import {
  apiClient,
  getTimeSummary,
  getWeeklyTimesheet,
  submitTimesheet,
  getTimeEntries,
} from "../services/apiClient";

const Timer: React.FC = () => {
  const { user, badges, setBadges, can, refreshBadges } = useAuth();

  // 1. Working Hours State (Stopwatch)
  const [timer, setTimer] = useState<any>({
    running: false,
    accumulatedSeconds: 0,
    lastResumedAt: null,
    task: null,
    taskTitle: null,
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskId, setTaskId] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 2. Time Summaries State (Requirement 4)
  const [timeSummary, setTimeSummary] = useState<any>({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    totalHours: 0,
    totalEntries: 0,
    taskBreakdown: [],
  });

  // 3. Weekly Timesheets State (Requirement 2)
  const [timesheetData, setTimesheetData] = useState<any>({
    timesheet: null,
    taskRows: [],
    dailyTotals: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
    grandTotal: 0,
  });
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);

  // 4. Task-based Time Entries State (Requirement 3)
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // View Filter Toggle
  const [activeView, setActiveView] = useState<"all" | "timer" | "timesheet" | "entries">("all");

  // Manual Entry Form State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    taskId: "",
    date: new Date().toISOString().split("T")[0],
    durationHours: "1.0",
    category: "Work",
    notes: "",
  });

  const applyTimer = (data: any) => {
    setTimer({
      running: !!data?.running,
      accumulatedSeconds: data?.accumulatedSeconds || 0,
      lastResumedAt: data?.lastResumedAt || null,
      task: data?.task || null,
      taskTitle: data?.taskTitle || null,
    });
  };

  const loadAllTimeData = async () => {
    try {
      // 1. Load active timer
      const timerResp = await apiClient.get("/time/timer");
      applyTimer(timerResp.data?.data);

      // 2. Load assigned tasks
      const taskResp = await apiClient.get("/tasks");
      setTasks(taskResp.data?.data || []);

      // 3. Load Time Summaries (Requirement 4)
      try {
        const summaryResp = await getTimeSummary();
        if (summaryResp.data?.data) {
          setTimeSummary(summaryResp.data.data);
        }
      } catch (e) {
        console.warn("Summary load fallback:", e);
      }

      // 4. Load Weekly Timesheet (Requirement 2)
      try {
        const sheetResp = await getWeeklyTimesheet();
        if (sheetResp.data?.data) {
          const d = sheetResp.data.data;
          setTimesheetData({
            timesheet: d.timesheet || d,
            taskRows: d.taskRows || [],
            dailyTotals: d.dailyTotals || d.timesheet?.dailyHours || { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
            grandTotal: d.grandTotal || d.timesheet?.totalHours || 0,
          });
        }
      } catch (e) {
        console.warn("Timesheet load fallback:", e);
      }

      // 5. Load Task-Based Entries (Requirement 3)
      setLoadingHistory(true);
      try {
        const entriesResp = await getTimeEntries();
        if (entriesResp.data?.data) {
          setRecentEntries(entriesResp.data.data);
          // If summary didn't return, derive from entries
          if (!timeSummary.totalEntries && entriesResp.data.summary) {
            setTimeSummary((prev: any) => ({
              ...prev,
              ...entriesResp.data.summary,
              totalEntries: entriesResp.data.data.length,
            }));
          }
        }
      } catch (e) {
        console.warn("Entries load fallback:", e);
      }
      setLoadingHistory(false);
    } catch (err) {
      console.error("Error loading time tracking data:", err);
    }
  };

  useEffect(() => {
    loadAllTimeData();
  }, [user]);

  // Tick interval for live stopwatch
  useEffect(() => {
    if (timer.running) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [timer.running]);

  const runAction = async (fn: () => Promise<any>, onOk: (data: any) => void, errText: string) => {
    setMessage(null);
    try {
      const resp = await fn();
      onOk(resp.data?.data);
      refreshBadges();
      // Reload all time tracking data to ensure tables & summaries update in real-time
      setTimeout(() => loadAllTimeData(), 400);
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || errText });
    }
  };

  const startTimer = () => {
    if (!taskId || !can("timelog.record")) return;
    runAction(
      () => apiClient.post("/time/timer/start", { taskId }),
      (data) => {
        applyTimer(data);
        setMessage({ kind: "ok", text: `Timer started for “${data.taskTitle || "Task"}”` });
      },
      "Failed to start timer"
    );
  };

  const pauseTimer = () =>
    runAction(
      () => apiClient.post("/time/timer/pause"),
      (data) => applyTimer(data),
      "Failed to pause timer"
    );

  const resumeTimer = () =>
    runAction(
      () => apiClient.post("/time/timer/resume"),
      (data) => applyTimer(data),
      "Failed to resume timer"
    );

  const stopTimer = () =>
    runAction(
      () => apiClient.post("/time/timer/stop", { notes: "" }),
      (data) => {
        applyTimer({ running: false, accumulatedSeconds: 0, lastResumedAt: null, task: null, taskTitle: null });
        setTaskId("");
        if (data.discarded) {
          setMessage({ kind: "ok", text: data.message || "Timer under 1 minute, discarded" });
        } else {
          setMessage({
            kind: "ok",
            text: `Time entry successfully recorded (${data.durationHours || "0.0"} hrs) and added to your log below.`,
          });
        }
        setBadges({ ...badges, timer: { running: false, startedAt: null, accumulatedSeconds: 0 } });
      },
      "Failed to stop timer"
    );

  const discardTimer = () =>
    runAction(
      () => apiClient.post("/time/timer/discard"),
      () => {
        applyTimer({ running: false, accumulatedSeconds: 0, lastResumedAt: null, task: null, taskTitle: null });
        setTaskId("");
        setMessage({ kind: "ok", text: "Timer discarded" });
      },
      "Failed to discard timer"
    );

  const handleSubmitTimesheet = async () => {
    const sheetId = timesheetData.timesheet?.id || timesheetData.timesheet?._id;
    if (!sheetId) return;
    setSubmittingTimesheet(true);
    try {
      await submitTimesheet(sheetId);
      setMessage({ kind: "ok", text: "Weekly timesheet submitted for supervisor approval successfully!" });
      loadAllTimeData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || "Failed to submit timesheet" });
    }
    setSubmittingTimesheet(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/time/entries", manualForm);
      setMessage({ kind: "ok", text: "Manual time entry recorded successfully!" });
      setShowManualModal(false);
      setManualForm({
        taskId: "",
        date: new Date().toISOString().split("T")[0],
        durationHours: "1.0",
        category: "Work",
        notes: "",
      });
      loadAllTimeData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || "Failed to create manual entry" });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this time entry?")) return;
    try {
      await apiClient.delete(`/time/entries/${id}`);
      setMessage({ kind: "ok", text: "Time entry deleted successfully." });
      loadAllTimeData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || "Failed to delete entry" });
    }
  };

  const activeSeconds = (() => {
    let total = timer.accumulatedSeconds || 0;
    if (timer.running && timer.lastResumedAt) {
      total += Math.max(0, Math.floor((Date.now() - new Date(timer.lastResumedAt).getTime()) / 1000));
    }
    return total;
  })();

  const elapsed = (() => {
    const h = String(Math.floor(activeSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((activeSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(activeSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  })();

  const timerActive = timer.running || (timer.accumulatedSeconds > 0 && !!timer.task);

  const formatTimeRange = (start?: string, end?: string, dur?: number) => {
    if (!start && !end) return dur ? `${dur} hrs logged` : "--";
    try {
      const s = start ? new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
      const e = end ? new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
      return `${s} – ${e}`;
    } catch {
      return dur ? `${dur} hrs logged` : "--";
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-blue-500/30 text-blue-100 text-xs uppercase px-2.5 py-1 rounded-full font-semibold tracking-wider">
            Module 1 — Time Tracking System
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">Workforce Time & Timesheet Management</h1>
          <p className="text-blue-100 text-sm mt-1">
            Complete time tracking: live stopwatch, weekly timesheet grid, task-based work log history, and productivity analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveView("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "all" ? "bg-white text-blue-900 shadow-sm" : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            All-in-One View
          </button>
          <button
            onClick={() => setActiveView("timer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "timer" ? "bg-white text-blue-900 shadow-sm" : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            ⏱️ Stopwatch
          </button>
          <button
            onClick={() => setActiveView("timesheet")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "timesheet" ? "bg-white text-blue-900 shadow-sm" : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            📅 Weekly Timesheet
          </button>
          <button
            onClick={() => setActiveView("entries")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "entries" ? "bg-white text-blue-900 shadow-sm" : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            📋 Work History
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition"
          >
            + Manual Entry
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm border flex items-center justify-between ${
            message.kind === "ok" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TIME SUMMARIES METRIC CARDS (Requirement 4 - Always visible)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Hours */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Today's Working Hours
            </span>
            <span className="text-lg">☀️</span>
          </div>
          <div className="text-3xl font-extrabold text-blue-600">
            {timeSummary.todayHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Today: {timeSummary.todayHours || 0} hrs recorded</p>
        </div>

        {/* Card 2: This Week's Hours */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              This Week's Hours
            </span>
            <span className="text-lg">📅</span>
          </div>
          <div className="text-3xl font-extrabold text-indigo-600">
            {timeSummary.weekHours || 0} <span className="text-sm font-normal text-gray-500">/ 40 hrs</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round(((timeSummary.weekHours || 0) / 40) * 100))}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>This Week: {timeSummary.weekHours || 0} hrs</span>
            <span>{Math.round(((timeSummary.weekHours || 0) / 40) * 100)}% of goal</span>
          </div>
        </div>

        {/* Card 3: Monthly Logged Hours */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              This Month's Hours
            </span>
            <span className="text-lg">📈</span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {timeSummary.monthHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Current monthly cycle</p>
        </div>

        {/* Card 4: Total Time Entries Recorded */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
              Recorded Work Sessions
            </span>
            <span className="text-lg">📁</span>
          </div>
          <div className="text-3xl font-extrabold text-purple-600">
            {timeSummary.totalEntries || recentEntries.length}
          </div>
          <p className="text-xs text-gray-500 mt-1">Total tasks logged in history</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. WORKING HOURS STOPWATCH (Requirement 1)                                */}
      {/* ========================================================================= */}
      {(activeView === "all" || activeView === "timer") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stopwatch Widget */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>⏱️</span> 1. Working Hours (Live Stopwatch)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Start live timer for your task. Stopping automatically records an entry in your work log below.
                </p>
              </div>
              {timerActive && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  {timer.running ? "RECORDING" : "PAUSED"}
                </span>
              )}
            </div>

            {!timerActive ? (
              <div className="space-y-4 max-w-lg">
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Select Assigned Task to Track:
                </label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Choose a task from your board --</option>
                  {tasks.map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.title} ({t.priority || "Normal"}) - {t.category || "General"}
                    </option>
                  ))}
                </select>

                {can("timelog.record") ? (
                  <button
                    onClick={startTimer}
                    disabled={!taskId}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <span>▶</span> Start Timer for Selected Task
                  </button>
                ) : (
                  <p className="text-red-500 text-xs">You do not have permission to log time.</p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Task: <span className="text-blue-700 font-bold">{timer.taskTitle || "Work Task"}</span>
                </div>
                <div className="text-6xl font-extrabold tracking-tight text-gray-900 font-mono">
                  {elapsed}
                </div>
                <div className="flex justify-center gap-3 pt-2 max-w-md mx-auto">
                  {timer.running ? (
                    <button
                      onClick={pauseTimer}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeTimer}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
                    >
                      ▶ Resume
                    </button>
                  )}
                  <button
                    onClick={stopTimer}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
                  >
                    ⏹ Stop & Save
                  </button>
                  <button
                    onClick={discardTimer}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  >
                    Discard
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Timers under 1 minute are discarded automatically to keep records clean.
                </p>
              </div>
            )}
          </div>

          {/* Time Summary Breakdown by Task */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>📊</span> Time Summary by Task
            </h3>
            <p className="text-xs text-gray-500">
              Hours allocated per project task based on your logs.
            </p>

            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {timeSummary.taskBreakdown && timeSummary.taskBreakdown.length > 0 ? (
                timeSummary.taskBreakdown.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-800">
                      <span className="truncate max-w-[180px]">{item.taskTitle}</span>
                      <span className="text-blue-700">{item.hours} hrs</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>{item.entriesCount} recorded sessions</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-gray-400">
                  No task breakdown available yet. Run the stopwatch to generate statistics.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WEEKLY TIMESHEETS GRID (Requirement 2)                                 */}
      {/* ========================================================================= */}
      {(activeView === "all" || activeView === "timesheet") && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📅</span> 2. Weekly Timesheets (Monday to Friday Daily Task Breakdown)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Daily hours worked on each task across Monday through Friday / Sunday with total hours and supervisor submission.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  timesheetData.timesheet?.status === "Approved"
                    ? "bg-green-100 text-green-800"
                    : timesheetData.timesheet?.status === "Submitted"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Status: {timesheetData.timesheet?.status || "Draft"}
              </span>
              {timesheetData.timesheet?.status !== "Submitted" && timesheetData.timesheet?.status !== "Approved" && (
                <button
                  onClick={handleSubmitTimesheet}
                  disabled={submittingTimesheet}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  {submittingTimesheet ? "Submitting..." : "Submit Timesheet for Approval"}
                </button>
              )}
            </div>
          </div>

          {/* Weekly Timesheet Table with Per-Task Daily Hours */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-200">
                  <th className="py-3 px-4 text-left">Task Title & Category</th>
                  <th className="py-3 px-2">Mon (সোম)</th>
                  <th className="py-3 px-2">Tue (মঙ্গল)</th>
                  <th className="py-3 px-2">Wed (বুধ)</th>
                  <th className="py-3 px-2">Thu (বৃহঃ)</th>
                  <th className="py-3 px-2">Fri (শুক্র)</th>
                  <th className="py-3 px-2 text-gray-400">Sat (শনি)</th>
                  <th className="py-3 px-2 text-gray-400">Sun (রবি)</th>
                  <th className="py-3 px-4 font-bold text-blue-800 bg-blue-50/50">Total Hours (মোট)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {timesheetData.taskRows && timesheetData.taskRows.length > 0 ? (
                  timesheetData.taskRows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-left font-semibold text-gray-800">
                        <div>{row.taskTitle}</div>
                        <span className="text-[10px] text-gray-400 font-normal">{row.category || "Work"}</span>
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-700">{row.mon > 0 ? `${row.mon}h` : "—"}</td>
                      <td className="py-3 px-2 font-medium text-gray-700">{row.tue > 0 ? `${row.tue}h` : "—"}</td>
                      <td className="py-3 px-2 font-medium text-gray-700">{row.wed > 0 ? `${row.wed}h` : "—"}</td>
                      <td className="py-3 px-2 font-medium text-gray-700">{row.thu > 0 ? `${row.thu}h` : "—"}</td>
                      <td className="py-3 px-2 font-medium text-gray-700">{row.fri > 0 ? `${row.fri}h` : "—"}</td>
                      <td className="py-3 px-2 text-gray-400">{row.sat > 0 ? `${row.sat}h` : "—"}</td>
                      <td className="py-3 px-2 text-gray-400">{row.sun > 0 ? `${row.sun}h` : "—"}</td>
                      <td className="py-3 px-4 font-bold text-blue-700 bg-blue-50/30">
                        {row.total} hrs
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-semibold text-left text-gray-800">
                      General Logged Work
                    </td>
                    <td className="py-3 px-2 font-medium text-gray-700">{timesheetData.dailyTotals?.mon || 0}h</td>
                    <td className="py-3 px-2 font-medium text-gray-700">{timesheetData.dailyTotals?.tue || 0}h</td>
                    <td className="py-3 px-2 font-medium text-gray-700">{timesheetData.dailyTotals?.wed || 0}h</td>
                    <td className="py-3 px-2 font-medium text-gray-700">{timesheetData.dailyTotals?.thu || 0}h</td>
                    <td className="py-3 px-2 font-medium text-gray-700">{timesheetData.dailyTotals?.fri || 0}h</td>
                    <td className="py-3 px-2 text-gray-400">{timesheetData.dailyTotals?.sat || 0}h</td>
                    <td className="py-3 px-2 text-gray-400">{timesheetData.dailyTotals?.sun || 0}h</td>
                    <td className="py-3 px-4 font-bold text-blue-700 bg-blue-50/50">
                      {timesheetData.grandTotal || 0} hrs
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Grand Total Summary Row */}
              <tfoot>
                <tr className="bg-gray-100/80 font-bold text-gray-900 border-t-2 border-gray-300">
                  <td className="py-3 px-4 text-left uppercase text-[11px] tracking-wider text-gray-700">
                    Daily Total Hours (দৈনিক মোট)
                  </td>
                  <td className="py-3 px-2 text-indigo-700">{timesheetData.dailyTotals?.mon || 0}h</td>
                  <td className="py-3 px-2 text-indigo-700">{timesheetData.dailyTotals?.tue || 0}h</td>
                  <td className="py-3 px-2 text-indigo-700">{timesheetData.dailyTotals?.wed || 0}h</td>
                  <td className="py-3 px-2 text-indigo-700">{timesheetData.dailyTotals?.thu || 0}h</td>
                  <td className="py-3 px-2 text-indigo-700">{timesheetData.dailyTotals?.fri || 0}h</td>
                  <td className="py-3 px-2 text-gray-500">{timesheetData.dailyTotals?.sat || 0}h</td>
                  <td className="py-3 px-2 text-gray-500">{timesheetData.dailyTotals?.sun || 0}h</td>
                  <td className="py-3 px-4 text-base font-extrabold text-blue-800 bg-blue-100/70">
                    {timesheetData.grandTotal || timeSummary.weekHours || 0} hrs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>Standard Weekly Target: 40.0 hours</span>
            <span>
              {timesheetData.timesheet?.approvedByName
                ? `Approved by: ${timesheetData.timesheet.approvedByName}`
                : `Week Period: ${timesheetData.timesheet?.weekLabel || "Current Week"}`}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TASK-BASED TIME ENTRIES LOG HISTORY (Requirement 3)                    */}
      {/* ========================================================================= */}
      {(activeView === "all" || activeView === "entries") && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📋</span> 3. Task-Based Time Entries (কাজের বিবরণী হিস্ট্রি)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                History of recorded work sessions: task name, start to end time (কয়টা থেকে কয়টা), total duration (মোট সময়), and status.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                {recentEntries.length} Recorded Sessions
              </span>
              <button
                onClick={() => setShowManualModal(true)}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-lg transition"
              >
                + Add Time Log
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                  <th className="py-3 px-3">Date (তারিখ)</th>
                  <th className="py-3 px-3">Task Title (টাস্কের নাম)</th>
                  <th className="py-3 px-3">Time Range (কয়টা থেকে কয়টা)</th>
                  <th className="py-3 px-3">Total Duration (মোট সময়)</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentEntries.length > 0 ? (
                  recentEntries.map((entry: any) => (
                    <tr key={entry._id || entry.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-3 font-medium text-gray-600">
                        {entry.date}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        <div>{entry.taskTitle || "Work Task"}</div>
                        {entry.notes && (
                          <div className="text-[11px] text-gray-400 font-normal truncate max-w-xs">{entry.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-600 font-medium">
                        {formatTimeRange(entry.startTime, entry.endTime, entry.durationHours)}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-blue-700 text-sm">
                        {entry.durationHours} hrs
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {entry.category || "Work"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 uppercase text-[10px]">
                        <span className={`px-2 py-0.5 rounded ${entry.source === "timer" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                          {entry.source || "timer"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            entry.status === "Approved"
                              ? "bg-green-100 text-green-800"
                              : entry.status === "Submitted"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {entry.status || "Submitted"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteEntry(entry._id || entry.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition"
                          title="Delete entry"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      {loadingHistory ? "Loading time entries history..." : "No recorded time entries found. Start the stopwatch above to record work."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Time Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Log Past Work Session</h3>
              <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Task:</label>
                <select
                  required
                  value={manualForm.taskId}
                  onChange={(e) => setManualForm({ ...manualForm, taskId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- Choose Task --</option>
                  {tasks.map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Date:</label>
                  <input
                    type="date"
                    required
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Duration (Hours):</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    required
                    value={manualForm.durationHours}
                    onChange={(e) => setManualForm({ ...manualForm, durationHours: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category:</label>
                <select
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="Work">Work</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Training">Training</option>
                  <option value="Review">Review</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes / Description:</label>
                <textarea
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="What did you work on during this time?"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timer;

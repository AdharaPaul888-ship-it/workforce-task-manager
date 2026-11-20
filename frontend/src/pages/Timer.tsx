import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AppContext";
import {
  apiClient,
  getTimeSummary,
  getWeeklyTimesheet,
  submitTimesheet,
  getTimeEntries
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

  // 2. Time Summaries State
  const [timeSummary, setTimeSummary] = useState<any>({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    totalHours: 0,
    totalEntries: 0,
    taskBreakdown: [],
  });

  // 3. Timesheets State
  const [timesheet, setTimesheet] = useState<any>(null);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);

  // 4. Task-based Time Entries State
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Active Tab View
  const [activeView, setActiveView] = useState<"timer" | "timesheet" | "entries">("timer");

  const applyTimer = (data: any) => {
    setTimer({
      running: !!data.running,
      accumulatedSeconds: data.accumulatedSeconds || 0,
      lastResumedAt: data.lastResumedAt || null,
      task: data.task || null,
      taskTitle: data.taskTitle || null,
    });
  };

  const loadAllTimeData = async () => {
    try {
      // Load current timer
      const timerResp = await apiClient.get("/time/timer");
      applyTimer(timerResp.data.data);

      // Load tasks
      const taskResp = await apiClient.get("/tasks");
      setTasks(taskResp.data.data || []);

      // Load Time Summaries (Requirement 4)
      const summaryResp = await getTimeSummary();
      if (summaryResp.data?.data) {
        setTimeSummary(summaryResp.data.data);
      }

      // Load Weekly Timesheet (Requirement 2)
      const sheetResp = await getWeeklyTimesheet();
      if (sheetResp.data?.data) {
        setTimesheet(sheetResp.data.data);
      }

      // Load Task-Based Entries (Requirement 3)
      setLoadingHistory(true);
      const entriesResp = await getTimeEntries();
      if (entriesResp.data?.data) {
        setRecentEntries(entriesResp.data.data);
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

  const run = async (fn: () => Promise<any>, onOk: (data: any) => void, errText: string) => {
    setMessage(null);
    try {
      const resp = await fn();
      onOk(resp.data.data);
      refreshBadges();
      loadAllTimeData();
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || errText });
    }
  };

  const startTimer = () => {
    if (!taskId || !can("timelog.record")) return;
    run(
      () => apiClient.post("/time/timer/start", { taskId }),
      (data) => {
        applyTimer(data);
        setMessage({ kind: "ok", text: `Timer started for “${data.taskTitle}”` });
      },
      "Failed to start timer"
    );
  };

  const pauseTimer = () =>
    run(
      () => apiClient.post("/time/timer/pause"),
      (data) => applyTimer(data),
      "Failed to pause timer"
    );

  const resumeTimer = () =>
    run(
      () => apiClient.post("/time/timer/resume"),
      (data) => applyTimer(data),
      "Failed to resume timer"
    );

  const stopTimer = () =>
    run(
      () => apiClient.post("/time/timer/stop", { notes: "Logged via workforce timer" }),
      (data) => {
        applyTimer({ running: false, accumulatedSeconds: 0, lastResumedAt: null, task: null, taskTitle: null });
        setTaskId("");
        if (data.discarded) {
          setMessage({ kind: "ok", text: data.message || "Timer under 1 minute, discarded" });
        } else {
          setMessage({ kind: "ok", text: `Time entry successfully recorded (${data.durationHours} h)` });
        }
        setBadges({ ...badges, timer: { running: false, startedAt: null, accumulatedSeconds: 0 } });
      },
      "Failed to stop timer"
    );

  const discardTimer = () =>
    run(
      () => apiClient.post("/time/timer/discard"),
      () => {
        applyTimer({ running: false, accumulatedSeconds: 0, lastResumedAt: null, task: null, taskTitle: null });
        setTaskId("");
        setMessage({ kind: "ok", text: "Timer discarded" });
      },
      "Failed to discard timer"
    );

  const handleSubmitTimesheet = async () => {
    if (!timesheet?._id && !timesheet?.id) return;
    setSubmittingTimesheet(true);
    try {
      const id = timesheet._id || timesheet.id;
      const resp = await submitTimesheet(id);
      setTimesheet(resp.data.data);
      setMessage({ kind: "ok", text: "Timesheet submitted for managerial approval!" });
    } catch (err: any) {
      setMessage({ kind: "err", text: err.response?.data?.message || "Failed to submit timesheet" });
    }
    setSubmittingTimesheet(false);
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

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Module Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-blue-500/30 text-blue-100 text-xs uppercase px-2.5 py-1 rounded-full font-semibold tracking-wider">
            Module 1 — Time Tracking
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">Time Tracking & Timesheet Manager</h1>
          <p className="text-blue-100 text-sm mt-1">
            Working hours stopwatch, weekly timesheets, task-based time entries, and time analytics.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView("timer")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "timer"
                ? "bg-white text-blue-900 shadow-sm"
                : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            ⏱️ Timer & Summaries
          </button>
          <button
            onClick={() => setActiveView("timesheet")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "timesheet"
                ? "bg-white text-blue-900 shadow-sm"
                : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            📅 Weekly Timesheet
          </button>
          <button
            onClick={() => setActiveView("entries")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeView === "entries"
                ? "bg-white text-blue-900 shadow-sm"
                : "bg-blue-600/40 text-white hover:bg-blue-600/60"
            }`}
          >
            📋 Time Entries Log
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm border flex items-center justify-between ${
            message.kind === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* REQUIREMENT 4: TIME SUMMARIES METRIC CARDS (Always visible) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Today's Working Hours
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {timeSummary.todayHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Logged today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            This Week's Hours
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {timeSummary.weekHours || 0} <span className="text-sm font-normal text-gray-500">/ 40 hrs</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.round(((timeSummary.weekHours || 0) / 40) * 100))}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Monthly Logged
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {timeSummary.monthHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Current month cycle</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Time Entries
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {timeSummary.totalEntries || recentEntries.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Historical tasks recorded</p>
        </div>
      </div>

      {/* VIEW 1: LIVE WORKING HOURS STOPWATCH (Requirement 1) */}
      {activeView === "timer" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stopwatch Widget */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>⏱️</span> 1. Working Hours (Live Stopwatch)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Start live timer for your task. Stopping creates an entry in your timesheet.
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
                      {t.title} ({t.priority || "Normal"})
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

          {/* Task-Wise Time Breakdown (Requirement 4 extended) */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>📊</span> Time Summary by Task
            </h3>
            <p className="text-xs text-gray-500">
              Hours allocated per project task based on your logs.
            </p>

            <div className="space-y-3">
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
                  No task breakdown available yet. Log time using the stopwatch to see statistics.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY TIMESHEETS GRID (Requirement 2) */}
      {activeView === "timesheet" && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📅</span> 2. Weekly Timesheets
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Week-by-week aggregated timesheet grid with daily breakdowns and approval status.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  timesheet?.status === "Approved"
                    ? "bg-green-100 text-green-800"
                    : timesheet?.status === "Submitted"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Status: {timesheet?.status || "Draft"}
              </span>
              {timesheet?.status !== "Submitted" && timesheet?.status !== "Approved" && (
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

          {/* Weekly Timesheet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-200">
                  <th className="py-3 px-4 text-left">Category / Day</th>
                  <th className="py-3 px-2">Mon</th>
                  <th className="py-3 px-2">Tue</th>
                  <th className="py-3 px-2">Wed</th>
                  <th className="py-3 px-2">Thu</th>
                  <th className="py-3 px-2">Fri</th>
                  <th className="py-3 px-2 text-gray-400">Sat</th>
                  <th className="py-3 px-2 text-gray-400">Sun</th>
                  <th className="py-3 px-4 font-bold text-blue-800">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-semibold text-left text-gray-800">
                    Logged Work Hours
                  </td>
                  <td className="py-3 px-2 font-medium text-gray-700">{timesheet?.dailyHours?.mon || 0}h</td>
                  <td className="py-3 px-2 font-medium text-gray-700">{timesheet?.dailyHours?.tue || 0}h</td>
                  <td className="py-3 px-2 font-medium text-gray-700">{timesheet?.dailyHours?.wed || 0}h</td>
                  <td className="py-3 px-2 font-medium text-gray-700">{timesheet?.dailyHours?.thu || 0}h</td>
                  <td className="py-3 px-2 font-medium text-gray-700">{timesheet?.dailyHours?.fri || 0}h</td>
                  <td className="py-3 px-2 text-gray-400">{timesheet?.dailyHours?.sat || 0}h</td>
                  <td className="py-3 px-2 text-gray-400">{timesheet?.dailyHours?.sun || 0}h</td>
                  <td className="py-3 px-4 font-bold text-blue-700 bg-blue-50/50">
                    {timesheet?.totalHours || timeSummary.weekHours || 0} hrs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>Standard Weekly Requirement: 40 hours</span>
            <span>
              {timesheet?.approvedByName && `Approved by: ${timesheet.approvedByName}`}
            </span>
          </div>
        </div>
      )}

      {/* VIEW 3: TASK-BASED TIME ENTRIES TABLE (Requirement 3) */}
      {activeView === "entries" && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📋</span> 3. Task-Based Time Entries Log
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Detailed audit trail of all recorded working sessions linked to respective tasks.
              </p>
            </div>
            <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
              {recentEntries.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Task Title</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentEntries.length > 0 ? (
                  recentEntries.map((entry: any) => (
                    <tr key={entry._id || entry.id} className="hover:bg-gray-50/60">
                      <td className="py-3 px-3 font-medium text-gray-600">
                        {entry.date}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {entry.taskTitle || "Work Task"}
                      </td>
                      <td className="py-3 px-3 font-bold text-blue-700">
                        {entry.durationHours} hrs
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {entry.category || "Work"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 uppercase text-[10px]">
                        {entry.source || "timer"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      {loadingHistory ? "Loading time entries..." : "No recorded time entries found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timer;

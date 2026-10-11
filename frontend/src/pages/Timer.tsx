import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AppContext";
import { apiClient } from "../services/apiClient";

const Timer = () => {
  const { user, badges, setBadges, can, refreshBadges } = useAuth();
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

  const applyTimer = (data: any) => {
    setTimer({
      running: !!data.running,
      accumulatedSeconds: data.accumulatedSeconds || 0,
      lastResumedAt: data.lastResumedAt || null,
      task: data.task || null,
      taskTitle: data.taskTitle || null,
    });
  };

  useEffect(() => {
    apiClient
      .get("/time/timer")
      .then((resp) => applyTimer(resp.data.data))
      .catch(() => {});

    apiClient
      .get("/tasks")
      .then((resp) => setTasks(resp.data.data || []))
      .catch(() => {});
  }, [user]);

  // Tick every second while the timer is running so the clock advances
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
      () => apiClient.post("/time/timer/stop", { notes: "" }),
      (data) => {
        applyTimer({ running: false, accumulatedSeconds: 0, lastResumedAt: null, task: null, taskTitle: null });
        setTaskId("");
        if (data.discarded) {
          setMessage({ kind: "ok", text: data.message || "Timer under 1 minute, discarded" });
        } else {
          setMessage({ kind: "ok", text: `Time entry recorded (${data.durationHours} h)` });
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
    <div className="p-2">
      <h1 className="text-2xl font-bold mb-6">Time Tracker</h1>

      {message && (
        <p className={`mb-4 text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      {!timerActive && (
        <div className="bg-white p-4 rounded shadow-sm mb-6 max-w-xl">
          <h2 className="font-medium mb-2">Start Timer</h2>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="w-full px-3 py-2 border rounded mb-4"
          >
            <option value="">Select a task</option>
            {tasks.map((t) => (
              <option key={t._id || t.id} value={t._id || t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {can("timelog.record") ? (
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={startTimer}
              disabled={!taskId}
            >
              Start
            </button>
          ) : (
            <p className="text-red-500 text-sm">You don't have permission to start the timer</p>
          )}
        </div>
      )}

      {timerActive && (
        <div className="bg-white p-4 rounded shadow-sm mb-6 max-w-xl">
          <h2 className="font-medium">{timer.running ? "Running Timer" : "Paused Timer"}</h2>
          {timer.taskTitle && <p className="text-sm text-gray-500">{timer.taskTitle}</p>}
          <p className="text-3xl font-bold tabular-nums mt-1">{elapsed}</p>
          <div className="flex gap-4 mt-4">
            {timer.running ? (
              <button onClick={pauseTimer} className="flex-1 bg-yellow-400 px-4 py-2 rounded">
                Pause
              </button>
            ) : (
              <button onClick={resumeTimer} className="flex-1 bg-green-500 text-white px-4 py-2 rounded">
                Resume
              </button>
            )}
            <button onClick={stopTimer} className="flex-1 bg-red-500 text-white px-4 py-2 rounded">
              Stop
            </button>
            <button onClick={discardTimer} className="flex-1 bg-gray-300 px-4 py-2 rounded">
              Discard
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Stopping creates a time entry; timers under 1 minute are discarded automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default Timer;

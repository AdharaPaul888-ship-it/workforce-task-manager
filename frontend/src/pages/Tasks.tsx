import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AppContext";
import { apiClient } from "../services/apiClient";

const STATUSES = ["All", "Draft", "Submitted", "Approved", "Rejected"];

const Tasks = () => {
  const { user, can, refreshBadges } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", desc: "", category: "Admin", priority: "Medium", dueDate: "" });
  const [error, setError] = useState("");

  const loadTasks = async () => {
    try {
      const resp = await apiClient.get("/tasks", { params: status !== "All" ? { status } : {} });
      setTasks(resp.data.data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiClient.post("/tasks", form);
      setForm({ title: "", desc: "", category: "Admin", priority: "Medium", dueDate: "" });
      setShowForm(false);
      refreshBadges();
      loadTasks();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create task");
    }
  };

  if (!can("tasks.view") && user?.role !== "Super Admin") {
    return <p className="text-red-500">You don't have permission to view tasks</p>;
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        {can("tasks.create") && (
          <button
            className="bg-blue-500 text-white px-4 py-1 rounded"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancel" : "New Task"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={createTask} className="bg-white p-4 rounded mb-4 grid grid-cols-5 gap-3">
          <input
            className="border p-2 col-span-2"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select className="border p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {["Field Visit", "Sales", "Collection", "Admin", "Service"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="border p-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="date" className="border p-2" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <input
            className="border p-2 col-span-4"
            placeholder="Description"
            value={form.desc}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
          />
          <button type="submit" className="bg-green-500 text-white px-4 py-1 rounded">Create</button>
          {error && <p className="col-span-5 text-red-500 text-sm">{error}</p>}
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded text-sm ${status === s ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {tasks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Priority</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Due</th>
                <th className="p-3 text-left">Progress</th>
                <th className="p-3 text-left">Owner</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t._id} className="border-b last:border-0">
                  <td className="p-3">{t.title}</td>
                  <td className="p-3">{t.category || "-"}</td>
                  <td className="p-3">{t.priority || "-"}</td>
                  <td className="p-3">
                    <span
                      className={
                        t.status === "Approved" ? "bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm" :
                        t.status === "Rejected" ? "bg-red-100 text-red-800 px-2 py-0.5 rounded text-sm" :
                        t.status === "Submitted" ? "bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-sm" :
                        "bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-sm"
                      }
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3">{t.due ? new Date(t.due).toLocaleDateString() : "-"}</td>
                  <td className="p-3">{t.progress ?? 0}%</td>
                  <td className="p-3">{t.owner?.name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No tasks found</p>
      )}
    </div>
  );
};

export default Tasks;

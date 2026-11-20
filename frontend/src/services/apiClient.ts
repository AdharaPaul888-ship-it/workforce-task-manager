import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getDashboardStats = (params?: { view?: "my" | "team" }) =>
  apiClient.get("/dashboard/stats", { params });

// Leave & Holiday APIs
export const getLeaveBalance = (userId?: string) =>
  apiClient.get("/leaves/balance", { params: userId ? { userId } : {} });

export const getLeaveRequests = (params?: { scope?: string; status?: string; year?: number }) =>
  apiClient.get("/leaves", { params });

export const createLeaveRequest = (data: {
  type: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
  reason: string;
  certificate?: string;
}) => apiClient.post("/leaves", data);

export const updateLeaveStatus = (id: string, data: { status: string; remarks?: string }) =>
  apiClient.put(`/leaves/${id}/status`, data);

export const deleteLeaveRequest = (id: string) =>
  apiClient.delete(`/leaves/${id}`);

export const previewLeave = (data: {
  type: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
}) => apiClient.post("/leaves/preview", data);

export const getHolidays = (year?: number) =>
  apiClient.get("/holidays", { params: year ? { year } : {} });

export const createHoliday = (data: {
  title: string;
  date: string;
  type: string;
  description?: string;
}) => apiClient.post("/holidays", data);

export const deleteHoliday = (id: string) =>
  apiClient.delete(`/holidays/${id}`);

// Time Tracking APIs
export const getTimeSummary = (userId?: string) =>
  apiClient.get("/time/summary", { params: userId ? { userId } : {} });

export const getTimeEntries = (params?: { userId?: string; from?: string; to?: string }) =>
  apiClient.get("/time/entries", { params });

export const getWeeklyTimesheet = (params?: { start?: string; userId?: string }) =>
  apiClient.get("/time/timesheets/week", { params });

export const updateTimesheetCell = (id: string, data: { day: string; hours: number }) =>
  apiClient.put(`/time/timesheets/${id}/cell`, data);

export const submitTimesheet = (id: string) =>
  apiClient.post(`/time/timesheets/${id}/submit`);

export default apiClient;
export { apiClient };

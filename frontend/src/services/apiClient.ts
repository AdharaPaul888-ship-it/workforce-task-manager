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

export default apiClient;
export { apiClient };

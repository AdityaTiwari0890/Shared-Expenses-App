import axios, { AxiosInstance } from 'axios';

const API_URL = (import.meta as any).env.VITE_API_BASE_URL;

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Export API endpoints
export const authAPI = {
  register: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getCurrentUser: () =>
    api.get('/auth/me')
};

export const groupsAPI = {
  createGroup: (data: { name: string; description?: string }) =>
    api.post('/groups', data),
  getGroups: () =>
    api.get('/groups'),
  getGroup: (groupId: string) =>
    api.get(`/groups/${groupId}`),
  addMember: (groupId: string, userId: string) =>
    api.post(`/groups/${groupId}/members`, { user_id: userId }),
  removeMember: (groupId: string, userId: string) =>
    api.post(`/groups/${groupId}/members/${userId}/remove`)
};

export const expensesAPI = {
  createExpense: (groupId: string, data: any) =>
    api.post(`/groups/${groupId}/expenses`, data),
  getExpenses: (groupId: string) =>
    api.get(`/groups/${groupId}/expenses`),
  getExpense: (groupId: string, expenseId: string) =>
    api.get(`/groups/${groupId}/expenses/${expenseId}`),
  deleteExpense: (groupId: string, expenseId: string) =>
    api.delete(`/groups/${groupId}/expenses/${expenseId}`),
  getBalances: (groupId: string) =>
    api.get(`/groups/${groupId}/balances`),
  getMyBalance: (groupId: string) =>
    api.get(`/groups/${groupId}/my-balance`),
  exportCSV: (groupId: string) =>
    api.get(`/groups/${groupId}/export-csv`, { responseType: 'blob' })
};

export const settlementsAPI = {
  recordSettlement: (groupId: string, data: any) =>
    api.post(`/groups/${groupId}/settle`, data),
  getSettlements: (groupId: string) =>
    api.get(`/groups/${groupId}/settlements`),
  getMySettlements: (groupId: string) =>
    api.get(`/groups/${groupId}/my-settlements`)
};

export const importAPI = {
  previewCSV: (groupId: string, csvContent: string) =>
    api.post(`/import/${groupId}/preview`, { csv_content: csvContent }),
  finalizeImport: (groupId: string, importLogId: string, approvals: Record<string, boolean>) =>
    api.post(`/import/${groupId}/finalize/${importLogId}`, { approvals }),
  getImportHistory: (groupId: string) =>
    api.get(`/import/${groupId}/history`)
};

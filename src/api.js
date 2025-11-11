import axios from 'axios';

// Centralized Axios instances for different backends

export const interviewApi = axios.create({
  baseURL: 'http://localhost:8001',
});
// export const interviewApi = axios.create({
//   baseURL: 'https://mirella-predeficient-preoccupiedly.ngrok-free.dev',
//   headers: { 'ngrok-skip-browser-warning': 'true' },
// });
export const adminApi = axios.create({
  baseURL: 'http://localhost:8001',
});

export const backendApi = axios.create({
  baseURL: 'http://localhost:8001',
});

export const pistonApi = axios.create({
  baseURL: 'https://emkc.org/api/v2/piston',
  timeout: 15000,
});

export const fetchPistonRuntimes = () => pistonApi.get('/runtimes');

export const executeWithPiston = (payload) => pistonApi.post('/execute', payload);

// export const backendApi = axios.create({
//   baseURL: 'https://mirella-predeficient-preoccupiedly.ngrok-free.dev',
//   headers: { 'ngrok-skip-browser-warning': 'true' },
// });

export const fetchPrograms = () => backendApi.get('/programs');

export const fetchProgramJobRoles = (programId) =>
  backendApi.get(`/programs/${programId}/job_roles`);

export const fetchJobRolesByWorkExperience = (workExperience, programName) =>
  backendApi.get('/job-roles/by-work-experience', {
    params: {
      work_experience: workExperience,
      ...(programName ? { program_name: programName } : {}),
    },
  });

export const registerStudent = (payload) => backendApi.post('/students/register', payload);

export const fetchInterviewTypes = () => adminApi.get('/admin/interview-types');

export const fetchPublicInterviewTypes = (params = {}) =>
  backendApi.get('/metadata/interview-types', { params });

export const fetchWorkExperienceLevels = () => adminApi.get('/admin/work-experience-levels');

export const fetchPublicWorkExperienceLevels = (params = {}) =>
  backendApi.get('/metadata/work-experience-levels', { params });

export const fetchQuestionTypes = () => adminApi.get('/admin/question-types');


export const fetchStudentProfile = (email) => backendApi.get(`/students/profile/${email}`);

export const loginStudent = (payload) => backendApi.post('/students/login', payload);

export const requestPasswordReset = (email) =>
  backendApi.post('/students/password/forgot', { email });

export const resetPassword = (payload) =>
  backendApi.post('/students/password/reset', payload);

export const importStudentsCsv = (formData) =>
  backendApi.post('/mentors/students/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const fetchAdminDashboardStats = () => adminApi.get('/admin/dashboard');

export const fetchAdminStudents = (params = {}) =>
  adminApi.get('/admin/students', { params });

export const fetchAdminSessions = (params = {}) =>
  adminApi.get('/admin/sessions', { params });

export const fetchAdminPerformanceAnalytics = (params = {}) =>
  adminApi.get('/admin/analytics/performance', { params });

export const fetchAdminLeaderboard = (params = {}) =>
  adminApi.get('/admin/analytics/leaderboard', { params });

export const fetchAdminSessionReport = (sessionId) =>
  adminApi.get(`/admin/session/${sessionId}/detailed`);

// You can also add interceptors here for handling tokens or errors globally
adminApi.interceptors.request.use(config => {
  // Using the default admin token from your backend configuration
  config.headers.Authorization = 'Bearer admin_secret_123';
  return config;
});

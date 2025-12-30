import axios from 'axios';

// Centralized Axios instances for different backends

// export const interviewApi = axios.create({
//   baseURL: 'http://localhost:8001',
// });
// // export const interviewApi = axios.create({
// //   baseURL: 'https://mirella-predeficient-preoccupiedly.ngrok-free.dev',
// //   headers: { 'ngrok-skip-browser-warning': 'true' },
// // });
// export const adminApi = axios.create({
//   baseURL: 'http://localhost:8001',
// });

// export const backendApi = axios.create({
//   baseURL: 'http://localhost:8001',
// });

export const interviewApi = axios.create({
  baseURL: 'https://mockinterview-backend.futurense.com',
});
// export const interviewApi = axios.create({
//   baseURL: 'https://mirella-predeficient-preoccupiedly.ngrok-free.dev',
//   headers: { 'ngrok-skip-browser-warning': 'true' },
// });
export const adminApi = axios.create({
  baseURL: 'https://mockinterview-backend.futurense.com',
});

export const backendApi = axios.create({
  baseURL: 'https://mockinterview-backend.futurense.com',
});

// Piston is self-hosted behind the FastAPI backend; the frontend never talks
// to the Piston container directly to avoid CORS issues.
export const fetchPistonRuntimes = () => backendApi.get('/piston/runtimes');

export const executeWithPiston = (payload) => backendApi.post('/piston/execute', payload);

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
export const fetchAdminInsights = () => adminApi.get('/admin/analytics/insights');

// Admin program / role mapping helpers
export const fetchAdminJobRoles = () => adminApi.get('/admin/job-roles');

export const mapProgramRoles = (payload) =>
  adminApi.post('/admin/programs/map-roles', payload);

export const fetchAdminUbpPerformance = () =>
  adminApi.get('/admin/analytics/ubp-performance');

export const fetchAdminRetention = () =>
  adminApi.get('/admin/analytics/retention');

export const fetchAdminLeaderboard = (params = {}) =>
  adminApi.get('/admin/leaderboard', { params });

export const fetchAdminLeaderboardFilters = () =>
  adminApi.get('/admin/filter-options');

export const fetchAdminRoleFilterOptions = (params = {}) =>
  adminApi.get('/admin/filter-options/roles', { params });

export const createInterviewQuestion = (payload) => adminApi.post('/admin/interview-questions', payload);

export const bulkUploadInterviewQuestions = (formData) =>
  adminApi.post('/admin/interview-questions/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const fetchAdminSessionReport = (sessionId) =>
  adminApi.get(`/admin/session/${sessionId}/detailed`);

export const fetchAdminStudentAnalytics = (studentId) =>
  adminApi.get(`/admin/student/${studentId}/analytics`);

export const fetchSessionRating = (sessionId, email) =>
  backendApi.get(`/students/sessions/${sessionId}/rating`, { params: { student_email: email } });

export const submitSessionRating = (sessionId, email, payload) =>
  backendApi.post(`/students/sessions/${sessionId}/rating`, payload, { params: { student_email: email } });

// Feedback async helpers
export const getFeedbackStatus = (sessionId) =>
  backendApi.get(`/feedback-status/${sessionId}`);

export const triggerFeedbackGeneration = (sessionId) =>
  backendApi.post(`/interview/${sessionId}/generate-feedback`);

// Admin authentication helpers
let adminAuthToken = null;

export const setAdminAuthToken = (token) => {
  adminAuthToken = token || null;
};

export const adminLogin = (payload) => adminApi.post('/admin/auth/login', payload);
export const adminLogout = () => adminApi.post('/admin/auth/logout');
export const fetchAdminProfile = () => adminApi.get('/admin/auth/me');

// Apply auth token to outbound admin requests when available
adminApi.interceptors.request.use((config) => {
  if (adminAuthToken) {
    config.headers.Authorization = `Bearer ${adminAuthToken}`;
  }
  return config;
});

// UBP metadata and resolver
export const fetchUniversities = () => backendApi.get('/ubp/universities');
export const fetchUbpPrograms = (universityName) =>
  backendApi.get('/ubp/programs', { params: { university_name: universityName } });
export const fetchUbpBatches = (universityName, programName) =>
  backendApi.get('/ubp/batches', { params: { university_name: universityName, program_name: programName } });
export const resolveUbp = (universityName, programName, batchLabel) =>
  backendApi.get('/ubp/resolve', { params: { university_name: universityName, program_name: programName, batch_label: batchLabel } });

// Student/public interview options cascading from interview_questions table
export const fetchInterviewIndustries = () => backendApi.get('/interview-options/industries');
export const fetchInterviewCompanies = (industry) =>
  backendApi.get('/interview-options/companies', { params: { industry } });
export const fetchIndustryInterviewTypes = (industry, company) =>
  backendApi.get('/interview-options/interview-types', { params: { industry, company } });
export const fetchIndustryWorkExperience = (industry, company, interviewType) =>
  backendApi.get('/interview-options/work-experience', { params: { industry, company, interview_type: interviewType } });
export const fetchIndustryJobRoles = (industry, company, interviewType, workExperience, programName) =>
  backendApi.get('/interview-options/job-roles', {
    params: {
      industry,
      company,
      interview_type: interviewType,
      work_experience: workExperience,
      ...(programName ? { program_name: programName } : {}),
    },
  });

// Admin interview options cascading (AdminPage) - uses dedicated admin routes
export const fetchAdminIndustries = () => adminApi.get('/admin/industry-types');
export const fetchBulkUploadOptions = () => adminApi.get('/admin/bulk-upload-options');
export const fetchAdminCompanies = (industry) =>
  adminApi.get('/admin/interview-options/companies', { params: { industry } });
export const fetchAdminIndustryInterviewTypes = (industry, company) =>
  adminApi.get('/admin/interview-options/interview-types', { params: { industry, company } });
export const fetchAdminIndustryWorkExperience = (industry, company, interviewType) =>
  adminApi.get('/admin/interview-options/work-experience', {
    params: { industry, company, interview_type: interviewType },
  });
export const fetchAdminIndustryJobRoles = (industry, company, interviewType, workExperience) =>
  adminApi.get('/admin/interview-options/job-roles', {
    params: {
      industry,
      company,
      interview_type: interviewType,
      work_experience: workExperience,
    },
  });

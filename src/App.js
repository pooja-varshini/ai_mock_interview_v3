import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import InterviewScreen from './InterviewScreen';
import StudentLogin from './StudentLogin';
import MentorRegister from './MentorRegister';
import Dashboard from './Dashboard';
import InstructionScreen from './InstructionScreen';
import AdminPage from './AdminPage';
import AdminLogin from './AdminLogin';
import { ToastContainer, toast } from 'react-toastify';
import { FiZap } from 'react-icons/fi';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import {
    adminLogin as authenticateAdmin,
    adminLogout as invalidateAdmin,
    fetchAdminProfile,
    setAdminAuthToken,
} from './api';

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [student, setStudent] = useState(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [interviewData, setInterviewData] = useState(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [dashboardRefresh, setDashboardRefresh] = useState(0);
    const [adminSession, setAdminSession] = useState(null);
    const [adminLoading, setAdminLoading] = useState(true);

    useEffect(() => {
        const loggedInStudent = localStorage.getItem('student');
        if (loggedInStudent) {
            setStudent(JSON.parse(loggedInStudent));
        }
        const storedAdminToken = sessionStorage.getItem('adminToken');
        if (storedAdminToken) {
            setAdminAuthToken(storedAdminToken);
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        const publicRoutes = ['/', '/login', '/register', '/admin/login'];

        if (student) {
            if (location.pathname === '/' || location.pathname === '/login') {
                navigate('/dashboard', { replace: true });
            }
        } else if (!publicRoutes.includes(location.pathname) && !location.pathname.startsWith('/admin')) {
            navigate('/login', { replace: true });
        }
    }, [student, location.pathname, navigate, isHydrated]);

    const hydrateAdminProfile = useCallback(async () => {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            setAdminAuthToken(null);
            setAdminSession(null);
            setAdminLoading(false);
            return;
        }

        setAdminAuthToken(token);
        try {
            const { data } = await fetchAdminProfile();
            setAdminSession({ ...data, token });
        } catch (error) {
            console.error('Failed to refresh admin session', error);
            sessionStorage.removeItem('adminToken');
            setAdminAuthToken(null);
            setAdminSession(null);
        } finally {
            setAdminLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isHydrated) return;
        hydrateAdminProfile();
    }, [hydrateAdminProfile, isHydrated]);

    const handleLogin = (studentData) => {
        localStorage.setItem('student', JSON.stringify(studentData));
        setStudent(studentData);
        navigate('/dashboard', { replace: true });
        addToast(`Welcome, ${studentData.name}!`, 'success');
    };

    const handleLogout = () => {
        localStorage.removeItem('student');
        setStudent(null);
        setInterviewData(null);
        setShowInstructions(false);
        navigate('/login', { replace: true });
        addToast('You have been logged out.', 'info');
    };

    const handleAdminLogin = async (credentials) => {
        try {
            const { data } = await authenticateAdmin(credentials);
            sessionStorage.setItem('adminToken', data.access_token);
            setAdminAuthToken(data.access_token);
            setAdminSession({ ...data });
            addToast(`Welcome, ${data.display_name || data.email}!`, 'success');
            navigate('/admin', { replace: true });
        } catch (error) {
            console.error('Admin login failed', error);
            throw error;
        }
    };

    const handleAdminLogout = async () => {
        try {
            await invalidateAdmin();
        } catch (error) {
            console.warn('Admin logout request failed', error);
        }
        sessionStorage.removeItem('adminToken');
        setAdminAuthToken(null);
        setAdminSession(null);
        addToast('Admin logged out.', 'info');
        navigate('/admin/login', { replace: true });
    };

    const handleInterviewStart = (data) => {
        if (!data) {
            addToast('Unable to start interview. Please try again.', 'error');
            return;
        }

        const firstQuestionPayload = data.first_question_meta?.question
            ? { ...data.first_question_meta }
            : data.first_question;
        const fullInterviewData = {
            sessionId: data.session_id,
            firstQuestion: firstQuestionPayload,
            keySkills: Array.isArray(data.key_skills) ? data.key_skills : [],
            jobRole: data.job_role || '',
            industryType: data.industry_type || '',
            companyName: data.company_name || '',
            interviewType: data.interview_type || '',
            workExperience: data.work_experience || '',
            questionNumber: data.question_number || 1,
            maxQuestions: data.current_max_questions || null,
            message: data.message,
            sessionStatus: data.status,
            studentEmail: student?.email || '',
        };

        setInterviewData(fullInterviewData);
        setShowInstructions(true); // Open the modal
    };
    const handleAcknowledgeAndStart = () => {
        setShowInstructions(false);
        navigate('/interview');
    };

    const handleInterviewEnd = (sessionId) => {
        setInterviewData(null);
        navigate('/dashboard', { replace: true }); // Replace interview route in history
        addToast("Interview completed! Returning to your dashboard.", 'success');
        setDashboardRefresh((prev) => prev + 1);
    };

    const addToast = (message, type = 'info') => {
        toast(
            <span className="ai-toast-body">
                <FiZap className="ai-toast-icon" />
                <span className="ai-toast-message">{message}</span>
            </span>,
            {
                type,
                autoClose: 1000,
                className: 'ai-toast',
                bodyClassName: 'ai-toast-content',
                hideProgressBar: false,
                closeButton: false,
            }
        );
    };

    if (!isHydrated) {
        return null;
    }

    return (
        <div className="App">
            <Routes>
                <Route
                    path="/"
                    element={<Navigate to={student ? '/dashboard' : '/login'} replace />}
                />
                <Route
                    path="/admin/login"
                    element={<AdminLogin onLogin={handleAdminLogin} loading={adminLoading} session={adminSession} />}
                />
                <Route
                    path="/login"
                    element={<StudentLogin onLogin={handleLogin} />}
                />
                <Route
                    path="/register"
                    element={<MentorRegister />}
                />
                <Route
                    path="/admin"
                    element={
                        adminSession ? (
                            <AdminPage admin={adminSession} onLogout={handleAdminLogout} />
                        ) : adminLoading ? null : (
                            <Navigate to="/admin/login" replace />
                        )
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        student ? (
                            <Dashboard
                                student={student}
                                onLogout={handleLogout}
                                onInterviewStart={handleInterviewStart}
                                addToast={addToast}
                                refreshToken={dashboardRefresh}
                            />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />
                <Route
                    path="/interview"
                    element={
                        student && interviewData ? (
                            <InterviewScreen
                                interviewData={interviewData}
                                onInterviewEnd={handleInterviewEnd}
                                addToast={addToast}
                            />
                        ) : (
                            <Navigate to={student ? '/dashboard' : '/login'} replace />
                        )
                    }
                />
                <Route
                    path="*"
                    element={<Navigate to={student ? '/dashboard' : '/login'} replace />}
                />
            </Routes>
            {showInstructions && 
                <InstructionScreen 
                    onStart={handleAcknowledgeAndStart} 
                    onClose={() => setShowInstructions(false)} 
                />
            }
            <ToastContainer
                position="top-right"
                newestOnTop
                toastClassName={() => 'ai-toast'}
                bodyClassName={() => 'ai-toast-content'}
                progressClassName="ai-toast-progress"
                closeButton={false}
                limit={4}
            />
        </div>
    );
}

export default App;


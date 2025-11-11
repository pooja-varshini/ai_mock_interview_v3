import React, { useState, useEffect } from 'react';
import {
  interviewApi,
  adminApi,
  fetchProgramJobRoles,
  fetchPublicInterviewTypes,
  fetchPublicWorkExperienceLevels,
  fetchStudentProfile,
} from './api';
import './Dashboard.css';
import FeedbackScreen from './FeedbackScreen';
import TrendingCompanies from './TrendingCompanies';
import { trendingCompanies } from './companyData';

const FeedbackModal = ({ sessionId, onClose }) => {
  if (!sessionId) return null;

  return (
    <div className="feedback-modal-backdrop" role="dialog" aria-modal="true">
      <div className="feedback-modal">
        <header className="feedback-modal__header">
          <h3>Session Feedback Report</h3>
          <button type="button" className="feedback-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="feedback-modal__body">
          <FeedbackScreen sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
};

const ordinal = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return `${value}`;
  const remainder = v % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${v}th`;
  }
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
};

const ReattemptPrompt = ({
  isOpen,
  sessions,
  message,
  jobRole,
  companyName,
  industryType,
  attemptMap,
  onCancel,
  onConfirm,
  isProcessing
}) => {
  if (!isOpen) return null;

  return (
    <div className="reattempt-modal-backdrop" role="dialog" aria-modal="true">
      <div className="reattempt-modal">
        <header className="reattempt-modal__header">
          <div>
            <h3>Reattempt Interview?</h3>
            <p>{message || 'We found previous attempts for this combination.'}</p>
            <div className="reattempt-context">
              {jobRole ? (
                <span className="context-pill" title={jobRole}>
                  <strong>Role:</strong> {jobRole}
                </span>
              ) : null}
              {industryType ? (
                <span className="context-pill" title={industryType}>
                  <strong>Industry:</strong> {industryType}
                </span>
              ) : null}
              {companyName ? (
                <span className="context-pill" title={companyName}>
                  <strong>Company:</strong> {companyName}
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" className="reattempt-modal__close" onClick={onCancel} disabled={isProcessing}>
            ✕
          </button>
        </header>
        <div className="reattempt-modal__body">
          {sessions.length > 0 ? (
            <div className="reattempt-session-list">
              {sessions.map((session, index) => (
                <div key={session.session_id} className="reattempt-session-card">
                  <div className="reattempt-session-meta">
                    {(() => {
                      const attemptNumber = attemptMap?.[session.session_id] || index + 1;
                      const repeat = attemptNumber > 1;
                      return (
                        <span
                          className={`attempt-chip ${repeat ? 'repeat' : 'first'} small`}
                          title={repeat ? `Previously attempted ${attemptNumber - 1} time(s)` : 'First time attempting this combination'}
                        >
                          {ordinal(attemptNumber)} attempt
                        </span>
                      );
                    })()}
                    <span className={`session-status ${session.status ? session.status.toLowerCase() : ''}`}>
                      {session.status ? session.status.toUpperCase() : 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="reattempt-session-timestamps">
                    <div>
                      <label>Started</label>
                      <span>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div>
                      <label>Completed</label>
                      <span>{session.completed_at ? new Date(session.completed_at).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="reattempt-session-scores">
                    <div>
                      <label>Overall</label>
                      <span>{session.overall_score != null ? Number(session.overall_score).toFixed(2) : 'N/A'}</span>
                    </div>
                    <div>
                      <label>Technical</label>
                      <span>{session.technical_score != null ? Number(session.technical_score).toFixed(2) : 'N/A'}</span>
                    </div>
                    <div>
                      <label>Communication</label>
                      <span>{session.communication_score != null ? Number(session.communication_score).toFixed(2) : 'N/A'}</span>
                    </div>
                    <div>
                      <label>Attitude</label>
                      <span>{session.attitude_score != null ? Number(session.attitude_score).toFixed(2) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="reattempt-empty">No details available for existing sessions.</p>
          )}
        </div>
        <footer className="reattempt-modal__footer">
          <button type="button" className="reattempt-cancel" onClick={onCancel} disabled={isProcessing}>
            Not Now
          </button>
          <button type="button" className="reattempt-confirm" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Starting…' : 'Confirm Reattempt'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default function Dashboard({ student, onLogout, onInterviewStart, addToast, refreshToken = 0 }) {
  const [jobRole, setJobRole] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [interviewType, setInterviewType] = useState('');
  const [workExperience, setWorkExperience] = useState('');
  
  const [sessions, setSessions] = useState([]);
  const [attemptIndexBySession, setAttemptIndexBySession] = useState({});
  const [allRoles, setAllRoles] = useState([]);
  const [allIndustries, setAllIndustries] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [allInterviewTypes, setAllInterviewTypes] = useState([]);
  const [workExperienceOptions, setWorkExperienceOptions] = useState([]);
  const [programInfo, setProgramInfo] = useState(student?.program || null);

  const [activeTab, setActiveTab] = useState('interview'); // 'interview' or 'leaderboard'
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [reattemptPrompt, setReattemptPrompt] = useState({ open: false, sessions: [], message: '' });
  const [highlightSessionId, setHighlightSessionId] = useState(null);

  useEffect(() => {
    const loadProgramInfo = async () => {
      if (!student) {
        setProgramInfo(null);
        setAllRoles([]);
        return;
      }

      try {
        let resolvedProgramId = student.program?.program_id || student.program_id || null;
        let resolvedProgramName = student.program?.program_name || student.program_name || null;
        let resolvedRoles = Array.isArray(student.program?.job_roles)
          ? student.program.job_roles.filter(Boolean)
          : [];
        let resolvedProgramInfo = student.program || null;

        if ((!resolvedProgramId || !resolvedRoles.length) && student.email) {
          try {
            const { data: profile } = await fetchStudentProfile(student.email);
            if (profile) {
              resolvedProgramId = profile.program_id || resolvedProgramId;
              resolvedProgramName = profile.program_name || resolvedProgramName;
              if (Array.isArray(profile.job_roles) && profile.job_roles.length) {
                resolvedRoles = profile.job_roles.filter(Boolean);
              }
              if (!resolvedProgramInfo && (profile.program_id || profile.program_name)) {
                resolvedProgramInfo = {
                  program_id: profile.program_id || null,
                  program_name: profile.program_name || null,
                  job_roles: Array.isArray(profile.job_roles) ? profile.job_roles.filter(Boolean) : [],
                };
              }
            }
          } catch (profileError) {
            console.warn('Unable to fetch student profile for program metadata:', profileError);
          }
        }

        if (resolvedProgramId && (!resolvedRoles.length || !resolvedProgramName)) {
          try {
            const { data } = await fetchProgramJobRoles(resolvedProgramId);
            if (data) {
              resolvedProgramName = data.program_name || resolvedProgramName;
              if (Array.isArray(data.job_roles) && data.job_roles.length) {
                resolvedRoles = data.job_roles.filter(Boolean);
              }
              resolvedProgramInfo = data;
            }
          } catch (programError) {
            console.warn('Unable to fetch roles for program id', resolvedProgramId, programError);
          }
        }

        const uniqueRoles = [...new Set((resolvedRoles || []).filter(Boolean))];
        if (resolvedProgramInfo) {
          resolvedProgramInfo = {
            ...resolvedProgramInfo,
            program_id: resolvedProgramInfo.program_id || resolvedProgramId || null,
            program_name: resolvedProgramInfo.program_name || resolvedProgramName || null,
            job_roles: uniqueRoles,
          };
        } else if (resolvedProgramId || resolvedProgramName || uniqueRoles.length) {
          resolvedProgramInfo = {
            program_id: resolvedProgramId || null,
            program_name: resolvedProgramName || null,
            job_roles: uniqueRoles,
          };
        }

        setProgramInfo(resolvedProgramInfo);
        setAllRoles(uniqueRoles);
      } catch (error) {
        console.error('Failed to resolve program job roles:', error);
        const fallbackRoles = Array.isArray(student?.program?.job_roles) ? student.program.job_roles : [];
        setProgramInfo(student?.program || null);
        setAllRoles([...new Set(fallbackRoles.filter(Boolean))]);
      }
    };

    loadProgramInfo();
  }, [student]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests = [
          adminApi.get('/admin/industry-types'),
          adminApi.get('/admin/company-names'),
        ];

        const hasProgramContext = Boolean(student?.program_id);

        if (hasProgramContext) {
          requests.push(fetchPublicInterviewTypes({ programId: student.program_id }));
          requests.push(fetchPublicWorkExperienceLevels({ programId: student.program_id }));
        } else {
          requests.push(fetchPublicInterviewTypes());
          requests.push(fetchPublicWorkExperienceLevels());
        }

        const [industriesRes, companiesRes, interviewTypesRes, workExperienceRes] = await Promise.all(requests);

        setAllIndustries([...new Set(industriesRes.data)]);
        setAllCompanies([...new Set(companiesRes.data)]);

        const nextInterviewTypes = interviewTypesRes?.data;
        const nextWorkExp = workExperienceRes?.data;

        setAllInterviewTypes(Array.isArray(nextInterviewTypes) ? [...new Set(nextInterviewTypes)] : []);
        setWorkExperienceOptions(Array.isArray(nextWorkExp) ? [...new Set(nextWorkExp)] : []);

        // Fetch data for the records and leaderboard
        if (student && student.email) {
          const sessionsRes = await adminApi.get(`/students/sessions/by_email/${student.email}`);
          const allSessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
          const completedSessions = allSessions.filter((session) =>
            session && typeof session.status === 'string' && session.status.toLowerCase() === 'completed'
          );
          const grouped = new Map();
          completedSessions
            .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
            .forEach((session) => {
              const key = [
                session.student_id || (student && student.email) || '',
                session.job_role || '',
                session.company_name || '',
                session.industry_type || ''
              ].join('::');
              if (!grouped.has(key)) {
                grouped.set(key, []);
              }
              grouped.get(key).push(session);
            });

          const attemptLookup = {};
          grouped.forEach((list) => {
            list.forEach((session, index) => {
              attemptLookup[session.session_id] = index + 1;
            });
          });

          setAttemptIndexBySession(attemptLookup);
          setSessions(
            completedSessions.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0))
          );
        } else {
          setSessions([]);
          setAttemptIndexBySession({});
        }
        const leaderboardRes = await adminApi.get('/admin/analytics/leaderboard');
        setLeaderboard(leaderboardRes.data || []);

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };
    fetchData();
  }, [student, refreshToken]);

  useEffect(() => {
    if (!jobRole && allRoles.length > 0) {
      setJobRole(allRoles[0]);
    }
  }, [allRoles, jobRole]);

  const formatStatus = (status) => {
    if (!status) return 'N/A';
    const lower = status.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    const lower = status.toLowerCase();
    if (lower === 'completed') return 'status-completed';
    if (lower === 'active') return 'status-active';
    return '';
  };

  const getScoreClass = (score) => {
    if (score === null || score === undefined || Number.isNaN(Number(score))) {
      return '';
    }
    const numericScore = Number(score);
    if (numericScore > 3.5) return 'score-good';
    if (numericScore <= 2) return 'score-low';
    return 'score-average';
  };

  const handleTrendingRoleSelect = (company, role) => {
    setCompanyName(company);
    setJobRole(role);
  };

  const quickStartFromTrending = ({ company, role, industry, interviewType: selectedType, workExperience: selectedExperience, reset }) => {
    if (!company || !role || !selectedType || !selectedExperience) {
      addToast('Please pick a role, interview type, and work experience before launching.', 'error');
      return;
    }
    setCompanyName(company);
    setJobRole(role);
    if (industry) {
      setIndustryType(industry);
    }
    setInterviewType(selectedType);
    setWorkExperience(selectedExperience);
    startInterview(false, {
      jobRole: role,
      companyName: company,
      industryType: industry || industryType,
      interviewType: selectedType,
      workExperience: selectedExperience,
    }).finally(() => {
      if (typeof reset === 'function') {
        reset();
      }
    });
  };

  const handleViewReport = (selectedSessionId) => {
    setSelectedSession(selectedSessionId);
  };

  const closeReport = () => {
    setSelectedSession(null);
  };

  const startInterview = async (force = false, overrides = {}) => {
    const effectiveJobRole = overrides.jobRole ?? jobRole;
    const effectiveCompanyName = overrides.companyName ?? companyName;
    const effectiveIndustryType = overrides.industryType ?? industryType;
    const effectiveInterviewType = overrides.interviewType ?? interviewType;
    const effectiveWorkExperience = overrides.workExperience ?? workExperience;

    if (!effectiveJobRole || !effectiveCompanyName || !effectiveInterviewType || !effectiveWorkExperience) {
      addToast('Please select a Job Role, Company, Interview Type, and Work Experience to start.', 'error');
      return;
    }
    setIsStarting(true);
    try {
      const params = new URLSearchParams();
      params.append('student_name', student ? student.name : 'Anonymous User');
      params.append('student_email', student ? student.email : 'anonymous@example.com');
      params.append('job_role', effectiveJobRole);
      params.append('industry_type', effectiveIndustryType);
      params.append('company_name', effectiveCompanyName);
      params.append('interview_type', effectiveInterviewType);
      params.append('work_experience', effectiveWorkExperience);
      if (force) {
        params.append('force_reattempt', 'true');
      }

      const response = await interviewApi.post('/interview/start', params);
      const data = response.data || {};

      if (!force && data.requires_confirmation) {
        const existingSessions = Array.isArray(data.existing_sessions)
          ? data.existing_sessions.filter(
              (session) =>
                session && typeof session.status === 'string' && session.status.toLowerCase() === 'completed'
            )
          : [];
        const reattemptAttemptLookup = { ...attemptIndexBySession };
        existingSessions
          .slice()
          .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
          .forEach((session, index) => {
            if (!reattemptAttemptLookup[session.session_id]) {
              reattemptAttemptLookup[session.session_id] = index + 1;
            }
          });
        const latestSession = existingSessions[0];
        setHighlightSessionId(latestSession ? latestSession.session_id : null);
        setReattemptPrompt({
          open: true,
          sessions: existingSessions,
          message: data.message || 'Existing attempts found for this combination.',
          jobRole: effectiveJobRole,
          companyName: effectiveCompanyName,
          industryType: effectiveIndustryType,
          attemptLookup: reattemptAttemptLookup
        });
        addToast('Existing attempt detected. Confirm reattempt to continue.', 'info');
        return;
      }

      const payload = {
        ...data,
        job_role: data.job_role ? data.job_role : effectiveJobRole,
        industry_type: data.industry_type ? data.industry_type : effectiveIndustryType,
        company_name: data.company_name ? data.company_name : effectiveCompanyName,
        interview_type: data.interview_type ? data.interview_type : effectiveInterviewType,
        work_experience: data.work_experience ? data.work_experience : effectiveWorkExperience,
      };

      setReattemptPrompt({ open: false, sessions: [], message: '', jobRole: '', companyName: '', industryType: '', attemptLookup: {} });
      setHighlightSessionId(null);

      // Use the onInterviewStart prop passed from App.js
      onInterviewStart(payload);
    } catch (error) {
      console.error('Error starting interview:', error);
      addToast('Failed to start interview. Is the backend server running?', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const confirmReattempt = async () => {
    try {
      await startInterview(true);
    } finally {
      setReattemptPrompt({ open: false, sessions: [], message: '', jobRole: '', companyName: '', industryType: '', attemptLookup: {} });
      setHighlightSessionId(null);
    }
  };

  const cancelReattempt = () => {
    setReattemptPrompt({ open: false, sessions: [], message: '', jobRole: '', companyName: '', industryType: '', attemptLookup: {} });
    setHighlightSessionId(null);
  };




  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <button onClick={onLogout} className="logout-button-top">Logout</button>
        <div className="header-left">
            <h1>AI Mock Interview</h1>
            <p>Welcome, {student ? student.name : 'Guest'}</p>
        </div>
        <nav className="dashboard-nav">
          <button onClick={() => setActiveTab('interview')} className={`nav-button ${activeTab === 'interview' ? 'active' : ''}`}>Interview</button>
          {/* <button onClick={() => setActiveTab('leaderboard')} className={`nav-button ${activeTab === 'leaderboard' ? 'active' : ''}`}>Leaderboard</button> */}
        </nav>
      </header>

      <main className="dashboard-main">
        {activeTab === 'interview' ? (
          <>
            <TrendingCompanies 
              companies={trendingCompanies}
              allRoles={allRoles}
              interviewTypes={allInterviewTypes}
              workExperienceOptions={workExperienceOptions}
              programName={programInfo?.program_name || ''}
              onSelectRole={handleTrendingRoleSelect}
              onQuickStart={quickStartFromTrending}
            />
            <section className="start-interview-section card">
              <h2>Start Interview Session</h2>
              <p className="session-program-name">
                Program: <strong>{programInfo?.program_name || 'Not assigned'}</strong>
              </p>
              <div className="session-inputs">
                <select value={jobRole} onChange={(e) => setJobRole(e.target.value)}>
                  <option value="">Select Job Role</option>
                  {allRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <select value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
                  <option value="">Select Industry</option>
                  {allIndustries.map(industry => <option key={industry} value={industry}>{industry}</option>)}
                </select>
                <select value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                  <option value="">Select Company</option>
                  {allCompanies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                  <option value="">Select Interview Type</option>
                  {allInterviewTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select value={workExperience} onChange={(e) => setWorkExperience(e.target.value)}>
                  <option value="">Select Work Experience</option>
                  {workExperienceOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <button onClick={() => startInterview()} className="start-button" disabled={isStarting}>
                  {isStarting ? 'Starting…' : 'Start Interview'}
                </button>
              </div>
            </section>
            <section className="records-section card">
              <h2>Mock Interview Records</h2>
              <p>Review and track all your mock interview attempts.</p>
              <div className="table-container" role="region" aria-label="Mock interview records">
                <div className="table-header">
                  <div>Interview Role</div>
                  <div>Company</div>
                  <div>Interview Type</div>
                  <div>Date & Time</div>
                  <div>Score</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                <div className="table-body" role="list">
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <div
                        className={`table-row${highlightSessionId === session.session_id ? ' highlighted' : ''}${(attemptIndexBySession[session.session_id] || 1) > 1 ? ' reattempt' : ''}`}
                        key={session.session_id}
                        role="listitem"
                      >
                        <div className="role-cell">
                          <span className="role-title">{session.job_role}</span>
                          {(() => {
                            const attemptNumber = attemptIndexBySession[session.session_id] || 1;
                            const repeat = attemptNumber > 1;
                            return (
                              <span
                                className={`attempt-chip ${repeat ? 'repeat' : 'first'}`}
                                title={repeat ? `Previously attempted ${attemptNumber - 1} time(s)` : 'First time attempting this combination'}
                              >
                                {ordinal(attemptNumber)} attempt
                              </span>
                            );
                          })()}
                        </div>
                        <div>{session.company_name || 'N/A'}</div>
                        <div>{session.interview_type || 'N/A'}</div>
                        <div>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</div>
                        <div className={getScoreClass(session.overall_score)}>
                          {session.overall_score != null ? `${Number(session.overall_score).toFixed(2)}` : 'N/A'}
                        </div>
                        <div className={getStatusClass(session.status)}>
                          {formatStatus(session.status)}
                        </div>
                        <div className="table-actions">
                          <button
                            onClick={() => handleViewReport(session.session_id)}
                            className="view-report-button"
                            disabled={session.status?.toLowerCase() !== 'completed'}
                          >
                            View Report
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="table-row-empty">No interview records found.</div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="leaderboard-section card">
            <h2>Leaderboard</h2>
            <p>See how you rank against other students.</p>
            <div className="table-container">
                <div className="table-header">
                    <div>Rank</div>
                    <div>Name</div>
                    <div>Average Score</div>
                    <div>Interviews Taken</div>
                </div>
                {leaderboard.map((entry) => (
                    <div className={`table-row ${entry.student_name === (student && student.name) ? 'current-user-row' : ''}`} key={entry.rank}>
                        <div>{entry.rank}</div>
                        <div>{entry.student_name}</div>
                        <div className={getScoreClass(entry.avg_score)}>{entry.avg_score != null ? entry.avg_score.toFixed(2) : 'N/A'}</div>
                        <div>{entry.total_sessions}</div>
                    </div>
                ))}
            </div>
          </section>
        )}
      </main>
      {selectedSession ? (
        <FeedbackModal sessionId={selectedSession} onClose={closeReport} />
      ) : null}
      <ReattemptPrompt
        isOpen={reattemptPrompt.open}
        sessions={reattemptPrompt.sessions}
        message={reattemptPrompt.message}
        jobRole={reattemptPrompt.jobRole}
        companyName={reattemptPrompt.companyName}
        industryType={reattemptPrompt.industryType}
        attemptMap={reattemptPrompt.attemptLookup || attemptIndexBySession}
        onCancel={cancelReattempt}
        onConfirm={confirmReattempt}
        isProcessing={isStarting}
      />
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminDashboardStats,
  fetchAdminStudents,
  fetchAdminSessions,
  fetchAdminPerformanceAnalytics,
  fetchAdminInsights,
  fetchAdminLeaderboard,
} from './api';
import FeedbackScreen from './FeedbackScreen';
import './AdminPage.css';
import {
  EngagementAreaChart,
  ProgramComposedChart,
  ProgramPieChart,
  ExperienceHorizontalBar,
  IndustryScatter,
  IndustryVolumeBar,
  CompanyTreemap,
  TrendingRolesBar,
  CompletionRateBar,
  ChartPlaceholder,
} from './AdminAnalyticsCharts';

const formatNumber = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-IN') : '--';

const formatScore = (value) =>
  typeof value === 'number' ? value.toFixed(2) : '—';

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

const getScoreClass = (score) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return 'admin-score';
  }

  const numeric = Number(score);
  if (numeric > 3.5) return 'admin-score admin-score--good';
  if (numeric <= 2) return 'admin-score admin-score--low';
  return 'admin-score admin-score--average';
};

const AdminPage = ({ admin, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [insightsState, setInsightsState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSession, setActiveSession] = useState(null);
  const [studentFilters, setStudentFilters] = useState({
    name: '',
    status: '',
    university_name: '',
    program_name: '',
    batch_label: '',
  });
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [sessionFilters, setSessionFilters] = useState({
    role: '',
    student: '',
    company: '',
    minScore: '',
    maxScore: '',
  });
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const handleChange = (event) => setIsSidebarOpen(!event.matches);

    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async () => {
      setLoading(true);
      setError('');

      try {
        const [statsRes, analyticsRes, leaderboardRes] = await Promise.all([
          fetchAdminDashboardStats(),
          fetchAdminPerformanceAnalytics({ days: 14 }),
          fetchAdminLeaderboard(),
        ]);

        if (cancelled) return;

        setStats(statsRes.data);
        setAnalytics(analyticsRes.data ?? null);
        setLeaderboard(leaderboardRes.data ?? []);

        try {
          const insightsRes = await fetchAdminInsights();
          if (!cancelled) {
            setInsightsState(insightsRes.data ?? null);
          }
        } catch (insightsError) {
          console.warn('Admin insights endpoint unavailable:', insightsError);
          if (!cancelled) {
            setInsightsState(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load admin dashboard', err);
          setError(err?.response?.data?.detail || 'Unable to load admin dashboard data. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAdminData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setStudentsLoading(true);
      try {
        const response = await fetchAdminStudents({
          page: 1,
          limit: 8,
          name: studentFilters.name || undefined,
          status: studentFilters.status || undefined,
          university_name: studentFilters.university_name || undefined,
          program_name: studentFilters.program_name || undefined,
          batch_label: studentFilters.batch_label || undefined,
        });

        if (cancelled) return;
        setStudents(response.data?.students ?? []);
        setError('');
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load students', err);
          setError(err?.response?.data?.detail || 'Unable to load student data. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      }
    }, studentFilters.name ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [studentFilters]);

  const handleStudentFilterChange = (event) => {
    const { name, value } = event.target;
    setStudentFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearStudentFilters = () => {
    setStudentFilters({
      name: '',
      status: '',
      university_name: '',
      program_name: '',
      batch_label: '',
    });
  };

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSessionsLoading(true);
      try {
        const response = await fetchAdminSessions({
          page: 1,
          limit: 10,
          student_name: sessionFilters.student || undefined,
          job_role: sessionFilters.role || undefined,
          company_name: sessionFilters.company || undefined,
          min_score:
            sessionFilters.minScore !== '' && !Number.isNaN(Number(sessionFilters.minScore))
              ? Number(sessionFilters.minScore)
              : undefined,
          max_score:
            sessionFilters.maxScore !== '' && !Number.isNaN(Number(sessionFilters.maxScore))
              ? Number(sessionFilters.maxScore)
              : undefined,
        });

        if (cancelled) return;
        setSessions(response.data?.sessions ?? []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load sessions', err);
          setError(err?.response?.data?.detail || 'Unable to load session data. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    }, sessionFilters.student ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [sessionFilters]);

  const handleSessionFilterChange = (event) => {
    const { name, value } = event.target;
    setSessionFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearSessionFilters = () => {
    setSessionFilters({ role: '', student: '', company: '', minScore: '', maxScore: '' });
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const dailyTrends = useMemo(() => analytics?.daily_trends ?? [], [analytics]);
  const engagementSummary = useMemo(() => insightsState?.engagement_summary ?? null, [insightsState]);
  const programPerformance = useMemo(() => insightsState?.program_performance ?? [], [insightsState]);
  const experienceBreakdown = useMemo(() => insightsState?.experience_breakdown ?? [], [insightsState]);
  const industryHotspots = useMemo(() => insightsState?.industry_company_hotspots ?? [], [insightsState]);
  const trendingRoles = useMemo(() => insightsState?.trending_roles ?? [], [insightsState]);
  const reattemptHotspots = useMemo(() => insightsState?.reattempt_hotspots ?? [], [insightsState]);

  const programChartData = useMemo(() => {
    if (!Array.isArray(programPerformance)) return [];
    return programPerformance.map((program) => ({
      ...program,
      avg_overall:
        program.completed_sessions && Number.isFinite(program.avg_overall) && program.avg_overall > 0
          ? program.avg_overall
          : null,
    }));
  }, [programPerformance]);

  const completionRates = useMemo(() => {
    if (!Array.isArray(programPerformance)) return [];
    return programPerformance.map((program) => {
      const totalSessions = (program.completed_sessions || 0) + (program.remaining_sessions || 0);
      const completionRate = totalSessions > 0 ? ((program.completed_sessions || 0) / totalSessions) * 100 : 0;
      return {
        program_name: program.program_name,
        completion_rate: Number.isFinite(completionRate) ? Math.round(completionRate) : 0,
      };
    });
  }, [programPerformance]);

  const industryVolume = useMemo(() => {
    if (!Array.isArray(industryHotspots)) return [];
    const grouped = new Map();
    industryHotspots.forEach((item) => {
      const key = item.industry || 'Unknown';
      grouped.set(key, (grouped.get(key) || 0) + (item.total_sessions || 0));
    });
    return Array.from(grouped.entries()).map(([industry, total]) => ({ industry, total_sessions: total }));
  }, [industryHotspots]);

  const companyTreemapData = useMemo(() => {
    if (!Array.isArray(industryHotspots)) return [];
    return industryHotspots.map((item) => ({ name: item.company, size: item.total_sessions || 0 }));
  }, [industryHotspots]);

  const engagementCards = useMemo(() => {
    if (!engagementSummary) return [];
    return [
      {
        key: 'total-students',
        label: 'Total Students',
        value: formatNumber(engagementSummary.total_students),
        hint: 'Registered overall',
      },
      {
        key: 'active-students',
        label: 'Active (30 days)',
        value: formatNumber(engagementSummary.active_students_30_days),
        hint: `${formatNumber(Math.max((engagementSummary.active_students_30_days || 0) - (engagementSummary.repeat_combos || 0), 0))} unique currently engaged`,
      },
      {
        key: 'inactive-students',
        label: 'Inactive (30 days)',
        value: formatNumber(engagementSummary.inactive_students_30_days),
        hint: 'Need outreach',
      },
      {
        key: 'avg-session',
        label: 'Avg Sessions / Active',
        value: formatScore(engagementSummary.avg_sessions_per_active),
        hint: 'Last 30 days',
      },
      {
        key: 'completed-total',
        label: 'Completed Sessions',
        value: formatNumber(engagementSummary.total_completed_sessions),
        hint: 'All time',
      },
      {
        key: 'repeat-rate',
        label: 'Reattempt Combos',
        value: formatNumber(engagementSummary.repeat_combos),
        hint: `${formatNumber(engagementSummary.repeat_attempts)} total reattempts`,
      },
    ];
  }, [engagementSummary]);

  const handleViewReport = (sessionId) => {
    if (!sessionId) return;
    setActiveSession(sessionId);
  };

  const closeReportModal = () => setActiveSession(null);

  return (
    <div className="admin-page">
      <button
        type="button"
        className={`admin-hamburger admin-hamburger--floating ${isSidebarOpen ? 'is-open' : ''}`}
        onClick={toggleSidebar}
        aria-label={`${isSidebarOpen ? 'Hide' : 'Show'} navigation`}
        aria-expanded={isSidebarOpen}
        aria-controls="admin-sidebar"
      >
        <span />
        <span />
        <span />
      </button>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <div className={`admin-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <aside
          id="admin-sidebar"
          className={`admin-sidebar ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
          aria-label="Admin navigation"
        >
          <header className="admin-sidebar__head">
            <h1>Admin Panel</h1>
          </header>
          <p className="admin-sidebar__sub">Monitor student progress and session activity.</p>
          <nav className="admin-tabs" aria-label="Admin Sections">
            <button
              type="button"
              className={`admin-tab ${activeTab === 'overview' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'students' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Students
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'sessions' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              Sessions
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'analytics' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
          </nav>
          {admin && (
            <footer className="admin-sidebar__footer" aria-label="Admin actions">
              <div className="admin-sidebar__account">
                <span className="admin-account-name">{admin.display_name || admin.email}</span>
                {onLogout && (
                  <button type="button" className="admin-button-text admin-button-text--logout" onClick={onLogout}>
                    Logout
                  </button>
                )}
              </div>
            </footer>
          )}
        </aside>

        <section
          className={`admin-content ${activeTab === 'analytics' ? 'admin-content--analytics' : ''}`}
          aria-live="polite"
        >
          {activeTab === 'overview' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <h2>Overview</h2>
                {loading && !stats ? (
                  <div className="admin-panel admin-panel--loading">Loading dashboard stats…</div>
                ) : (
                  <div className="admin-grid admin-grid--stats">
                    <article className="admin-card">
                      <h3>Total Students</h3>
                      <p className="admin-metric">{formatNumber(stats?.total_students)}</p>
                      <span className="admin-card__hint">Registered in the platform</span>
                    </article>
                    <article className="admin-card">
                      <h3>Total Sessions</h3>
                      <p className="admin-metric">{formatNumber(stats?.total_sessions)}</p>
                      <span className="admin-card__hint">Across all time</span>
                    </article>
                    <article className="admin-card">
                      <h3>Active Sessions</h3>
                      <p className="admin-metric admin-metric--accent">{formatNumber(stats?.active_sessions)}</p>
                      <span className="admin-card__hint">Currently in progress</span>
                    </article>
                    <article className="admin-card">
                      <h3>Average Score</h3>
                      <p className="admin-metric">{formatScore(stats?.avg_score)}</p>
                      <span className="admin-card__hint">Out of 5.0 scale</span>
                    </article>
                    <article className="admin-card">
                      <h3>Completed Sessions</h3>
                      <p className="admin-metric">{formatNumber(stats?.completed_sessions)}</p>
                      <span className="admin-card__hint">Finished interviews</span>
                    </article>
                    <article className="admin-card">
                      <h3>Sessions Today</h3>
                      <p className="admin-metric">{formatNumber(stats?.today_sessions)}</p>
                      <span className="admin-card__hint">Daily activity</span>
                    </article>
                  </div>
                )}
              </section>
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Leaderboard</h2>
                  <span className="admin-section__hint">Top performers by average score</span>
                </div>
                <div className="admin-panel">
                  {loading && leaderboard.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading leaderboard…</div>
                  ) : leaderboard.length === 0 ? (
                    <div className="admin-panel__placeholder">Leaderboard will appear once students complete sessions.</div>
                  ) : (
                    <ol className="admin-leaderboard">
                      {leaderboard.slice(0, 10).map((entry) => (
                        <li key={entry.rank}>
                          <div>
                            <span className="admin-rank">#{entry.rank}</span>
                            <span className="admin-leaderboard__name">{entry.student_name}</span>
                          </div>
                          <div className="admin-leaderboard__meta">
                            <span className="admin-score">{formatScore(entry.avg_score)}</span>
                            <span className="admin-text--muted">{formatNumber(entry.total_sessions)} sessions</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Recent Student Progress</h2>
                  <span className="admin-section__hint">Latest 8 student records with session status</span>
                </div>
                <div className="admin-filters" role="group" aria-label="Student filters">
                  <div className="admin-filter">
                    <label htmlFor="student-name-filter">Search</label>
                    <input
                      id="student-name-filter"
                      name="name"
                      type="search"
                      placeholder="Search by student name"
                      value={studentFilters.name}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-status-filter">Status</label>
                    <select
                      id="student-status-filter"
                      name="status"
                      value={studentFilters.status}
                      onChange={handleStudentFilterChange}
                    >
                      <option value="">All</option>
                      <option value="Completed">Completed</option>
                      <option value="No Sessions">No Sessions</option>
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-university-filter">University</label>
                    <input
                      id="student-university-filter"
                      name="university_name"
                      type="search"
                      placeholder="Filter by university"
                      value={studentFilters.university_name}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-program-filter">Program</label>
                    <input
                      id="student-program-filter"
                      name="program_name"
                      type="search"
                      placeholder="Filter by program"
                      value={studentFilters.program_name}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-batch-filter">Batch</label>
                    <input
                      id="student-batch-filter"
                      name="batch_label"
                      type="search"
                      placeholder="Filter by batch"
                      value={studentFilters.batch_label}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={clearStudentFilters}
                    disabled={
                      !studentFilters.name &&
                      !studentFilters.status &&
                      !studentFilters.university_name &&
                      !studentFilters.program_name &&
                      !studentFilters.batch_label
                    }
                  >
                    Clear
                  </button>
                </div>
                <div className="admin-panel">
                  {studentsLoading && students.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading students…</div>
                  ) : students.length === 0 ? (
                    <div className="admin-panel__placeholder">No student records found.</div>
                  ) : (
                    <div className="admin-table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>University</th>
                            <th>Program</th>
                            <th>Batch</th>
                            <th>Sessions</th>
                            <th>Avg. Score</th>
                            <th>Status</th>
                            <th>Last Session</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.student_id}>
                              <td>{student.student_id}</td>
                              <td>{student.name}</td>
                              <td className="admin-text--muted">{student.email}</td>
                              <td className="admin-text--muted">{student.university_name || '—'}</td>
                              <td className="admin-text--muted">{student.program_name || '—'}</td>
                              <td className="admin-text--muted">{student.batch_label || '—'}</td>
                              <td>{formatNumber(student.total_sessions)}</td>
                              <td>{formatScore(student.avg_score)}</td>
                              <td>
                                <span
                                  className={`admin-chip ${
                                    student.status === 'Active'
                                      ? 'admin-chip--success'
                                      : student.status === 'Completed'
                                      ? 'admin-chip--neutral'
                                      : 'admin-chip--muted'
                                  }`}
                                >
                                  {student.status}
                                </span>
                              </td>
                              <td>{student.last_session ? new Date(student.last_session).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Recent Sessions</h2>
                  <span className="admin-section__hint">Shows ten latest interviews</span>
                </div>
                <div className="admin-filters" role="group" aria-label="Session filters">
                  <div className="admin-filter">
                    <label htmlFor="session-role-filter">Role</label>
                    <input
                      id="session-role-filter"
                      name="role"
                      type="search"
                      placeholder="Filter by role"
                      value={sessionFilters.role}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-student-filter">Student</label>
                    <input
                      id="session-student-filter"
                      name="student"
                      type="search"
                      placeholder="Filter by student name"
                      value={sessionFilters.student}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-company-filter">Company</label>
                    <input
                      id="session-company-filter"
                      name="company"
                      type="search"
                      placeholder="Filter by company"
                      value={sessionFilters.company}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-min-score">Min Score</label>
                    <input
                      id="session-min-score"
                      name="minScore"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="5"
                      step="0.01"
                      placeholder="0.0"
                      value={sessionFilters.minScore}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-max-score">Max Score</label>
                    <input
                      id="session-max-score"
                      name="maxScore"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="5"
                      step="0.01"
                      placeholder="5.0"
                      value={sessionFilters.maxScore}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={clearSessionFilters}
                    disabled={
                      !sessionFilters.role &&
                      !sessionFilters.student &&
                      !sessionFilters.company &&
                      !sessionFilters.minScore &&
                      !sessionFilters.maxScore
                    }
                  >
                    Clear
                  </button>
                </div>
                <div className="admin-panel admin-panel--table">
                  {sessionsLoading && sessions.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading sessions…</div>
                  ) : sessions.length === 0 ? (
                    <div className="admin-panel__placeholder">No sessions available.</div>
                  ) : (
                    <div className="admin-table-wrapper" role="region" aria-label="Recent interview sessions">
                      <table className="admin-table admin-table--records">
                        <thead>
                          <tr>
                            <th>Interview Role</th>
                            <th>Student</th>
                            <th>Company</th>
                            <th>Interview Type</th>
                            <th>Date &amp; Time</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((session) => {
                            const attemptLabel = typeof session.attempt_number === 'number'
                              ? `${ordinal(session.attempt_number)} attempt`
                              : null;
                            const statusClass = session.status?.toLowerCase() === 'completed'
                              ? 'admin-chip--success'
                              : 'admin-chip--neutral';

                            return (
                              <tr key={session.session_id}>
                                <td>
                                  <div className="admin-role-cell">
                                    <span className="admin-role-title">{session.job_role}</span>
                                    {attemptLabel ? (
                                      <span className={`admin-attempt-chip ${session.attempt_number > 1 ? 'repeat' : 'first'}`}>
                                        {attemptLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  <div className="admin-student-cell">
                                    <span className="admin-student-name">{session.student_name}</span>
                                    <span className="admin-student-id">ID: {session.student_id ?? 'N/A'}</span>
                                  </div>
                                </td>
                                <td>{session.company_name || 'N/A'}</td>
                                <td>{session.interview_type || 'N/A'}</td>
                                <td>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</td>
                                <td className={getScoreClass(session.overall_score)}>
                                  {session.overall_score != null ? formatScore(session.overall_score) : 'N/A'}
                                </td>
                                <td>
                                  <span className={`admin-chip ${statusClass}`}>{session.status}</span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="view-report-button"
                                    onClick={() => handleViewReport(session.session_id)}
                                  >
                                    View Report
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Engagement Summary</h2>
                  <span className="admin-section__hint">Snapshot of the last 30 days.</span>
                </div>
                {loading && engagementCards.length === 0 ? (
                  <ChartPlaceholder message="Loading engagement insights…" />
                ) : engagementCards.length === 0 ? (
                  <ChartPlaceholder message="No engagement insights yet." />
                ) : (
                  <div className="admin-grid admin-grid--metrics">
                    {engagementCards.map((metric) => (
                      <article key={metric.key} className="admin-card admin-card--metric">
                        <h3>{metric.label}</h3>
                        <p className="admin-metric">{metric.value}</p>
                        {metric.hint ? <span className="admin-card__hint">{metric.hint}</span> : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Engagement Overview</h2>
                  <span className="admin-section__hint">Monitor student activity and session trends.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  <header className="admin-panel__head">
                    <h3>Engagement Trends</h3>
                    <span className="admin-section__hint">Sessions vs. completed sessions</span>
                  </header>
                  {loading && dailyTrends.length === 0 ? (
                    <ChartPlaceholder message="Loading trend data…" />
                  ) : dailyTrends.length === 0 ? (
                    <ChartPlaceholder message="Trend data unavailable." />
                  ) : (
                    <EngagementAreaChart
                      data={dailyTrends.map((trend) => ({
                        label: new Date(trend.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                        sessions: trend.sessions,
                        completed: trend.completed,
                      }))}
                    />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Program Performance</h2>
                  <span className="admin-section__hint">Compare outcomes across programs.</span>
                </div>
                <div className="admin-grid admin-grid--analytics">
                  <article className="admin-panel admin-panel--chart">
                    <header className="admin-panel__head">
                      <h3>Sessions &amp; Average Scores</h3>
                    </header>
                    {loading && programChartData.length === 0 ? (
                      <ChartPlaceholder message="Loading program metrics…" />
                    ) : programChartData.length === 0 ? (
                      <ChartPlaceholder />
                    ) : (
                      <ProgramComposedChart data={programChartData} />
                    )}
                  </article>

                  <article className="admin-panel admin-panel--chart">
                    <header className="admin-panel__head">
                      <h3>Student Distribution</h3>
                    </header>
                    {loading && programPerformance.length === 0 ? (
                      <ChartPlaceholder message="Loading distribution…" />
                    ) : programPerformance.length === 0 ? (
                      <ChartPlaceholder />
                    ) : (
                      <ProgramPieChart data={programPerformance} />
                    )}
                  </article>
                </div>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Experience Breakdown</h2>
                  <span className="admin-section__hint">Sessions and scores by work experience.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  {loading && experienceBreakdown.length === 0 ? (
                    <ChartPlaceholder message="Loading experience data…" />
                  ) : experienceBreakdown.length === 0 ? (
                    <ChartPlaceholder />
                  ) : (
                    <ExperienceHorizontalBar data={experienceBreakdown} />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Trending Roles</h2>
                  <span className="admin-section__hint">Roles with the highest number of completed sessions.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  {loading && trendingRoles.length === 0 ? (
                    <ChartPlaceholder message="Loading role data…" />
                  ) : trendingRoles.length === 0 ? (
                    <ChartPlaceholder />
                  ) : (
                    <TrendingRolesBar data={trendingRoles} />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Reattempt Hotspots</h2>
                  <span className="admin-section__hint">Role &amp; company pairings with repeat attempts.</span>
                </div>
                {loading && reattemptHotspots.length === 0 ? (
                  <ChartPlaceholder message="Loading reattempt data…" />
                ) : reattemptHotspots.length === 0 ? (
                  <ChartPlaceholder message="No reattempt hotspots detected yet." />
                ) : (
                  <div className="admin-panel admin-panel--table">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th>Job Role</th>
                          <th>Company</th>
                          <th>Repeat Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reattemptHotspots.map((item, index) => (
                          <tr key={`${item.job_role}-${item.company}-${index}`}>
                            <td>{item.job_role}</td>
                            <td>{item.company}</td>
                            <td>{formatNumber(item.repeat_students)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>

      {activeSession ? (
        <div className="feedback-modal-backdrop" role="dialog" aria-modal="true">
          <div className="feedback-modal">
            <header className="feedback-modal__header">
              <h3>Session Feedback Report</h3>
              <button type="button" className="feedback-modal__close" onClick={closeReportModal}>
                ✕
              </button>
            </header>
            <div className="feedback-modal__body">
              <FeedbackScreen sessionId={activeSession} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPage;

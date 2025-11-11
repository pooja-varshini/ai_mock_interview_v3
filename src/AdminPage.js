import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminDashboardStats,
  fetchAdminStudents,
  fetchAdminSessions,
  fetchAdminPerformanceAnalytics,
  fetchAdminLeaderboard,
} from './api';
import FeedbackScreen from './FeedbackScreen';
import './AdminPage.css';

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

const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSession, setActiveSession] = useState(null);
  const [studentFilters, setStudentFilters] = useState({ name: '', status: '' });
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
    setStudentFilters({ name: '', status: '' });
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

  const scoreDistribution = useMemo(() => analytics?.score_distribution ?? [], [analytics]);
  const dailyTrends = useMemo(() => analytics?.daily_trends ?? [], [analytics]);

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
        </aside>

        <section className="admin-content" aria-live="polite">
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
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={clearStudentFilters}
                    disabled={!studentFilters.name && !studentFilters.status}
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
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Email</th>
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
              <section className="admin-section admin-section--split">
                <div className="admin-panel">
                  <div className="admin-section__head">
                    <h2>Score Distribution</h2>
                    <span className="admin-section__hint">Aggregate across the last two weeks</span>
                  </div>
                  {loading && scoreDistribution.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading analytics…</div>
                  ) : scoreDistribution.length === 0 ? (
                    <div className="admin-panel__placeholder">Not enough data yet.</div>
                  ) : (
                    <ul className="admin-distribution">
                      {scoreDistribution.map((bucket) => (
                        <li key={bucket.range}>
                          <span>{bucket.range}</span>
                          <span className="admin-metric admin-metric--small">{formatNumber(bucket.count)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="admin-panel admin-panel--scroll">
                  <div className="admin-section__head">
                    <h2>Daily Trends</h2>
                    <span className="admin-section__hint">Sessions and scores across the last two weeks</span>
                  </div>
                  {loading && dailyTrends.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading trend data…</div>
                  ) : dailyTrends.length === 0 ? (
                    <div className="admin-panel__placeholder">Trend data unavailable.</div>
                  ) : (
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Sessions</th>
                          <th>Completed</th>
                          <th>Avg. Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyTrends.map((trend) => (
                          <tr key={trend.date}>
                            <td>{new Date(trend.date).toLocaleDateString()}</td>
                            <td>{formatNumber(trend.sessions)}</td>
                            <td>{formatNumber(trend.completed)}</td>
                            <td>{formatScore(trend.avg_score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
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

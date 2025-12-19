import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAdminStudentAnalytics } from './api';
import FeedbackScreen from './FeedbackScreen';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

import './AdminPage.css';

const formatScore = (value) =>
  typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(2) : '—';

const formatNumber = (value) =>
  typeof value === 'number' && !Number.isNaN(value) ? value.toLocaleString('en-IN') : '—';

// Match Dashboard.js behaviour: always display timestamps in IST (Asia/Kolkata)
const formatISTDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    const istFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return istFormatter.format(new Date(value));
  } catch (error) {
    console.warn('Failed to format date in IST, falling back to local time.', error);
    return new Date(value).toLocaleString();
  }
};

const AdminStudentAnalyticsPage = ({ admin, onLogout }) => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchAdminStudentAnalytics(studentId);
        if (cancelled) return;
        setAnalytics(response.data ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load student analytics', err);
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              'Unable to load student analytics. Please try again.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (studentId) {
      loadAnalytics();
    }

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const scoreTrend = useMemo(() => {
    if (!analytics || !Array.isArray(analytics.sessions)) return [];
    const sessions = [...analytics.sessions]
      .map((s) => ({
        ...s,
        _displayTime: s.completed_at || s.started_at,
      }))
      .filter((s) => s._displayTime && s.overall_score != null)
      .sort((a, b) => new Date(a._displayTime) - new Date(b._displayTime));

    return sessions.map((session, index) => ({
      index: index + 1,
      label: new Date(session._displayTime).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      }),
      overall: session.overall_score,
      technical: session.technical_score,
      communication: session.communication_score,
      attitude: session.attitude_score,
    }));
  }, [analytics]);

  const roleAttempts = useMemo(() => {
    if (!analytics || !Array.isArray(analytics.sessions)) return [];
    const counts = {};
    analytics.sessions.forEach((session) => {
      const role = session.job_role || 'Unknown';
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([job_role, sessions]) => ({ job_role, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [analytics]);

  const companyAttempts = useMemo(() => {
    if (!analytics || !Array.isArray(analytics.sessions)) return [];
    const counts = {};
    analytics.sessions.forEach((session) => {
      const company = session.company_name || 'Unknown';
      counts[company] = (counts[company] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([company, sessions]) => ({ company, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [analytics]);

  const stats = analytics?.statistics || {};
  const avgScores = stats.average_scores || {};
  const totalSessions =
    stats.total_sessions ?? (Array.isArray(analytics?.sessions) ? analytics.sessions.length : 0);
  const completedSessions =
    stats.completed_sessions ??
    (Array.isArray(analytics?.sessions)
      ? analytics.sessions.filter((s) => s.status === 'completed').length
      : 0);

  const handleBack = () => {
    navigate('/admin');
  };

  const handleViewReport = (sessionId) => {
    if (!sessionId) return;
    setActiveSession(sessionId);
  };

  const closeReportModal = () => {
    setActiveSession(null);
  };

  return (
    <div className="admin-page">
      <div className="admin-layout sidebar-collapsed">
        <section className="admin-content" aria-live="polite">
          <header className="admin-header">
            <div className="admin-header__left">
              <button
                type="button"
                className="admin-button-text admin-button-text--ghost"
                onClick={handleBack}
              >
                ← Back to dashboard
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <h1
                className="admin-title"
                style={{ transform: 'translateX(-70px)' }}
              >
                Student Analytics
              </h1>
            </div>
          </header>

          <section className="admin-section">
            {loading ? (
              <div className="admin-panel__placeholder">Loading student analytics...</div>
            ) : error ? (
              <div className="admin-panel__placeholder admin-panel__placeholder--error">
                {error}
              </div>
            ) : !analytics ? (
              <div className="admin-panel__placeholder">No analytics data available</div>
            ) : (
              <>
                {/* Student Info Header */}
                <div className="admin-section__head">
                  <div>
                    <h2>
                      {analytics.student_info?.name || 'Student'}
                    </h2>
                    <span className="admin-section__hint">
                      {analytics.student_info?.email}
                    </span>
                  </div>
                </div>

                {/* Key Metrics Cards */}
                <div className="admin-grid admin-grid--metrics">
                  <article className="admin-card">
                    <h3>Total sessions</h3>
                    <p className="admin-metric">{formatNumber(totalSessions)}</p>
                    <span className="admin-card__hint">All interview attempts</span>
                  </article>
                  <article className="admin-card">
                    <h3>Completed sessions</h3>
                    <p className="admin-metric">{formatNumber(completedSessions)}</p>
                    <span className="admin-card__hint">Finished with scores</span>
                  </article>
                  <article className="admin-card">
                    <h3>Avg overall score</h3>
                    <p className="admin-metric">{formatScore(avgScores.overall)}</p>
                    <span className="admin-card__hint">Across completed sessions</span>
                  </article>
                  <article className="admin-card">
                    <h3>Completion rate</h3>
                    <p className="admin-metric">
                      {stats.completion_rate != null
                        ? `${(stats.completion_rate || 0).toFixed(1)}%`
                        : '—'}
                    </p>
                    <span className="admin-card__hint">Completed / total attempts</span>
                  </article>
                </div>

                {/* Score trend over time (overall) */}
                {scoreTrend.length > 0 && (
                  <div className="admin-panel admin-panel--chart">
                    <h2 className="admin-panel__title">Score trend over time</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart
                        data={scoreTrend}
                        margin={{ top: 16, right: 24, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 6"
                          stroke="rgba(148, 121, 200, 0.2)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#A7A3C2', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fill: '#A7A3C2', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip formatter={(value) => formatScore(value)} />
                        <Line
                          type="monotone"
                          dataKey="overall"
                          name="Overall"
                          stroke="#8B5CF6"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Secondary Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  {/* Top Roles */}
                  {roleAttempts.length > 0 && (
                    <div className="admin-panel">
                      <h2 className="admin-panel__title">Most attempted roles</h2>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                          data={roleAttempts}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(120, 97, 196, 0.15)"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            stroke="#B8A4E8"
                            tick={{ fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="job_role"
                            stroke="#B8A4E8"
                            tick={{ fontSize: 11 }}
                            width={200}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="sessions"
                            name="Sessions"
                            fill="#7861C4"
                            radius={[0, 8, 8, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Top Companies */}
                  {companyAttempts.length > 0 && (
                    <div className="admin-panel">
                      <h2 className="admin-panel__title">Most attempted companies</h2>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                          data={companyAttempts}
                          margin={{ top: 5, right: 20, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(120, 97, 196, 0.15)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="company"
                            stroke="#B8A4E8"
                            angle={-35}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            stroke="#B8A4E8"
                            allowDecimals={false}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="sessions"
                            name="Sessions"
                            fill="#F59E0B"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Recent Sessions Table */}
                {analytics.sessions && analytics.sessions.length > 0 && (
                  <div className="admin-panel">
                    <h2 className="admin-panel__title">Recent interview sessions</h2>
                    <div className="admin-table-container">
                      <table className="admin-table admin-table--records">
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: '1.25rem' }}>Interview role</th>
                            <th>Company</th>
                            <th>Interview type</th>
                            <th>Work experience</th>
                            <th>Date &amp; time</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th style={{ paddingRight: '1.25rem' }}>Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.sessions.slice(0, 15).map((session, idx) => {
                            return (
                              <tr key={session.session_id || idx}>
                                <td style={{ paddingLeft: '1.25rem', fontWeight: 500 }}>
                                  {session.job_role || 'N/A'}
                                </td>
                                <td style={{ fontWeight: 500 }}>{session.company_name || 'N/A'}</td>
                                <td>{session.interview_type || 'N/A'}</td>
                                <td>{session.work_experience || 'N/A'}</td>
                                <td>{formatISTDateTime(session.completed_at || session.started_at)}</td>

                                <td style={{ fontWeight: 600, color: '#7861C4' }}>
                                  {formatScore(session.overall_score)}
                                </td>

                                <td>
                                  <span
                                    className={`admin-badge ${
                                      session.status === 'completed'
                                        ? 'admin-badge--success'
                                        : 'admin-badge--warning'
                                    }`}
                                  >
                                    {session.status === 'completed'
                                      ? 'Completed'
                                      : session.status === 'in_progress' || session.status === 'active'
                                      ? 'Incomplete'
                                      : session.status || 'Unknown'}
                                  </span>
                                </td>
                                <td style={{ paddingRight: '1.25rem' }}>
                                  <button
                                    type="button"
                                    className="view-report-button"
                                    onClick={() => handleViewReport(session.session_id)}
                                    disabled={session.status?.toLowerCase() !== 'completed'}
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
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>

      {activeSession && (
        <div className="feedback-modal-backdrop" role="dialog" aria-modal="true">
          <div className="feedback-modal">
            <header className="feedback-modal__header">
              <h3>Session Feedback Report</h3>
              <button
                type="button"
                className="feedback-modal__close"
                onClick={closeReportModal}
              >
                ✕
              </button>
            </header>
            <div className="feedback-modal__body">
              <FeedbackScreen sessionId={activeSession} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentAnalyticsPage;
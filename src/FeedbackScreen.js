import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FiChevronDown,
    FiChevronUp,
    FiUserCheck,
    FiCpu,
    FiMessageCircle,
    FiTarget,
    FiTrendingUp,
    FiUsers,
    FiLayers,
} from 'react-icons/fi';
import { interviewApi } from './api';
import './FeedbackScreen.css';

const classifyScore = (score) => {
    if (score === null || score === undefined || Number.isNaN(Number(score))) {
        return 'neutral';
    }
    const value = Math.min(Math.max(Number(score), 0), 5);
    if (value >= 3.5) return 'great';
    if (value >= 2) return 'average';
    return 'low';
};

const parseFeedback = (payload) => {
    if (!payload) return { structured: null, raw: null };

    // If backend already sends structured/raw keys
    if (payload.structured || payload.raw) {
        return {
            structured: payload.structured || null,
            raw: payload.raw || null,
        };
    }

    // Legacy shape { full_feedback: "..." }
    if (payload.full_feedback) {
        try {
            const parsed = JSON.parse(payload.full_feedback);
            return { structured: parsed, raw: payload.full_feedback };
        } catch (err) {
            return { structured: null, raw: payload.full_feedback };
        }
    }

    // Plain string
    if (typeof payload === 'string') {
        try {
            return { structured: JSON.parse(payload), raw: payload };
        } catch (err) {
            return { structured: null, raw: payload };
        }
    }

    return { structured: null, raw: null };
};

const COMPETENCY_ICON_POOL = [FiCpu, FiMessageCircle, FiUserCheck, FiTarget, FiTrendingUp, FiUsers, FiLayers];

const getCompetencyIcon = (name, index = 0) => {
    if (!name) {
        return COMPETENCY_ICON_POOL[index % COMPETENCY_ICON_POOL.length] || FiCpu;
    }

    const lowered = name.toLowerCase();
    if (lowered.includes('technical') || lowered.includes('problem')) return FiCpu;
    if (lowered.includes('communication') || lowered.includes('presentation')) return FiMessageCircle;
    if (lowered.includes('attitude') || lowered.includes('readiness') || lowered.includes('professional')) return FiUserCheck;
    if (lowered.includes('ownership') || lowered.includes('accountability')) return FiTarget;
    if (lowered.includes('growth') || lowered.includes('learning')) return FiTrendingUp;
    if (lowered.includes('team') || lowered.includes('collaboration') || lowered.includes('cultural')) return FiUsers;
    if (lowered.includes('project') || lowered.includes('application')) return FiLayers;
    return COMPETENCY_ICON_POOL[index % COMPETENCY_ICON_POOL.length] || FiCpu;
};

const SummaryCard = ({ icon: Icon, title, subtitle, data }) => {
    const score = data?.score ?? null;
    const tone = classifyScore(score);
    const sections = useMemo(() => {
        const base = [
            { key: 'highlights', title: 'Highlights', items: data?.highlights },
            { key: 'gaps', title: 'Improvements', items: data?.gaps },
            { key: 'next_steps', title: 'Next Steps', items: data?.next_steps },
        ];

        if (Array.isArray(data?.evidence) && data.evidence.length) {
            base.push({ key: 'evidence', title: 'Evidence', items: data.evidence });
        }

        return base.filter((section) => Array.isArray(section.items) && section.items.length);
    }, [data]);

    const [openSections, setOpenSections] = useState(() => (
        sections.reduce((acc, section) => {
            acc[section.key] = false;
            return acc;
        }, {})
    ));

    useEffect(() => {
        setOpenSections(sections.reduce((acc, section) => {
            acc[section.key] = false;
            return acc;
        }, {}));
    }, [sections]);

    const toggleSection = (key) => {
        setOpenSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    return (
        <div className={`summary-card tone-${tone}`}>
            <div className="summary-card-header">
                <div className="summary-icon"><Icon /></div>
                <div>
                    <p className="summary-title">{title}</p>
                    {subtitle ? <p className="summary-subtitle">{subtitle}</p> : null}
                    <span className="score-badge small">{score != null ? score.toFixed(1) : '—'}</span>
                </div>
            </div>
            <div className="summary-content summary-content--accordion">
                {sections.map((section, idx) => {
                    const isOpen = Boolean(openSections[section.key]);
                    const triggerId = `${section.key}-trigger-${title.replace(/\s+/g, '-').toLowerCase()}`;
                    const panelId = `${section.key}-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
                    return (
                        <div className={`summary-accordion ${isOpen ? 'open' : ''}`} key={`${section.key}-${idx}`}>
                            <button
                                type="button"
                                className="summary-accordion__trigger"
                                onClick={() => toggleSection(section.key)}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                id={triggerId}
                            >
                                <span>{section.title}</span>
                                {isOpen ? <FiChevronUp className="summary-accordion__chevron" /> : <FiChevronDown className="summary-accordion__chevron" />}
                            </button>
                            {isOpen && (
                                <div
                                    className="summary-accordion__panel"
                                    id={panelId}
                                    role="region"
                                    aria-labelledby={triggerId}
                                >
                                    <ul>
                                        {section.items.map((item, itemIdx) => (
                                            <li key={`${section.key}-${itemIdx}`}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function FeedbackScreen({ sessionId, preloadedFeedback }) {
    const [feedback, setFeedback] = useState({ structured: null, raw: null });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openQuestion, setOpenQuestion] = useState(0);
    const triggerRefs = useRef([]);

    useEffect(() => {
        const fetchFeedback = async () => {
            setIsLoading(true);
            try {
                const response = await interviewApi.get(`/feedback/${sessionId}`);
                const parsed = parseFeedback(response.data?.feedback);
                if (!parsed.structured && !parsed.raw) {
                    throw new Error('Invalid feedback format from server.');
                }
                setFeedback(parsed);
            } catch (err) {
                console.error('Error fetching feedback:', err);
                setError('Failed to load feedback. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        if (preloadedFeedback) {
            if (preloadedFeedback.error) {
                setError(preloadedFeedback.error);
            } else {
                setFeedback(parseFeedback(preloadedFeedback));
            }
            setIsLoading(false);
        } else if (sessionId) {
            fetchFeedback();
        }
    }, [sessionId, preloadedFeedback]);

    const questions = useMemo(() => feedback.structured?.questions || [], [feedback]);

    const hasStructured = Boolean(feedback.structured);
    const metadata = feedback.structured?.metadata || {};
    const technical = feedback.structured?.technical_summary;
    const communication = feedback.structured?.communication_summary;
    const attitude = feedback.structured?.attitude_summary;
    const dynamicCompetencies = useMemo(() => {
        if (Array.isArray(feedback.structured?.core_competencies) && feedback.structured.core_competencies.length) {
            return feedback.structured.core_competencies;
        }
        return [];
    }, [feedback]);
    const overallSummary = feedback.structured?.overall_summary;
    const mandatorySkills = useMemo(() => {
        if (!hasStructured) {
            return [];
        }

        const structuredSkills = feedback.structured?.mandatory_skill_scores;
        if (Array.isArray(structuredSkills) && structuredSkills.length) {
            return structuredSkills;
        }

        return [
            ...(technical?.mandatory_skill_scores || []),
            ...(communication?.mandatory_skill_scores || []),
            ...(attitude?.mandatory_skill_scores || []),
        ];
    }, [hasStructured, feedback.structured, technical, communication, attitude]);

    if (isLoading) {
        return (
            <div className="feedback-screen loading">
                <div className="spinner" />
                <h2>Generating your feedback report...</h2>
                <p>The AI is analyzing your performance. This may take a moment.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="feedback-screen error">
                <h2>Oops! Something went wrong.</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
        );
    }

    if (!feedback.structured && !feedback.raw) {
        return (
            <div className="feedback-screen error">
                <h2>No Feedback Available</h2>
                <p>We were unable to load the feedback for this session.</p>
            </div>
        );
    }

    const handleQuestionKeyDown = (event, index) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            const next = (index + 1) % questions.length;
            triggerRefs.current[next]?.focus();
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const prev = (index - 1 + questions.length) % questions.length;
            triggerRefs.current[prev]?.focus();
        }
    };

    return (
        <div className="feedback-screen">
            <div className="feedback-card">
                <header className="feedback-header">
                    <h1>Interview Performance Report</h1>
                    {metadata && (metadata.company_name || metadata.job_role || metadata.interview_type) && (
                        <div className="interview-metadata">
                            {metadata.company_name && (
                                <span className="metadata-item">
                                    <strong>Company</strong>
                                    <span className="metadata-value">{metadata.company_name}</span>
                                </span>
                            )}
                            {metadata.job_role && (
                                <span className="metadata-item">
                                    <strong>Job Role</strong>
                                    <span className="metadata-value">{metadata.job_role}</span>
                                </span>
                            )}
                            {metadata.interview_type && (
                                <span className="metadata-item">
                                    <strong>Interview Type</strong>
                                    <span className="metadata-value">{metadata.interview_type}</span>
                                </span>
                            )}
                        </div>
                    )}
                </header>

                {questions.length > 0 ? (
                    <section className="question-section">
                        <h2>Question-wise Analysis</h2>
                        <div className="accordion-list">
                            {questions.map((item, idx) => {
                                const tone = classifyScore(item.score);
                                const isOpen = openQuestion === idx;
                                const triggerId = `question-trigger-${idx}`;
                                const panelId = `question-panel-${idx}`;
                                const questionNumber = item.number ?? idx + 1;
                                const rawScore = item.score != null ? Math.min(Math.max(Number(item.score), 0), 5) : null;
                                const scoreTone = rawScore == null ? 'neutral' : rawScore >= 3.5 ? 'great' : rawScore >= 2 ? 'average' : 'low';
                                const scoreLabel = rawScore != null ? `Score: ${rawScore.toFixed(1)}/5` : 'Score: —';
                                const answerText = item.original_answer || item.answer;
                                return (
                                    <div
                                        className={`accordion-item tone-${tone} ${isOpen ? 'expanded' : ''}`}
                                        key={`q-${item.number || idx}`}
                                    >
                                        <button
                                            className="accordion-trigger"
                                            type="button"
                                            onClick={() => setOpenQuestion(isOpen ? -1 : idx)}
                                            aria-expanded={isOpen}
                                            aria-controls={panelId}
                                            id={triggerId}
                                            aria-label={`Toggle detailed feedback for question ${questionNumber}`}
                                            onKeyDown={(event) => handleQuestionKeyDown(event, idx)}
                                            ref={(el) => {
                                                triggerRefs.current[idx] = el;
                                            }}
                                        >
                                            <div className="accordion-title">
                                                <span className="question-label" id={`${triggerId}-label`}>
                                                    Question {questionNumber}
                                                </span>
                                                <span className="accordion-question">{item.question}</span>
                                            </div>
                                            <div className="accordion-actions">
                                                <span className={`score-badge ${scoreTone}`}>
                                                    {scoreLabel}
                                                </span>
                                                {isOpen ? <FiChevronUp className="chevron" /> : <FiChevronDown className="chevron" />}
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div
                                                className="accordion-body"
                                                id={panelId}
                                                role="region"
                                                aria-labelledby={`${triggerId}-label`}
                                            >
                                                {answerText ? (
                                                    <div className="detail-block">
                                                        <h4>Your answer</h4>
                                                        <p>{answerText}</p>
                                                    </div>
                                                ) : null}
                                                {item.strengths?.length ? (
                                                    <div className="detail-block">
                                                        <h4>What you did well</h4>
                                                        <ul>{item.strengths.map((point, sIdx) => <li key={`str-${idx}-${sIdx}`}>{point}</li>)}</ul>
                                                    </div>
                                                ) : null}
                                                {item.improvements?.length ? (
                                                    <div className="detail-block">
                                                        <h4>What to improve</h4>
                                                        <ul>{item.improvements.map((point, mIdx) => <li key={`imp-${idx}-${mIdx}`}>{point}</li>)}</ul>
                                                    </div>
                                                ) : null}
                                                {item.better_example ? (
                                                    <div className="detail-block">
                                                        <h4>Suggested answer</h4>
                                                        <p>{item.better_example}</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {mandatorySkills.length ? (
                    <section className="mandatory-skill-section">
                        <h2>Mandatory Skill Scores</h2>
                        <div className="mandatory-skill-grid">
                            {mandatorySkills.map((entry, idx) => {
                                const rawScore = entry.score != null ? Math.min(Math.max(Number(entry.score), 0), 5) : null;
                                const tone = classifyScore(rawScore);
                                const percent = rawScore != null ? Math.round((rawScore / 5) * 100) : 0;
                                const circleStyle = rawScore != null ? { '--skill-progress': `${percent}%` } : { '--skill-progress': '0%' };
                                return (
                                    <article className={`mandatory-skill-card tone-${tone}`} key={`mandatory-${idx}`}>
                                        <div
                                            className={`skill-circle tone-${tone}`}
                                            data-percent={percent}
                                            style={circleStyle}
                                            aria-hidden="true"
                                        >
                                            <span className="skill-circle-value">{rawScore != null ? rawScore.toFixed(1) : '—'}</span>
                                            <span className="skill-circle-label">/5</span>
                                        </div>
                                        <div className="mandatory-skill-content">
                                            <h3>{entry.skill || 'Skill'}</h3>
                                            {entry.rationale ? <p>{entry.rationale}</p> : null}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {dynamicCompetencies.length ? (
                    <section className="summary-section">
                        <div className="summary-section-header">
                            <h2>Core Competency Breakdown</h2>
                        </div>
                        <div className="summary-grid">
                            {dynamicCompetencies.map((entry, idx) => (
                                <SummaryCard
                                    key={`competency-${entry.name || idx}`}
                                    icon={getCompetencyIcon(entry.name, idx)}
                                    title={entry.name || `Competency ${idx + 1}`}
                                    data={{
                                        score: entry.score,
                                        highlights: entry.highlights,
                                        gaps: entry.gaps,
                                        next_steps: entry.next_steps,
                                        evidence: entry.evidence,
                                    }}
                                />
                            ))}
                        </div>
                    </section>
                ) : hasStructured ? (
                    <section className="summary-section">
                        <h2>Core Competency Breakdown</h2>
                        <div className="summary-grid">
                            <SummaryCard icon={FiCpu} title="Technical Mastery" data={technical} />
                            <SummaryCard icon={FiMessageCircle} title="Communication & STAR" data={communication} />
                            <SummaryCard icon={FiUserCheck} title="Attitude & Readiness" data={attitude} />
                        </div>
                    </section>
                ) : null}

                {!hasStructured && feedback.raw ? (
                    <section className="raw-section">
                        <h3>Raw Feedback (fallback)</h3>
                        <p className="raw-hint">Structured insights were unavailable. Displaying the original AI response below.</p>
                        <pre>{feedback.raw}</pre>
                    </section>
                ) : null}
            </div>
        </div>
    );
}

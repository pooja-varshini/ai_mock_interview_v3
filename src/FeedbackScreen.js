import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { interviewApi, getFeedbackStatus, triggerFeedbackGeneration } from './api';
import SystemDesignViewer from './SystemDesignViewer';
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

const FRIENDLY_FEEDBACK_ERROR = "We couldn't generate your feedback right now. Please regenerate the report.";
const NO_ANSWERED_QUESTIONS_MESSAGE = 'No answered questions found for this session';

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

const formatScoreDisplay = (score, decimals = 1) => {
    if (score === null || score === undefined || Number.isNaN(Number(score))) {
        return '—';
    }
    const value = Number(score);
    const rounded = Number(value.toFixed(decimals));
    if (Number.isInteger(rounded)) {
        return String(rounded);
    }
    return rounded.toFixed(decimals);
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
                    <span className="score-badge small">{formatScoreDisplay(score)}</span>
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
    const [noAnsweredQuestions, setNoAnsweredQuestions] = useState(false);
    const [openQuestions, setOpenQuestions] = useState(() => new Set([0]));
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [feedbackStatus, setFeedbackStatus] = useState('pending');
    const [expandedCode, setExpandedCode] = useState(null);
    const [expandedDiagram, setExpandedDiagram] = useState(null);
    const triggerRefs = useRef([]);
    const statusPollingRef = useRef(null);

    const clearStatusPolling = useCallback(() => {
        if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
        }
    }, []);

    const fetchFeedback = useCallback(
        async ({ skipLoading = false } = {}) => {
            if (!sessionId) {
                return false;
            }

            if (!skipLoading) {
                setIsLoading(true);
            }

            try {
                const response = await interviewApi.get(`/feedback/${sessionId}`);
                const parsed = parseFeedback(response.data?.feedback);
                const backendStatus = response?.data?.status;

                const isStillGenerating = response?.status === 202
                    || backendStatus === 'pending'
                    || backendStatus === 'processing';

                if (!parsed.structured) {
                    if (isStillGenerating) {
                        setFeedbackStatus('pending');
                        setError(null);
                        setNoAnsweredQuestions(false);
                        if (!skipLoading) {
                            setIsLoading(true);
                        }
                        return false;
                    }
                    throw new Error('Structured feedback missing');
                }

                setFeedback(parsed);
                setError(null);
                setNoAnsweredQuestions(false);
                setFeedbackStatus('completed');
                return true;
            } catch (err) {
                console.error('Error fetching feedback:', err);
                setFeedback({ structured: null, raw: null });
                const detail =
                    err?.response?.data?.detail ||
                    err?.response?.data?.error ||
                    err?.message ||
                    '';
                const normalizedDetail = typeof detail === 'string' ? detail.toLowerCase() : '';
                const isNoAnswers = normalizedDetail.includes('no answered questions found');
                setNoAnsweredQuestions(isNoAnswers);
                setError(isNoAnswers ? NO_ANSWERED_QUESTIONS_MESSAGE : FRIENDLY_FEEDBACK_ERROR);
                setFeedbackStatus('failed');
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [sessionId]
    );

    const checkFeedbackStatus = useCallback(async () => {
        if (!sessionId) {
            return;
        }

        try {
            const { data } = await getFeedbackStatus(sessionId);
            const status = data?.status || 'pending';
            const statusError = data?.error || null;

            setFeedbackStatus(status);

            if (status === 'completed') {
                clearStatusPolling();
                setError(null);
                setNoAnsweredQuestions(false);
                const fetched = await fetchFeedback({ skipLoading: true });
                if (!fetched) {
                    beginStatusPolling();
                }
            } else if (status === 'failed') {
                clearStatusPolling();
                const normalizedDetail = typeof (statusError || '') === 'string'
                    ? statusError.toLowerCase()
                    : '';
                const isNoAnswers = normalizedDetail.includes('no answered questions found');
                setNoAnsweredQuestions(isNoAnswers);
                setError(isNoAnswers ? NO_ANSWERED_QUESTIONS_MESSAGE : (statusError || FRIENDLY_FEEDBACK_ERROR));
                setFeedback({ structured: null, raw: null });
                setIsLoading(false);
            } else {
                setError(null);
                setNoAnsweredQuestions(false);
                setIsLoading(true);
            }
        } catch (err) {
            console.error('Failed to check feedback status:', err);
            clearStatusPolling();
            setFeedbackStatus('failed');
            setNoAnsweredQuestions(false);
            setError('We could not verify the feedback status. Please regenerate the report.');
            setFeedback({ structured: null, raw: null });
            setIsLoading(false);
        }
    }, [sessionId, fetchFeedback, clearStatusPolling]);

    const beginStatusPolling = useCallback(() => {
        if (!sessionId) {
            return;
        }

        clearStatusPolling();
        setFeedbackStatus('pending');
        setError(null);
        setIsLoading(true);
        checkFeedbackStatus();
        statusPollingRef.current = setInterval(checkFeedbackStatus, 7000);
    }, [sessionId, checkFeedbackStatus, clearStatusPolling]);

    useEffect(() => {
        if (preloadedFeedback) { 
            clearStatusPolling();
            if (preloadedFeedback.error) {
                setFeedbackStatus('failed');
                setError(FRIENDLY_FEEDBACK_ERROR);
                setFeedback({ structured: null, raw: null });
                setIsLoading(false);
            } else {
                const parsed = parseFeedback(preloadedFeedback);
                if (parsed.structured) {
                    setFeedback(parsed);
                    setError(null);
                    setFeedbackStatus('completed');
                    setIsLoading(false);
                } else {
                    beginStatusPolling();
                }
            }
        } else if (sessionId) {
            beginStatusPolling();
        }
    }, [sessionId, preloadedFeedback, beginStatusPolling, clearStatusPolling]);

    useEffect(() => () => {
        clearStatusPolling();
    }, [clearStatusPolling]);

    const hasStructured = Boolean(feedback.structured);
    const metadata = feedback.structured?.metadata || {};
    const questions = useMemo(() => feedback.structured?.questions || [], [feedback]);

    useEffect(() => {
        setOpenQuestions((prev) => {
            if (!questions.length) {
                return new Set();
            }

            const next = new Set(Array.from(prev).filter((idx) => idx < questions.length));
            if (!next.size) {
                next.add(0);
            }
            return next;
        });
    }, [questions]);

    const toggleQuestion = useCallback((idx) => {
        setOpenQuestions((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    }, []);

    const handleRegenerate = useCallback(async () => {
        if (!sessionId || isRegenerating) {
            return;
        }

        try {
            setIsRegenerating(true);
            setError(null);
            await triggerFeedbackGeneration(sessionId);
            beginStatusPolling();
        } catch (err) {
            console.error('Error regenerating feedback:', err);
            setError(FRIENDLY_FEEDBACK_ERROR);
        } finally {
            setIsRegenerating(false);
            if (feedbackStatus !== 'pending') {
                setIsLoading(false);
            }
        }
    }, [sessionId, isRegenerating, beginStatusPolling, triggerFeedbackGeneration, feedbackStatus]);

    const technical = feedback.structured?.technical_summary;
    const communication = feedback.structured?.communication_summary;
    const attitude = feedback.structured?.attitude_summary;
    const dynamicCompetencies = useMemo(() => {
        if (Array.isArray(feedback.structured?.core_competencies) && feedback.structured.core_competencies.length) {
            return feedback.structured.core_competencies;
        }
        return [];
    }, [feedback]);
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
                <h2>{noAnsweredQuestions ? 'No Answers Yet' : 'Oops! Something went wrong.'}</h2>
                <p>{error}</p>
                {!noAnsweredQuestions && (
                    <button type="button" onClick={handleRegenerate} disabled={isRegenerating}>
                        {isRegenerating ? 'Regenerating…' : 'Regenerate Feedback'}
                    </button>
                )}
            </div>
        );
    }

    if (!feedback.structured && !feedback.raw) {
        return (
            <div className="feedback-screen error">
                <h2>No Feedback Available</h2>
                <p>We were unable to load the feedback for this session.</p>
                <button type="button" onClick={handleRegenerate} disabled={isRegenerating}>
                    {isRegenerating ? 'Regenerating…' : 'Regenerate Feedback'}
                </button>
            </div>
        );
    }

    const handleQuestionKeyDown = (event, index) => {
        if (!questions.length) {
            return;
        }

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
                                const isOpen = openQuestions.has(idx);
                                const triggerId = `question-trigger-${idx}`;
                                const panelId = `question-panel-${idx}`;
                                const questionNumber = item.number ?? idx + 1;
                                const rawScore = item.score != null ? Math.min(Math.max(Number(item.score), 0), 5) : null;
                                const scoreTone = rawScore == null ? 'neutral' : rawScore >= 3.5 ? 'great' : rawScore >= 2 ? 'average' : 'low';
                                const scoreLabel = rawScore != null ? `Score: ${formatScoreDisplay(rawScore)}/5` : 'Score: —';
                                const answerRaw = item.original_answer || item.answer;
                                const questionTypeValue = (item.question_type || '').toLowerCase();
                                const isCoding = Boolean(item.is_coding) || questionTypeValue === 'coding' || questionTypeValue.startsWith('coding ');
                                // Detect system design from question_type OR from answer containing diagram JSON
                                const candidateDiagram = (() => {
                                    try {
                                        const parsed = typeof answerRaw === 'string' ? JSON.parse(answerRaw) : answerRaw;
                                        if (parsed?.nodes) {
                                            console.log('[FeedbackScreen] Candidate diagram parsed:', { nodes: parsed.nodes?.length, edges: parsed.edges?.length, raw: parsed });
                                        }
                                        return parsed?.nodes ? parsed : null;
                                    } catch (e) { 
                                        console.log('[FeedbackScreen] Candidate diagram parse error:', e.message);
                                        return null; 
                                    }
                                })();
                                const isSystemDesign = questionTypeValue.includes('system') && questionTypeValue.includes('design') || candidateDiagram !== null;
                                const safeAnswerText = (() => {
                                    if (answerRaw == null) {
                                        return '';
                                    }
                                    return typeof answerRaw === 'string'
                                        ? answerRaw
                                        : JSON.stringify(answerRaw, null, 2);
                                })();
                                // Parse better_example as diagram JSON for system design questions
                                const suggestedDiagram = isSystemDesign ? (() => {
                                    try {
                                        const parsed = typeof item.better_example === 'string' ? JSON.parse(item.better_example) : item.better_example;
                                        if (parsed?.nodes) {
                                            console.log('[FeedbackScreen] Suggested diagram parsed:', { nodes: parsed.nodes?.length, edges: parsed.edges?.length });
                                        } else {
                                            console.log('[FeedbackScreen] better_example is not a diagram:', typeof item.better_example, item.better_example?.substring?.(0, 200));
                                        }
                                        return parsed?.nodes ? parsed : null;
                                    } catch (e) { 
                                        console.log('[FeedbackScreen] Suggested diagram parse error:', e.message, 'Raw:', item.better_example?.substring?.(0, 200));
                                        return null; 
                                    }
                                })() : null;
                                const codeLanguage = questionTypeValue.includes('sql')
                                    ? 'SQL'
                                    : questionTypeValue.includes('python')
                                    ? 'Python'
                                    : '';
                                const safeBetterExample = (() => {
                                    if (item.better_example == null) {
                                        return '';
                                    }
                                    return typeof item.better_example === 'string'
                                        ? item.better_example
                                        : JSON.stringify(item.better_example, null, 2);
                                })();
                                return (
                                    <div
                                        className={`accordion-item tone-${tone} ${isOpen ? 'expanded' : ''}`}
                                        key={`q-${item.number || idx}`}
                                    >
                                        <button
                                            className="accordion-trigger"
                                            type="button"
                                            onClick={() => toggleQuestion(idx)}
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
                                                {isSystemDesign && candidateDiagram ? (
                                                    <div className="detail-block detail-block--system-design">
                                                        <h4>Your Design</h4>
                                                        <div className="diagram-block-container">
                                                            <button
                                                                type="button"
                                                                className="code-expand-button"
                                                                aria-label="Expand your design"
                                                                onClick={() =>
                                                                    setExpandedDiagram({
                                                                        title: 'Your Design',
                                                                        questionNumber,
                                                                        diagram: candidateDiagram,
                                                                    })
                                                                }
                                                            >
                                                                ⤢
                                                            </button>
                                                            <div className="diagram-block">
                                                                <SystemDesignViewer diagram={candidateDiagram} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : safeAnswerText && !isSystemDesign ? (
                                                    <div className={`detail-block ${isCoding ? 'detail-block--code' : ''}`}>
                                                        <h4>
                                                            Your answer
                                                            {codeLanguage ? ` (${codeLanguage})` : ''}
                                                        </h4>
                                                        {isCoding ? (
                                                            <div className="code-block-container">
                                                                <button
                                                                    type="button"
                                                                    className="code-expand-button"
                                                                    aria-label="Expand your code answer"
                                                                    onClick={() =>
                                                                        setExpandedCode({
                                                                            title: 'Your answer',
                                                                            language: codeLanguage,
                                                                            questionNumber,
                                                                            code: safeAnswerText,
                                                                        })
                                                                    }
                                                                >
                                                                    ⤢
                                                                </button>
                                                                <pre className="code-block" aria-label="Your code answer">
                                                                    <code>{safeAnswerText}</code>
                                                                </pre>
                                                            </div>
                                                        ) : (
                                                            <p>{safeAnswerText}</p>
                                                        )}
                                                    </div>
                                                ) : null}
                                                {item.strengths?.length ? (
                                                    <div className="detail-block">
                                                        <h4>What you did well</h4>
                                                        <p>{item.strengths.join(' ')}</p>
                                                    </div>
                                                ) : null}
                                                {item.improvements?.length ? (
                                                    <div className="detail-block">
                                                        <h4>What to improve</h4>
                                                        <p>{item.improvements.join(' ')}</p>
                                                    </div>
                                                ) : null}
                                                {isSystemDesign && suggestedDiagram ? (
                                                    <div className="detail-block detail-block--system-design">
                                                        <h4>Suggested Design</h4>
                                                        <div className="diagram-block-container">
                                                            <button
                                                                type="button"
                                                                className="code-expand-button"
                                                                aria-label="Expand suggested design"
                                                                onClick={() =>
                                                                    setExpandedDiagram({
                                                                        title: 'Suggested Design',
                                                                        questionNumber,
                                                                        diagram: suggestedDiagram,
                                                                    })
                                                                }
                                                            >
                                                                ⤢
                                                            </button>
                                                            <div className="diagram-block">
                                                                <SystemDesignViewer diagram={suggestedDiagram} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                {safeBetterExample && !suggestedDiagram ? (
                                                    <div className={`detail-block ${isCoding ? 'detail-block--code' : ''}`}>
                                                        <h4>
                                                            Suggested answer
                                                            {codeLanguage ? ` (${codeLanguage})` : ''}
                                                        </h4>
                                                        {isCoding ? (
                                                            <div className="code-block-container">
                                                                <button
                                                                    type="button"
                                                                    className="code-expand-button"
                                                                    aria-label="Expand suggested code answer"
                                                                    onClick={() =>
                                                                        setExpandedCode({
                                                                            title: 'Suggested answer',
                                                                            language: codeLanguage,
                                                                            questionNumber,
                                                                            code: safeBetterExample,
                                                                        })
                                                                    }
                                                                >
                                                                    ⤢
                                                                </button>
                                                                <pre className="code-block" aria-label="Suggested code answer">
                                                                    <code>{safeBetterExample}</code>
                                                                </pre>
                                                            </div>
                                                        ) : (
                                                            <p>{safeBetterExample}</p>
                                                        )}
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
                                            <span className="skill-circle-value">{formatScoreDisplay(rawScore)}</span>
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
            </div>
            {expandedCode && (
                <div
                    className="code-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Expanded code for question ${expandedCode.questionNumber}`}
                >
                    <div className="code-modal">
                        <header className="code-modal__header">
                            <h3>
                                {expandedCode.title}
                                {expandedCode.language ? ` (${expandedCode.language})` : ''} – Question{' '}
                                {expandedCode.questionNumber}
                            </h3>
                            <button
                                type="button"
                                className="code-modal__close"
                                onClick={() => setExpandedCode(null)}
                                aria-label="Close expanded code"
                            >
                                ×
                            </button>
                        </header>
                        <div className="code-modal__body">
                            <pre className="code-modal__block">
                                <code>{expandedCode.code}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}
            {expandedDiagram && (
                <div
                    className="diagram-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Expanded diagram for question ${expandedDiagram.questionNumber}`}
                >
                    <div className="diagram-modal">
                        <header className="diagram-modal__header">
                            <h3>
                                {expandedDiagram.title} – Question {expandedDiagram.questionNumber}
                            </h3>
                            <button
                                type="button"
                                className="diagram-modal__close"
                                onClick={() => setExpandedDiagram(null)}
                                aria-label="Close expanded diagram"
                            >
                                ×
                            </button>
                        </header>
                        <div className="diagram-modal__body">
                            <SystemDesignViewer diagram={expandedDiagram.diagram} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

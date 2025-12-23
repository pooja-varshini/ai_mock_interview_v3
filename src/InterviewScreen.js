import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FiBriefcase, FiHome, FiZap, FiAward } from 'react-icons/fi';
import { interviewApi, fetchSessionRating, submitSessionRating, getFeedbackStatus, triggerFeedbackGeneration } from './api';
import SessionCompleted from './SessionCompleted';
import FeedbackScreen from './FeedbackScreen';
import './InterviewScreen.css';
import CodingWorkspace from './CodingWorkspace';
import SessionRatingModal from './SessionRatingModal';
import VideoRecorder from './VideoRecorder';
import SystemDesignCanvas from './SystemDesignCanvas';
import './SystemDesignCanvas.css';

const normalizeQuestion = (rawQuestion) => {
    if (!rawQuestion) {
        return null;
    }
    if (typeof rawQuestion === 'string') {
        return {
            id: null,
            text: rawQuestion,
            type: 'standard',
            raw: rawQuestion,
        };
    }

    if (typeof rawQuestion === 'object') {
        const text = rawQuestion.text
            ?? rawQuestion.question
            ?? rawQuestion.question_text
            ?? rawQuestion.prompt
            ?? '';

        const typeValue = rawQuestion.question_type ?? rawQuestion.type ?? 'standard';
        const normalizedType = typeof typeValue === 'string'
            ? typeValue.trim().toLowerCase()
            : 'standard';
        const effectiveType = normalizedType.startsWith('coding') ? 'coding' : normalizedType;

        return {
            id: rawQuestion.id ?? rawQuestion.question_id ?? rawQuestion.uuid ?? null,
            text: typeof text === 'string' ? text : String(text ?? ''),
            type: effectiveType || 'standard',
            raw: rawQuestion,
        };
    }

    return {
        id: null,
        text: String(rawQuestion),
        type: 'standard',
        raw: rawQuestion,
    };
};

export default function InterviewScreen({ interviewData, onInterviewEnd, addToast }) {
    const {
        sessionId,
        firstQuestion,
        keySkills,
        jobRole,
        industryType,
        companyName,
        questionNumber: initialQuestionNumber = 1,
        maxQuestions: initialMaxQuestions = null,
    } = interviewData;

    const displayRole = jobRole && jobRole.trim() !== '' ? jobRole : 'Any Role';
    const displayCompany = companyName && companyName.trim() !== '' ? companyName : 'Any Company';
    const formattedIndustry = (() => {
        if (!industryType || industryType.trim() === '' || industryType.trim().toLowerCase() === 'n/a') {
            return 'N/A';
        }
        return industryType;
    })();

    // Essential state only
    const [question, setQuestion] = useState(() => normalizeQuestion(firstQuestion));
    const [questionNumber, setQuestionNumber] = useState(initialQuestionNumber || 1);
    const [isAnswering, setIsAnswering] = useState(() => {
        const normalizedFirst = normalizeQuestion(firstQuestion);
        return normalizedFirst?.type === 'coding';
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isAnalyzingFinal, setIsAnalyzingFinal] = useState(false);
    const [answer, setAnswer] = useState('');
    const [finalFeedback, setFinalFeedback] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [canViewFeedback, setCanViewFeedback] = useState(false);
    const [answerError, setAnswerError] = useState('');
    const [, setCodingSubmission] = useState(null);
    const [maxQuestions, setMaxQuestions] = useState(initialMaxQuestions);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [existingRating, setExistingRating] = useState({ rating: 0, comments: '' });
    const [ratingLoaded, setRatingLoaded] = useState(false);
    const [feedbackStatus, setFeedbackStatus] = useState('not_requested');
    const [feedbackError, setFeedbackError] = useState(null);
    const pollingRef = useRef(null);
    const toastTimerRef = useRef(null);
    const videoRecorderRef = useRef(null);
    const [videoStatus, setVideoStatus] = useState('idle');
    const [videoReady, setVideoReady] = useState(false);
    const [videoError, setVideoError] = useState(null);
    const [isVideoUploading, setIsVideoUploading] = useState(false);
    const [floatingPanelPosition, setFloatingPanelPosition] = useState(null);
    const floatingPanelDragRef = useRef(null);
    const floatingPanelRef = useRef(null);
    const [isSystemDesignModalOpen, setIsSystemDesignModalOpen] = useState(false);
    const [systemDesignDiagram, setSystemDesignDiagram] = useState('');
    const [systemDesignError, setSystemDesignError] = useState('');
    const [timeRemaining, setTimeRemaining] = useState(null);
    const timerRef = useRef(null);
    const timerDeadlineRef = useRef(null);
    const autoSubmitTriggeredRef = useRef(false);

    const clearFeedbackPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const clearToastTimer = useCallback(() => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await getFeedbackStatus(sessionId);
            const { status, error } = data;
            const normalizedStatus = status || 'pending';
            const normalizedError = error || null;

            setFeedbackStatus(normalizedStatus);
            setFeedbackError(normalizedError);

            if (normalizedStatus === 'completed') {
                clearFeedbackPolling();
                setIsAnalyzingFinal(false);
                setIsComplete(true);
                setCanViewFeedback(true);
            } else if (normalizedStatus === 'failed') {
                clearFeedbackPolling();
                setIsAnalyzingFinal(false);
                setIsComplete(true);
                setCanViewFeedback(true);
                if (!normalizedError) {
                    setFeedbackError('We hit a snag while preparing your report. Please try regenerating.');
                }
            }
        } catch (err) {
            console.error('Failed to fetch feedback status', err);
            clearFeedbackPolling();
            setFeedbackStatus('failed');
            setFeedbackError('We could not verify the feedback status. Please regenerate the report.');
            setIsAnalyzingFinal(false);
            setIsComplete(true);
            setCanViewFeedback(true);
        }
    }, [sessionId, clearFeedbackPolling]);

    const beginFeedbackPolling = useCallback(() => {
        setFeedbackStatus('pending');
        setFeedbackError(null);
        setIsAnalyzingFinal(true);
        setIsComplete(true);
        setCanViewFeedback(false);
        setShowFeedback(false);
        fetchStatus();
        clearFeedbackPolling();
        pollingRef.current = setInterval(fetchStatus, 7000);
    }, [fetchStatus, clearFeedbackPolling]);

    useEffect(() => () => {
        clearFeedbackPolling();
        clearToastTimer();
    }, [clearFeedbackPolling, clearToastTimer]);

    // Refs for speech recognition and text area focus management
    const recognitionRef = useRef(null);
    const answerInputRef = useRef(null);
    const answerRef = useRef('');

    const isCodingQuestion = question?.type === 'coding';
    const isSystemDesignQuestion = (() => {
        const type = (question?.type || question?.raw?.question_type || '').toString().toLowerCase();
        return type.includes('system design');
    })();

    const hasValidDiagram = useMemo(() => {
        if (!systemDesignDiagram) return false;
        try {
            const parsed = JSON.parse(systemDesignDiagram);
            return Array.isArray(parsed.nodes) && parsed.nodes.length > 0;
        } catch {
            return false;
        }
    }, [systemDesignDiagram]);
    const rawQuestionType = question?.raw?.question_type ?? question?.type ?? '';
    const normalizedQuestionType = typeof rawQuestionType === 'string' ? rawQuestionType.trim().toLowerCase() : '';
    const isSqlQuestion = isCodingQuestion && normalizedQuestionType.includes('sql');
    const isSpeechQuestion = normalizedQuestionType.includes('speech');
    
    // Timer duration based on question type: Speech Based = 2 min, Coding/System Design = 15 min
    const questionTimeLimitSeconds = useMemo(() => {
        if (isSpeechQuestion) return 2 * 60; // 2 minutes
        if (isCodingQuestion || isSystemDesignQuestion) return 15 * 60; // 15 minutes
        return 2 * 60; // Default to 2 minutes for unknown types
    }, [isSpeechQuestion, isCodingQuestion, isSystemDesignQuestion]);

    const trimmedAnswer = useMemo(() => (
        typeof answer === 'string' ? answer.trim() : ''
    ), [answer]);

    const codingSupportedLanguages = useMemo(() => {
        if (!isCodingQuestion) {
            return undefined;
        }
        return isSqlQuestion ? ['sqlite'] : ['python'];
    }, [isCodingQuestion, isSqlQuestion]);

    const codingDefaultLanguage = useMemo(() => {
        if (!isCodingQuestion) {
            return undefined;
        }
        if (isSqlQuestion) {
            return 'sqlite';
        }
        return 'python';
    }, [isCodingQuestion, isSqlQuestion]);

    const codingInitialCode = useMemo(() => {
        const starter = question?.raw?.starter_code || question?.raw?.initial_code;
        if (starter && typeof starter === 'string') {
            return starter;
        }
        return isSqlQuestion ? '-- Write your answer here\n' : '# Write your answer here\n';
    }, [isSqlQuestion, question]);

    const renderSkillsSection = (isCompact = false) => (
        <div className={`skills-section${isCompact ? ' skills-section--compact' : ''}`}>
            <p className="skills-label">Key Skills to Demonstrate</p>
            <div className="skills-badges">
                {skillList.length > 0 ? (
                    skillList.map((skill, index) => (
                        <span key={index} className="skill-pill">
                            <span className="skill-icon"><FiZap size={12} /></span>
                            {skill}
                        </span>
                    ))
                ) : (
                    <span className="skill-pill">
                        <span className="skill-icon"><FiZap size={12} /></span>
                        General Communication
                    </span>
                )}
            </div>
        </div>
    );
    useEffect(() => {
        setQuestion(normalizeQuestion(firstQuestion));
        setQuestionNumber(initialQuestionNumber || 1);
        setMaxQuestions(initialMaxQuestions ?? null);
        setAnswerError('');
    }, [firstQuestion, initialQuestionNumber, initialMaxQuestions]);

    useEffect(() => {
        if (isCodingQuestion) {
            stopSpeechRecognition();
            setIsAnswering(true);
            setAnswer('');
        } else {
            setIsRecording(false);
            setIsAnswering(questionNumber > 1);
            setAnswer('');
            setCodingSubmission(null);
            setIsAnalyzingFinal(false);
            setAnswerError('');
        }
        setSystemDesignDiagram('');
        setSystemDesignError('');
        setIsSystemDesignModalOpen(false);
        // Reset timer for new question
        const hasTimer = typeof questionTimeLimitSeconds === 'number' && questionTimeLimitSeconds > 0;
        if (hasTimer) {
            timerDeadlineRef.current = Date.now() + questionTimeLimitSeconds * 1000;
            setTimeRemaining(questionTimeLimitSeconds);
        } else {
            timerDeadlineRef.current = null;
            setTimeRemaining(null);
        }
        autoSubmitTriggeredRef.current = false;
    }, [isCodingQuestion, questionNumber, questionTimeLimitSeconds]);

    // Ref to hold submit function for auto-submit
    const handleSubmitAnswerRef = useRef(null);
    
    // Timer effect - runs against deadline so tab switches don't pause countdown
    useEffect(() => {
        if (isComplete || !timerDeadlineRef.current) {
            return undefined;
        }

        const updateRemaining = () => {
            if (!timerDeadlineRef.current) return;
            const msLeft = timerDeadlineRef.current - Date.now();
            const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));

            setTimeRemaining((prev) => (prev !== secondsLeft ? secondsLeft : prev));

            if (secondsLeft <= 0) {
                timerDeadlineRef.current = null;
                if (!autoSubmitTriggeredRef.current && handleSubmitAnswerRef.current) {
                    autoSubmitTriggeredRef.current = true;
                    setTimeout(() => handleSubmitAnswerRef.current(true), 100);
                }
            }
        };

        updateRemaining();
        timerRef.current = setInterval(updateRemaining, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [questionNumber, isComplete]);

    useEffect(() => {
        if (isAnswering && !isCodingQuestion && answerInputRef.current) {
            answerInputRef.current.focus({ preventScroll: true });
        }
    }, [isAnswering, isCodingQuestion]);

    useEffect(() => {
        answerRef.current = answer;
    }, [answer]);

    // Format time remaining as MM:SS
    const formatTime = (seconds) => {
        if (seconds === null) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartAnswering = () => {
        if (isCodingQuestion) {
            return;
        }
        setIsAnswering(true);
        if (answerError) {
            setAnswerError('');
        }
    };

    useEffect(() => {
        const loadExistingRating = async () => {
            if (!sessionId || !interviewData?.studentEmail) {
                setRatingLoaded(true);
                return;
            }
            try {
                const { data } = await fetchSessionRating(sessionId, interviewData.studentEmail);
                if (data?.rating) {
                    setExistingRating({ rating: data.rating, comments: data.comments || '' });
                }
            } catch (error) {
                console.warn('Unable to fetch existing session rating:', error);
            } finally {
                setRatingLoaded(true);
            }
        };

        if (isComplete && feedbackStatus === 'completed') {
            loadExistingRating();
        } else if (!isComplete || feedbackStatus !== 'completed') {
            setRatingLoaded(false);
            setIsRatingModalOpen(false);
        }
    }, [isComplete, feedbackStatus, sessionId, interviewData?.studentEmail]);

    useEffect(() => {
        if (feedbackStatus === 'completed') {
            if (existingRating.rating > 0) {
                setIsRatingModalOpen(false);
                setCanViewFeedback(true);
            } else {
                setIsRatingModalOpen(true);
                setCanViewFeedback(false);
            }
        } else if (feedbackStatus === 'failed') {
            setCanViewFeedback(true);
        } else {
            setCanViewFeedback(false);
        }
    }, [feedbackStatus, existingRating.rating]);

    const handleMicClick = () => {
        if (isRecording) {
            stopSpeechRecognition();
        } else {
            if (answerError) {
                setAnswerError('');
            }
            startSpeechRecognition();
        }
    };

    const handleRatingSubmit = async ({ rating, comments }) => {
        if (!sessionId || !interviewData?.studentEmail) {
            setIsRatingModalOpen(false);
            onInterviewEnd(sessionId);
            return;
        }

        try {
            await submitSessionRating(sessionId, interviewData.studentEmail, { rating, comments });
            addToast('Thank you for rating your interview!', 'success');
            setExistingRating({ rating, comments: comments || '' });
            setIsRatingModalOpen(false);
            setCanViewFeedback(true);
        } catch (error) {
            console.error('Failed to submit session rating:', error);
            const message = error?.response?.data?.detail || 'Unable to submit rating. Please try again later.';
            addToast(message, 'error');
            throw new Error(message);
        }
    };

    const handleViewFeedback = useCallback(() => {
        if (!canViewFeedback) {
            if (feedbackStatus === 'completed') {
                setIsRatingModalOpen(true);
            }
            return;
        }
        setShowFeedback(true);
    }, [canViewFeedback, feedbackStatus]);

    const handleRegenerateFeedback = useCallback(async () => {
        if (!sessionId) {
            return;
        }

        try {
            setFeedbackStatus('pending');
            setFeedbackError(null);
            setCanViewFeedback(false);
            setIsRatingModalOpen(false);
            setShowFeedback(false);
            await triggerFeedbackGeneration(sessionId);
            beginFeedbackPolling();
        } catch (error) {
            console.error('Failed to regenerate feedback:', error);
            const message = error?.response?.data?.detail || 'Unable to regenerate feedback right now. Please try again later.';
            setFeedbackStatus('failed');
            setFeedbackError(message);
            if (typeof addToast === 'function') {
                addToast(message, 'error');
            }
        }
    }, [sessionId, beginFeedbackPolling, addToast]);

    const handleReturnToDashboard = () => {
        if (existingRating.rating > 0) {
            onInterviewEnd(sessionId);
        } else {
            setIsRatingModalOpen(true);
        }
    };

    const startSpeechRecognition = () => {
        console.log('Attempting to start speech recognition...');
        
        if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
            alert('Browser does not support speech recognition.');
            return;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            
            // Basic settings
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.manualStop = false; // Initialize the flag
            
            const existingAnswer = answerRef.current || '';
            let finalTranscript = existingAnswer;
            console.log('Speech recognition configured');

            recognitionRef.current.onresult = (event) => {
                console.log('🎤 SPEECH DETECTED! Event:', event);
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);
                    
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const fullText = (finalTranscript + interimTranscript).replace(/\s+/g, ' ').trimStart();
                console.log('📝 Setting answer to:', fullText);
                setAnswer(fullText);
            };

            recognitionRef.current.onstart = () => {
                console.log('✅ Speech recognition STARTED successfully');
                setIsRecording(true);
            };

            recognitionRef.current.onend = () => {
                console.log('⏹️ Speech recognition ended');
                // Use the ref to check if we should restart (avoids closure issues)
                if (recognitionRef.current && !recognitionRef.current.manualStop) {
                    console.log('🔄 Attempting to restart...');
                    setTimeout(() => {
                        try {
                            if (recognitionRef.current && !recognitionRef.current.manualStop) {
                                recognitionRef.current.start();
                            }
                        } catch (e) {
                            console.error('❌ Error restarting:', e);
                            setIsRecording(false);
                        }
                    }, 100);
                } else {
                    console.log('🛑 Manual stop detected, not restarting');
                    setIsRecording(false);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('❌ Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied. Please allow microphone access and try again.');
                    setIsRecording(false);
                }
            };

            // Start recognition
            console.log('🚀 Starting speech recognition...');
            finalTranscript = existingAnswer;
            if (answerInputRef.current) {
                answerInputRef.current.focus({ preventScroll: true });
            }
            recognitionRef.current.start();

        } catch (error) {
            console.error('❌ Failed to initialize speech recognition:', error);
            alert('Failed to start speech recognition: ' + error.message);
        }
    };

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.manualStop = true; // Set a flag to prevent auto-restarting
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const postAnswer = async (formData) => {
        const response = await interviewApi.post(`/interview/${sessionId}/answer`, formData);
        const {
            next_question,
            next_question_meta,
            acknowledgment,
            completed,
            question_number,
            current_max_questions,
        } = response.data;

        if (typeof current_max_questions === 'number') {
            setMaxQuestions(current_max_questions);
        }

        if (completed) {
            clearToastTimer();
            toastTimerRef.current = setTimeout(() => {
                beginFeedbackPolling();
            }, 1100);
            return;
        }

        const normalizedNext = next_question_meta ? normalizeQuestion(next_question_meta) : normalizeQuestion(next_question);
        if (normalizedNext) {
            setQuestion(normalizedNext);
            if (typeof question_number === 'number') {
                setQuestionNumber(question_number);
            } else {
                setQuestionNumber((prev) => prev + 1);
            }
        } else {
            setQuestion(null);
        }
        setAnswer('');
        setCodingSubmission(null);
        setAnswerError('');
        if (acknowledgment) {
            clearToastTimer();
            addToast(acknowledgment);
            toastTimerRef.current = setTimeout(() => {
                toastTimerRef.current = null;
            }, 1100);
        }

        setIsAnalyzingFinal(false);
    };

    const handleSubmitAnswer = async (isAutoSubmit = false) => {
        // For manual submit, validate answers
        if (!isAutoSubmit) {
            if (isSystemDesignQuestion) {
                if (!hasValidDiagram) {
                    setSystemDesignError('Please add at least one component to your design before submitting.');
                    return;
                }
            }

            if (!trimmedAnswer && !isSystemDesignQuestion) {
                setAnswerError('Answer cannot be empty');
                if (answerInputRef.current) {
                    answerInputRef.current.focus({ preventScroll: true });
                }
                return;
            }
        }

        setAnswerError('');
        const isFinalQuestion = typeof maxQuestions === 'number' ? questionNumber >= maxQuestions : false;

        setIsLoading(true);
        stopSpeechRecognition();
        setIsAnalyzingFinal(isFinalQuestion);

        try {
            const formData = new FormData();
            const answerPayload = isSystemDesignQuestion && systemDesignDiagram
                ? systemDesignDiagram
                : trimmedAnswer;
            formData.append('answer', answerPayload);
            if (question?.id != null) {
                formData.append('question_id', String(question.id));
            }
            if (question?.type) {
                formData.append('question_type', question.type);
            }
            if (isSystemDesignQuestion && systemDesignDiagram) {
                formData.append('system_design_diagram', systemDesignDiagram);
            }
            if (isFinalQuestion) {
                formData.append('is_final', 'true');
            }
            // Only capture video for speech-based questions (not coding or system design)
            if (shouldRecordVideo) {
                const videoBlob = await captureVideoClip();
                if (videoBlob) {
                    const extension = videoBlob.type === 'video/mp4' ? 'mp4' : 'webm';
                    formData.append('response_video', videoBlob, `session-${sessionId}-q${questionNumber}.${extension}`);
                }
            }
            await postAnswer(formData);
        } catch (error) {
            console.error('Error submitting answer:', error);
            const message = error?.response?.data?.detail && !/^\d{3}/.test(error.response.data.detail)
                ? error.response.data.detail
                : 'We couldn\'t generate your feedback right now. Please regenerate the report.';
            if (isFinalQuestion) {
                setFeedbackError(message);
                setFeedbackStatus('failed');
                setIsComplete(true);
                setIsAnalyzingFinal(false);
                if (typeof addToast === 'function') {
                    addToast(message, 'error');
                }
            } else {
                setAnswerError('Failed to submit answer. Please try again.');
                setIsAnalyzingFinal(false);
            }
        } finally {
            setIsLoading(false);
            if (!isFinalQuestion) {
                setIsAnalyzingFinal(false);
            }
        }
    };

    // Keep ref updated for auto-submit timer
    handleSubmitAnswerRef.current = handleSubmitAnswer;

    const handleSubmitCoding = async (submission) => {
        setCodingSubmission(submission);

        const isFinalQuestion = typeof maxQuestions === 'number' ? questionNumber >= maxQuestions : false;

        if (!submission?.code?.trim()) {
            alert('Please write your solution before submitting.');
            return;
        }

        setIsLoading(true);
        if (isFinalQuestion) {
            setIsAnalyzingFinal(true);
        } else {
            setIsAnalyzingFinal(false);
        }
        try {
            const formData = new FormData();
            formData.append('answer', submission.stdout || submission.code);
            formData.append('code', submission.code);
            if (submission.stdin) {
                formData.append('stdin', submission.stdin);
            }
            if (submission.stdout) {
                formData.append('stdout', submission.stdout);
            }
            if (submission.stderr) {
                formData.append('stderr', submission.stderr);
            }
            if (submission.internalError) {
                formData.append('runtime_error', submission.internalError);
            }
            formData.append('execution_success', submission.success ? 'true' : 'false');
            formData.append('has_run', submission.hasRun ? 'true' : 'false');
            if (question?.id != null) {
                formData.append('question_id', String(question.id));
            }
            if (question?.type) {
                formData.append('question_type', question.type);
            }
            if (isFinalQuestion) {
                formData.append('is_final', 'true');
            }
            // No video capture for coding questions - only for speech-based
            await postAnswer(formData);
        } catch (error) {
            console.error('Error submitting code answer:', error);
            const message = error?.response?.data?.detail && !/^\d{3}/.test(error.response.data.detail)
                ? error.response.data.detail
                : 'We couldn\'t generate your feedback right now. Please regenerate the report.';
            if (isFinalQuestion) {
                setFeedbackError(message);
                setFeedbackStatus('failed');
                setIsComplete(true);
                setIsAnalyzingFinal(false);
                if (typeof addToast === 'function') {
                    addToast(message, 'error');
                } else {
                    alert(message);
                }
            } else {
                alert(message);
                setIsAnalyzingFinal(false);
            }
        } finally {
            setIsLoading(false);
            if (!isFinalQuestion) {
                setIsAnalyzingFinal(false);
            }
        }
    };

    const rawSkills = question?.raw?.mandatory_skills ?? keySkills;
    const skillList = Array.isArray(rawSkills)
        ? rawSkills
        : typeof rawSkills === 'string'
            ? rawSkills.split(',').map(skill => skill.trim()).filter(Boolean)
            : (Array.isArray(keySkills) ? keySkills : []);
    const columnsClass = isCodingQuestion
        ? "interview-columns interview-columns--split"
        : "interview-columns interview-columns--stack";
    const questionColumnClass = isCodingQuestion
        ? "question-column question-column--split"
        : "question-column";

    const shouldHideQuestionContent = !isCodingQuestion && questionNumber === 1 && !isAnswering;

    const questionCardClasses = ["question-card"];
    if (isCodingQuestion) {
        questionCardClasses.push("question-card--coding");
    }

    const renderQuestionText = (rawText) => {
        const sourceText = typeof rawText === 'string' && rawText.trim().length > 0
            ? rawText.replace(/\n/g, '\n')
            : 'Loading question...';

        const lines = sourceText.split(/\r?\n/);

        return lines.map((line, lineIndex) => {
            const segments = [];
            const boldRegex = /\*\*(.+?)\*\*/g;
            let lastIndex = 0;
            let match;
            let tokenIndex = 0;

            const isBulletPoint = line.trimStart().startsWith('- ');
            const processedLine = isBulletPoint ? line.trimStart().substring(2) : line;

            while ((match = boldRegex.exec(processedLine)) !== null) {
                const matchStart = match.index;
                const matchText = match[1];

                if (matchStart > lastIndex) {
                    const plainText = processedLine.slice(lastIndex, matchStart);
                    if (plainText) {
                        segments.push(
                            <span key={`text-${lineIndex}-${tokenIndex}`}>{plainText}</span>
                        );
                        tokenIndex += 1;
                    }
                }

                segments.push(
                    <strong key={`bold-${lineIndex}-${tokenIndex}`}>{matchText}</strong>
                );
                tokenIndex += 1;
                lastIndex = matchStart + match[0].length;
            }

            if (lastIndex < processedLine.length) {
                const remainingText = processedLine.slice(lastIndex);
                segments.push(
                    <span key={`text-${lineIndex}-${tokenIndex}`}>{remainingText}</span>
                );
            }

            if (segments.length === 0) {
                segments.push(<span key={`text-${lineIndex}-0`}>{processedLine || '\u00a0'}</span>);
            }

            return (
                <React.Fragment key={`line-${lineIndex}`}>
                    {isBulletPoint && <span className="bullet-point">• </span>}
                    {segments}
                    {lineIndex < lines.length - 1 ? <br /> : null}
                </React.Fragment>
            );
        });
    };

    // Only record video for Speech Based questions (not for coding or system design)
    const shouldRecordVideo = useMemo(() => {
        if (isCodingQuestion || isSystemDesignQuestion) return false;
        return isAnswering;
    }, [isCodingQuestion, isSystemDesignQuestion, isAnswering]);

    const handleVideoReady = useCallback(() => {
        setVideoReady(true);
        setVideoError(null);
    }, []);

    const handleVideoError = useCallback((error) => {
        console.error('Camera error:', error);
        setVideoError(error);
    }, []);

    const handleVideoStatusChange = useCallback((status) => {
        setVideoStatus(status);
    }, []);

    const stopVideoSegment = useCallback(async () => {
        if (!videoRecorderRef.current) {
            return null;
        }
        try {
            return await videoRecorderRef.current.stopAndGetBlob();
        } catch (error) {
            console.error('Failed to stop video recording:', error);
            setVideoError(error);
            return null;
        }
    }, []);

    const startVideoSegment = useCallback(async () => {
        if (!videoRecorderRef.current || !videoRecorderRef.current.isReady()) {
            return;
        }
        if (videoRecorderRef.current.isRecording()) {
            return;
        }
        try {
            await videoRecorderRef.current.startNewSegment();
        } catch (error) {
            console.error('Failed to start video recording:', error);
            setVideoError(error);
        }
    }, []);

    const captureVideoClip = useCallback(async () => {
        if (!videoReady || !videoRecorderRef.current) {
            return null;
        }
        setIsVideoUploading(true);
        try {
            return await stopVideoSegment();
        } finally {
            setIsVideoUploading(false);
        }
    }, [stopVideoSegment, videoReady]);

    useEffect(() => {
        if (!videoReady || !shouldRecordVideo || isComplete) {
            return;
        }

        let didCancel = false;

        const ensureRecording = async () => {
            if (didCancel) {
                return;
            }
            await startVideoSegment();
        };

        ensureRecording();

        return () => {
            didCancel = true;
        };
    }, [questionNumber, videoReady, shouldRecordVideo, startVideoSegment, isComplete]);

    useEffect(() => {
        if (!isComplete) {
            return;
        }
        stopVideoSegment();
    }, [isComplete, stopVideoSegment]);

    const handleStartAnsweringWithVideo = () => {
        handleStartAnswering();
        startVideoSegment();
    };

    const showAnalyzingOverlay = isAnalyzingFinal && !isComplete;

    const videoStatusLabel = (() => {
        switch (videoStatus) {
            case 'recording':
                return 'Recording';
            case 'ready':
                return 'Ready';
            case 'requesting':
                return 'Requesting camera access…';
            case 'error':
                return 'Camera unavailable';
            default:
                return 'Idle';
        }
    })();

    const isPreInterview = questionNumber === 1 && !isAnswering;

    const clampFloatingPanelPosition = useCallback((desiredX, desiredY, panelSize) => {
        const panelWidth = panelSize?.width ?? floatingPanelRef.current?.offsetWidth ?? 0;
        const panelHeight = panelSize?.height ?? floatingPanelRef.current?.offsetHeight ?? 0;
        if (!panelWidth || !panelHeight) {
            return { x: desiredX, y: desiredY };
        }

        const MIN_VISIBLE_EDGE = 36;
        const viewportWidth = window.innerWidth || 0;
        const viewportHeight = window.innerHeight || 0;

        const minX = MIN_VISIBLE_EDGE - panelWidth;
        const maxX = Math.max(minX, viewportWidth - MIN_VISIBLE_EDGE);
        const minY = MIN_VISIBLE_EDGE - panelHeight;
        const maxY = Math.max(minY, viewportHeight - MIN_VISIBLE_EDGE);

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

        return {
            x: clamp(desiredX, minX, maxX),
            y: clamp(desiredY, minY, maxY),
        };
    }, []);

    const handleFloatingPanelPointerMove = useCallback((event) => {
        const dragState = floatingPanelDragRef.current;
        if (!dragState) {
            return;
        }

        const desiredX = event.clientX - dragState.offsetX;
        const desiredY = event.clientY - dragState.offsetY;
        setFloatingPanelPosition(clampFloatingPanelPosition(desiredX, desiredY, dragState));
    }, [clampFloatingPanelPosition]);

    const handleFloatingPanelPointerUp = useCallback(() => {
        floatingPanelDragRef.current = null;
        window.removeEventListener('pointermove', handleFloatingPanelPointerMove);
        window.removeEventListener('pointerup', handleFloatingPanelPointerUp);
    }, [handleFloatingPanelPointerMove]);

    const handleFloatingPanelPointerDown = useCallback((event) => {
        if (isPreInterview) {
            return;
        }

        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const panelRect = floatingPanelRef.current?.getBoundingClientRect();
        if (!panelRect) {
            return;
        }

        event.preventDefault();
        floatingPanelDragRef.current = {
            offsetX: event.clientX - panelRect.left,
            offsetY: event.clientY - panelRect.top,
            width: panelRect.width,
            height: panelRect.height,
        };

        window.addEventListener('pointermove', handleFloatingPanelPointerMove);
        window.addEventListener('pointerup', handleFloatingPanelPointerUp);
    }, [handleFloatingPanelPointerMove, handleFloatingPanelPointerUp, isPreInterview]);

    useEffect(() => () => {
        window.removeEventListener('pointermove', handleFloatingPanelPointerMove);
        window.removeEventListener('pointerup', handleFloatingPanelPointerUp);
    }, [handleFloatingPanelPointerMove, handleFloatingPanelPointerUp]);

    useEffect(() => {
        if (isPreInterview) {
            setFloatingPanelPosition(null);
            return;
        }

        const panelRect = floatingPanelRef.current?.getBoundingClientRect();
        if (!panelRect) {
            return;
        }

        setFloatingPanelPosition((current) => {
            if (current) {
                return clampFloatingPanelPosition(current.x, current.y, panelRect);
            }

            const defaultX = window.innerWidth - panelRect.width - 32;
            const defaultY = window.innerHeight - panelRect.height - 32;
            return clampFloatingPanelPosition(defaultX, defaultY, panelRect);
        });
    }, [clampFloatingPanelPosition, isPreInterview]);

    const videoPanelClasses = ['video-panel', isPreInterview ? 'video-panel--start' : 'video-panel--floating'];

    const floatingPanelStyle = !isPreInterview && floatingPanelPosition
        ? {
            left: `${floatingPanelPosition.x}px`,
            top: `${floatingPanelPosition.y}px`,
            right: 'auto',
            bottom: 'auto',
            cursor: floatingPanelDragRef.current ? 'grabbing' : 'grab',
        }
        : undefined;

    const ratingModal = (
        <SessionRatingModal
            isOpen={isRatingModalOpen}
            defaultRating={existingRating.rating}
            defaultComments={existingRating.comments}
            onSubmit={handleRatingSubmit}
        />
    );

    if (isComplete) {
        if (showFeedback && canViewFeedback) {
            return (
                <div className="interview-screen">
                    <FeedbackScreen
                        sessionId={sessionId}
                        preloadedFeedback={finalFeedback ? finalFeedback : null}
                    />
                    {!isRatingModalOpen && (
                        <div className="completion-actions">
                            <button
                                className="return-dashboard-button"
                                onClick={handleReturnToDashboard}
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                    {ratingModal}
                </div>
            );
        }

        return (
            <div className="interview-screen">
                <SessionCompleted
                    key="session-completed"
                    status={feedbackStatus}
                    errorMessage={feedbackError}
                    onRetry={handleRegenerateFeedback}
                    onGetFeedback={handleViewFeedback}
                    canViewFeedback={canViewFeedback}
                />
                {ratingModal}
            </div>
        );
    }

    return (
        <div className="interview-screen">
            {showAnalyzingOverlay && (
                <div className="ai-overlay" role="status" aria-live="polite">
                    <div className="ai-overlay__content ai-overlay__content--final">
                        <div className="ai-overlay__spinner" />
                        <div className="ai-overlay__text-group">
                            <p className="ai-overlay__heading">Thanks for completing the interview!</p>
                            <p className="ai-overlay__text">Please wait while the AI reviews your responses and generates personalized feedback for you</p>
                        </div>
                    </div>
                </div>
            )}
            <div className={isCodingQuestion ? "interview-content interview-content--split" : "interview-content"}>
                <div className="interview-header">
                    <div className="header-item">
                        <span className="header-icon"><FiBriefcase /></span>
                        <div className="header-text">
                            <span className="header-label">ROLE</span>
                            <span className="header-value">{displayRole}</span>
                        </div>
                    </div>
                    <div className="header-item">
                        <span className="header-icon"><FiHome /></span>
                        <div className="header-text">
                            <span className="header-label">COMPANY</span>
                            <span className="header-value">{displayCompany}</span>
                        </div>
                    </div>
                    <div className="header-item">
                        <span className="header-icon"><FiAward /></span>
                        <div className="header-text">
                            <span className="header-label">INDUSTRY</span>
                            <span className="header-value">{formattedIndustry}</span>
                        </div>
                    </div>
                    {/* Question Timer */}
                    {!isPreInterview && timeRemaining !== null && (
                        <div className={`question-timer ${timeRemaining <= 30 ? 'question-timer--warning' : ''} ${timeRemaining <= 10 ? 'question-timer--critical' : ''}`}>
                            <div className="question-timer__circle">
                                <svg viewBox="0 0 36 36" className="question-timer__svg">
                                    <path
                                        className="question-timer__bg"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        className="question-timer__progress"
                                        strokeDasharray={`${(timeRemaining / questionTimeLimitSeconds) * 100}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className="question-timer__text">{formatTime(timeRemaining)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Only show video panel for speech-based questions or during pre-interview */}
                {(isPreInterview || shouldRecordVideo) && (
                    <div
                        className={videoPanelClasses.join(' ')}
                        aria-live="polite"
                        style={!isPreInterview ? floatingPanelStyle : undefined}
                        onPointerDown={handleFloatingPanelPointerDown}
                        ref={!isPreInterview ? floatingPanelRef : undefined}
                    >
                        {isPreInterview && (
                            <div className="video-panel__header video-panel__header--compact">
                                <span className={`video-status-tag video-status-tag--${videoStatus}`}>
                                    {videoStatusLabel}
                                </span>
                            </div>
                        )}
                        <VideoRecorder
                            ref={videoRecorderRef}
                            onReady={handleVideoReady}
                            onError={handleVideoError}
                            onStatusChange={handleVideoStatusChange}
                            muted
                            showStatusText={false}
                        />
                        {isVideoUploading && (
                            <p className="video-panel__hint">Uploading your response video…</p>
                        )}
                        {videoError && (
                            <p className="video-panel__error" role="alert">Camera access failed. Please allow camera permissions and refresh.</p>
                        )}
                    </div>
                )}

                <div className={columnsClass}>
                    <div className={questionColumnClass}>
                        {!shouldHideQuestionContent && (
                            <>
                                {renderSkillsSection(isCodingQuestion)}

                                <div className={questionCardClasses.join(' ')}>
                                    <p className="question-number">Question {questionNumber}</p>
                                    <h2 className="question-text">{renderQuestionText(question?.text)}</h2>
                                    {isSqlQuestion ? (
                                        <p className="question-note" role="note">
                                            Note : Create your own tables, insert your own records, and perform the necessary operations to solve this query.
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </div>

                    {isCodingQuestion ? (
                        <div className="coding-column coding-column--workspace">
                            <CodingWorkspace
                                key={`${sessionId}-${question?.id ?? questionNumber}`}
                                onSubmit={handleSubmitCoding}
                                isSubmitting={isLoading}
                                initialCode={codingInitialCode}
                                defaultLanguage={codingDefaultLanguage || 'python'}
                                supportedLanguages={codingSupportedLanguages}
                                addToast={addToast}
                                enforceSqlOnly={isSqlQuestion}
                            />
                        </div>
                    ) : isSystemDesignQuestion ? (
                        questionNumber === 1 && !isAnswering ? (
                            <button className="start-answering-button" onClick={handleStartAnsweringWithVideo}>
                                Start Interview
                            </button>
                        ) : (
                            <div className="system-design-answer-card system-design-answer-card--compact">
                                <div className="system-design-answer-card__actions">
                                    <button type="button" onClick={() => setIsSystemDesignModalOpen(true)}>
                                        Open Design Canvas
                                    </button>
                                    <button
                                        type="button"
                                        className="system-design-submit-btn"
                                        onClick={handleSubmitAnswer}
                                        disabled={!hasValidDiagram || isLoading}
                                    >
                                        {isLoading ? 'Submitting...' : 'Submit Design'}
                                    </button>
                                </div>
                                {systemDesignError && (
                                    <p className="system-design-error" role="alert">{systemDesignError}</p>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="answering-container">
                            {questionNumber === 1 && !isAnswering ? (
                                <button className="start-answering-button" onClick={handleStartAnsweringWithVideo}>
                                    Start Interview
                                </button>
                            ) : (
                                <>
                                    <div className="answer-header">Your answer </div>
                                    <textarea
                                        className="answer-textarea"
                                        value={answer}
                                        onChange={(event) => {
                                            setAnswer(event.target.value);
                                            if (answerError) {
                                                setAnswerError('');
                                            }
                                        }}
                                        aria-invalid={answerError ? 'true' : 'false'}
                                        placeholder="Type your answer here"
                                        ref={answerInputRef}
                                    />
                                    {answerError && (
                                        <p className="answer-error" role="alert">{answerError}</p>
                                    )}
                                    <div className="answer-controls">
                                        <button
                                            type="button"
                                            className={`mic-button ${isRecording ? 'listening' : ''}`}
                                            onClick={handleMicClick}
                                        >
                                            {isRecording ? 'Stop recording' : 'Start recording'}
                                        </button>
                                        <button
                                            type="button"
                                            className="submit-answer-button"
                                            onClick={handleSubmitAnswer}
                                            disabled={isLoading || isVideoUploading || !trimmedAnswer}
                                        >
                                            {isLoading || isVideoUploading ? 'Submitting…' : 'Submit answer'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {isSystemDesignModalOpen && (
                <div className="system-design-modal-overlay system-design-modal-overlay--full">
                    <div className="system-design-canvas-modal system-design-canvas-modal--fullscreen">
                        <button
                            type="button"
                            className="system-design-canvas-modal__close"
                            onClick={() => setIsSystemDesignModalOpen(false)}
                            aria-label="Close canvas"
                        >
                            ✕
                        </button>
                        <SystemDesignCanvas
                            initialDiagram={systemDesignDiagram}
                            onDiagramChange={(diagram) => {
                                setSystemDesignDiagram(diagram);
                                setSystemDesignError('');
                            }}
                        />
                    </div>
                </div>
            )}

            {ratingModal}
        </div>
    );
}

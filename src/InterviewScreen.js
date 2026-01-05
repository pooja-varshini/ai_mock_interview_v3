import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FiBriefcase, FiHome, FiZap, FiAward, FiTrash2 } from 'react-icons/fi';
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
    const [hasInterviewStarted, setHasInterviewStarted] = useState(false);
    const [isAnswering, setIsAnswering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
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
    const [isNoAnsweredQuestions, setIsNoAnsweredQuestions] = useState(false);
    const pollingRef = useRef(null);
    const toastTimerRef = useRef(null);
    const videoRecorderRef = useRef(null);
    const [videoStatus, setVideoStatus] = useState('idle');
    const [videoReady, setVideoReady] = useState(false);
    const [videoError, setVideoError] = useState(null);
    const [faceDetected, setFaceDetected] = useState(false);
    const [isVideoUploading, setIsVideoUploading] = useState(false);
    const [microphoneReady, setMicrophoneReady] = useState(false);
    const [microphoneError, setMicrophoneError] = useState(null);
    const [floatingPanelPosition, setFloatingPanelPosition] = useState(null);
    const floatingPanelDragRef = useRef(null);
    const floatingPanelRef = useRef(null);
    const [isSystemDesignModalOpen, setIsSystemDesignModalOpen] = useState(false);
    const [systemDesignDiagram, setSystemDesignDiagram] = useState('');
    const [systemDesignError, setSystemDesignError] = useState('');
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [timerResetToken, setTimerResetToken] = useState(0);
    const [hasTimeExpired, setHasTimeExpired] = useState(false);
    const timerRef = useRef(null);
    const timerDeadlineRef = useRef(null);
    const autoSubmitTriggeredRef = useRef(false);
    const microphoneRequestRef = useRef(false);
    const [recordingAttempts, setRecordingAttempts] = useState(0);
    const [savedRecording, setSavedRecording] = useState(null);
    const [isRecordingActive, setIsRecordingActive] = useState(false);
    const MAX_RECORDING_ATTEMPTS = 3;
    const recordingAttemptsRef = useRef(recordingAttempts);
    const savedRecordingRef = useRef(savedRecording);
    const savedTranscriptRef = useRef(null);
    const [audioTrackStatus, setAudioTrackStatus] = useState('active'); // 'active', 'muted', 'ended'
    const audioStreamRef = useRef(null);
    const audioMonitorIntervalRef = useRef(null);

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
            const isNoAnswers = typeof normalizedError === 'string' && normalizedError.toLowerCase().includes('no answered questions found');

            setFeedbackStatus(normalizedStatus);
            setFeedbackError(normalizedError);
            setIsNoAnsweredQuestions(isNoAnswers);

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
                    const fallbackError = 'We hit a snag while preparing your report. Please try regenerating.';
                setFeedbackError(fallbackError);
                setIsNoAnsweredQuestions(fallbackError.toLowerCase().includes('no answered questions found'));
                }
            }
        } catch (err) {
            console.error('Failed to fetch feedback status', err);
            clearFeedbackPolling();
            setFeedbackStatus('failed');
            const statusError = 'We could not verify the feedback status. Please regenerate the report.';
            setFeedbackError(statusError);
            setIsNoAnsweredQuestions(statusError.toLowerCase().includes('no answered questions found'));
            setIsAnalyzingFinal(false);
            setIsComplete(true);
            setCanViewFeedback(true);
        }
    }, [sessionId, clearFeedbackPolling]);

    const beginFeedbackPolling = useCallback(() => {
        setFeedbackStatus('pending');
        setFeedbackError(null);
        setIsNoAnsweredQuestions(false);
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
    const stopSpeechRecognitionRef = useRef(null);
    const answerInputRef = useRef(null);
    const answerRef = useRef('');

    const startSpeechRecognition = useCallback(() => {
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
                        }
                    }, 100);
                } else {
                    console.log('🛑 Manual stop detected, not restarting');
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('❌ Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied. Please allow microphone access and try again.');
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
    }, []);

    const stopSpeechRecognition = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.manualStop = true; // Set a flag to prevent auto-restarting
            recognitionRef.current.stop();
        }
    }, []);

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
    const extractDifficulty = useCallback(() => {
        const raw = question?.raw;
        const candidates = [
            raw?.difficulty,
            raw?.difficulty_level,
            raw?.level,
            question?.difficulty,
        ];
        const value = candidates.find((entry) => entry != null);
        if (!value) {
            return 'medium';
        }
        const normalized = value.toString().trim().toLowerCase();
        if (normalized === 'difficult') {
            return 'hard';
        }
        if (['easy', 'medium', 'hard'].includes(normalized)) {
            return normalized;
        }
        return 'medium';
    }, [question]);

    const rawQuestionType = question?.raw?.question_type ?? question?.type ?? '';
    const normalizedQuestionType = typeof rawQuestionType === 'string' ? rawQuestionType.trim().toLowerCase() : '';
    const isSqlQuestion = isCodingQuestion && normalizedQuestionType.includes('sql');
    const isSpeechQuestion = normalizedQuestionType.includes('speech');
    const requiresMicrophone = isSpeechQuestion;
    const normalizedDifficulty = useMemo(() => extractDifficulty(), [extractDifficulty]);
    
    const startAudioMonitoring = useCallback(() => {
        if (!requiresMicrophone || audioMonitorIntervalRef.current) {
            return;
        }

        const checkAudioStatus = () => {
            if (!audioStreamRef.current) {
                setAudioTrackStatus('ended');
                return;
            }

            const audioTracks = audioStreamRef.current.getAudioTracks();
            if (audioTracks.length === 0) {
                setAudioTrackStatus('ended');
                return;
            }

            const track = audioTracks[0];
            if (track.readyState === 'ended') {
                setAudioTrackStatus('ended');
            } else if (track.muted || !track.enabled) {
                setAudioTrackStatus('muted');
            } else {
                setAudioTrackStatus('active');
            }
        };

        checkAudioStatus();
        audioMonitorIntervalRef.current = setInterval(checkAudioStatus, 500);
    }, [requiresMicrophone]);

    const stopAudioMonitoring = useCallback(() => {
        if (audioMonitorIntervalRef.current) {
            clearInterval(audioMonitorIntervalRef.current);
            audioMonitorIntervalRef.current = null;
        }
        setAudioTrackStatus('active');
    }, []);
    
    // Timer duration based on question type and difficulty
    const questionTimeLimitSeconds = useMemo(() => {
        const difficulty = normalizedDifficulty;
        const speechDurations = {
            easy: 2 * 60,
            medium: 3 * 60,
            hard: 5 * 60,
        };
        const codingDurations = {
            easy: 5 * 60,
            medium: 10 * 60,
            hard: 15 * 60,
        };

        if (isSpeechQuestion) {
            return speechDurations[difficulty] ?? speechDurations.medium;
        }
        if (isCodingQuestion || isSystemDesignQuestion) {
            return codingDurations[difficulty] ?? codingDurations.medium;
        }
        return 2 * 60; // Default for other question types
    }, [isSpeechQuestion, isCodingQuestion, isSystemDesignQuestion, normalizedDifficulty]);

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
        const normalizedFirst = normalizeQuestion(firstQuestion);
        setQuestion(normalizedFirst);
        const startingNumber = initialQuestionNumber || 1;
        setQuestionNumber(startingNumber);
        setMaxQuestions(initialMaxQuestions ?? null);
        setAnswerError('');
        const started = startingNumber > 1;
        setHasInterviewStarted(started);
        setIsAnswering(started);
    }, [firstQuestion, initialQuestionNumber, initialMaxQuestions]);

    const ensureQuestionTimerRunning = useCallback(() => {
        const hasTimer = typeof questionTimeLimitSeconds === 'number' && questionTimeLimitSeconds > 0;
        if (!hasTimer || timerDeadlineRef.current) {
            return;
        }
        timerDeadlineRef.current = Date.now() + questionTimeLimitSeconds * 1000;
        setTimeRemaining(questionTimeLimitSeconds);
        setTimerResetToken((token) => token + 1);
    }, [questionTimeLimitSeconds]);

    useEffect(() => {
        if (isCodingQuestion) {
            stopSpeechRecognition();
            setAnswer('');
        } else {
            setAnswer('');
            setCodingSubmission(null);
            setIsAnalyzingFinal(false);
            setAnswerError('');
        }
        setSystemDesignDiagram('');
        setSystemDesignError('');
        setIsSystemDesignModalOpen(false);
        // Reset recording state for new question
        setRecordingAttempts(0);
        setSavedRecording(null);
        setIsRecordingActive(false);
        // Reset timer for new question (timer starts only when recording begins)
        timerDeadlineRef.current = null;
        const hasTimer = typeof questionTimeLimitSeconds === 'number' && questionTimeLimitSeconds > 0;
        setTimeRemaining(hasTimer ? questionTimeLimitSeconds : null);
        autoSubmitTriggeredRef.current = false;
        setHasTimeExpired(false);
        setIsAnswering(hasInterviewStarted);
    }, [isCodingQuestion, questionNumber, questionTimeLimitSeconds, hasInterviewStarted]);

    // Refs to hold handlers/state for timeouts
    const handleSubmitAnswerRef = useRef(null);
    const handleStopRecordingRef = useRef(null);
    
    // Timer effect - runs against deadline so tab switches don't pause countdown
    useEffect(() => {
        recordingAttemptsRef.current = recordingAttempts;
    }, [recordingAttempts]);

    useEffect(() => {
        savedRecordingRef.current = savedRecording;
    }, [savedRecording]);

    useEffect(() => {
        if (!savedTranscriptRef.current) {
            return;
        }
        const latest = savedRecording?.transcript || '';
        if (savedTranscriptRef.current.innerText !== latest) {
            savedTranscriptRef.current.innerText = latest;
        }
    }, [savedRecording]);

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
                setHasTimeExpired(true);

                const attemptCount = recordingAttemptsRef.current;
                const isFinalAttempt = attemptCount >= MAX_RECORDING_ATTEMPTS;

                let stopPromise = null;
                if (isRecordingActive && handleStopRecordingRef.current) {
                    stopPromise = handleStopRecordingRef.current();
                }

                if (isFinalAttempt && handleSubmitAnswerRef.current) {
                    Promise.resolve(stopPromise)
                        .then((recording) => recording || savedRecordingRef.current)
                        .then((recordingToSubmit) => {
                            if (!recordingToSubmit) {
                                return;
                            }
                            if (!autoSubmitTriggeredRef.current) {
                                autoSubmitTriggeredRef.current = true;
                                handleSubmitAnswerRef.current(true, recordingToSubmit);
                            }
                        })
                        .catch((error) => {
                            console.error('Failed to auto-submit final attempt:', error);
                        });
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
    }, [questionNumber, isComplete, timerResetToken, isRecordingActive]);

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

    useEffect(() => {
        if (!isSpeechQuestion && isAnswering) {
            ensureQuestionTimerRunning();
        }
    }, [isSpeechQuestion, isAnswering, ensureQuestionTimerRunning]);

    const handleStartAnswering = () => {
        if (!hasInterviewStarted) {
            setHasInterviewStarted(true);
        }
        setIsAnswering(true);
        if (!isSpeechQuestion) {
            ensureQuestionTimerRunning();
        }
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

    const handleStartRecording = useCallback(async () => {
        if (recordingAttempts >= MAX_RECORDING_ATTEMPTS || isLoading || isComplete) {
            return;
        }
        
        // Reset timer for this recording attempt
        const hasTimer = typeof questionTimeLimitSeconds === 'number' && questionTimeLimitSeconds > 0;
        if (hasTimer) {
            timerDeadlineRef.current = Date.now() + questionTimeLimitSeconds * 1000;
            setTimeRemaining(questionTimeLimitSeconds);
            setTimerResetToken((token) => token + 1);
        }
        setHasTimeExpired(false);
        autoSubmitTriggeredRef.current = false;
        
        // Clear any previous recording
        setSavedRecording(null);
        setAnswer('');
        setAnswerError('');
        
        // Start video and speech recording
        setIsRecordingActive(true);
        setRecordingAttempts(prev => prev + 1);
        await startVideoSegment();
        startSpeechRecognition();
        startAudioMonitoring();
    }, [
        recordingAttempts,
        MAX_RECORDING_ATTEMPTS,
        isLoading,
        isComplete,
        questionTimeLimitSeconds,
        startVideoSegment,
        startSpeechRecognition,
        startAudioMonitoring,
    ]);

    const handleStopRecording = useCallback(async () => {
        if (!isRecordingActive) {
            return null;
        }
        
        // Stop speech recognition
        stopSpeechRecognition();
        
        // Capture video
        const videoBlob = await captureVideoClip();
        
        // Save the recording
        const recording = {
            transcript: answer,
            videoBlob: videoBlob,
            timestamp: Date.now()
        };
        setSavedRecording(recording);
        
        setIsRecordingActive(false);
        
        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        timerDeadlineRef.current = null;
        stopAudioMonitoring();
        return recording;
    }, [isRecordingActive, stopSpeechRecognition, captureVideoClip, answer, stopAudioMonitoring]);

    const handleDeleteRecording = useCallback(() => {
        setSavedRecording(null);
        setAnswer('');
        setAnswerError('');
    }, []);

    const handleReRecord = useCallback(async () => {
        handleDeleteRecording();
        await handleStartRecording();
    }, [handleDeleteRecording, handleStartRecording]);

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
            setIsNoAnsweredQuestions(false);
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
            setIsNoAnsweredQuestions(message.toLowerCase().includes('no answered questions found'));
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

    useEffect(() => {
        stopSpeechRecognitionRef.current = stopSpeechRecognition;
        return () => {
            stopSpeechRecognitionRef.current = null;
        };
    }, [stopSpeechRecognition]);

    // Auto-stop recording when timer expires
    useEffect(() => {
        if (hasTimeExpired && isRecordingActive) {
            handleStopRecording();
        }
    }, [hasTimeExpired, isRecordingActive, handleStopRecording]);

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

    const handleSubmitAnswer = async (isAutoSubmit = false, recordingOverride = null) => {
        // For speech questions, validate saved recording exists
        const effectiveRecording = recordingOverride || savedRecording;
        if (isSpeechQuestion && !effectiveRecording) {
            if (!isAutoSubmit) {
                setAnswerError('Please record your answer before submitting.');
            }
            return;
        }

        // For manual submit, validate answers
        if (!isAutoSubmit) {
            if (isSystemDesignQuestion) {
                if (!hasValidDiagram) {
                    setSystemDesignError('Please add at least one component to your design before submitting.');
                    return;
                }
            }

            if (!trimmedAnswer && !isSystemDesignQuestion && !isSpeechQuestion) {
                setAnswerError('Answer cannot be empty');
                if (answerInputRef.current) {
                    answerInputRef.current.focus({ preventScroll: true });
                }
                return;
            }
        }

        setAnswerError('');
        const isCurrentQuestionFinal = isFinalQuestion;
        setIsLoading(true);
        stopSpeechRecognition();
        setIsAnalyzingFinal(isFinalQuestion);

        try {
            const formData = new FormData();
            
            // Use saved recording transcript for speech questions
            const answerPayload = isSystemDesignQuestion && systemDesignDiagram
                ? systemDesignDiagram
                : (isSpeechQuestion && effectiveRecording ? effectiveRecording.transcript : trimmedAnswer);
            
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
            if (isCurrentQuestionFinal) {
                formData.append('is_final', 'true');
            }
            
            // Use saved video blob for speech-based questions
            if (isSpeechQuestion && effectiveRecording?.videoBlob) {
                const extension = effectiveRecording.videoBlob.type === 'video/mp4' ? 'mp4' : 'webm';
                formData.append('response_video', effectiveRecording.videoBlob, `session-${sessionId}-q${questionNumber}.${extension}`);
            }
            
            await postAnswer(formData);
        } catch (error) {
            console.error('Error submitting answer:', error);
            const message = error?.response?.data?.detail && !/^\d{3}/.test(error.response.data.detail)
                ? error.response.data.detail
                : 'We couldn\'t generate your feedback right now. Please regenerate the report.';
            if (isCurrentQuestionFinal) {
                setFeedbackError(message);
                setFeedbackStatus('failed');
                setIsNoAnsweredQuestions(message.toLowerCase().includes('no answered questions found'));
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
            if (!isCurrentQuestionFinal) {
                setIsAnalyzingFinal(false);
            }
        }
    };

    // Keep ref updated for auto-submit timer
    handleSubmitAnswerRef.current = handleSubmitAnswer;

    useEffect(() => {
        handleStopRecordingRef.current = handleStopRecording;
        return () => {
            handleStopRecordingRef.current = null;
        };
    }, [handleStopRecording]);

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
                setIsNoAnsweredQuestions(message.toLowerCase().includes('no answered questions found'));
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

    const shouldHideQuestionContent = questionNumber === 1 && !isAnswering;

    const questionCardClasses = ["question-card"];
    if (isCodingQuestion) {
        questionCardClasses.push("question-card--coding");
    }

    const isFinalQuestion = useMemo(() => {
        return typeof maxQuestions === 'number' ? questionNumber >= maxQuestions : false;
    }, [maxQuestions, questionNumber]);

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

    // Show video panel for all speech-based questions (pre-interview or during answers)
    const shouldShowVideoPanel = useMemo(() => {
        if (isCodingQuestion || isSystemDesignQuestion) {
            return false;
        }
        return true;
    }, [isCodingQuestion, isSystemDesignQuestion]);

    const hasRemainingRecordingAttempts = recordingAttempts < MAX_RECORDING_ATTEMPTS;

    const handleVideoReady = useCallback(() => {
        setVideoReady(true);
        setVideoError(null);
    }, []);

    const handleVideoError = useCallback((error) => {
        console.error('Camera error:', error);
        setVideoReady(false);
        setVideoError(error);
    }, []);

    const handleVideoStatusChange = useCallback((status) => {
        setVideoStatus(status);
    }, []);

    const handleFaceDetected = useCallback((detected) => {
        setFaceDetected(detected);
    }, []);

    const handleTranscriptEdit = useCallback((event) => {
        const newTranscript = event.currentTarget.innerText;
        setSavedRecording((previous) => {
            if (!previous) {
                return previous;
            }
            return {
                ...previous,
                transcript: newTranscript,
            };
        });
        setAnswer(newTranscript);
    }, []);


    // Video recording is now manually controlled via handleStartRecording/handleStopRecording

    const handleStartInterview = () => {
        handleStartAnswering();
    };

    const requestMicrophoneAccess = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setMicrophoneReady(false);
            setMicrophoneError(new Error('Microphone is not supported in this browser.'));
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            setMicrophoneReady(true);
            setMicrophoneError(null);
        } catch (error) {
            console.error('Microphone permission error:', error);
            setMicrophoneReady(false);
            setMicrophoneError(error);
        }
    }, []);

    useEffect(() => {
        if (!requiresMicrophone) {
            setMicrophoneReady(true);
            setMicrophoneError(null);
            microphoneRequestRef.current = false;
            return;
        }
        if (microphoneRequestRef.current) {
            // already attempted; allow manual retry via UI by clearing ref elsewhere if needed
            return;
        }
        microphoneRequestRef.current = true;
        requestMicrophoneAccess();
    }, [requiresMicrophone, requestMicrophoneAccess, questionNumber]);

    useEffect(() => {
        if (!requiresMicrophone) {
            return;
        }
        if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
            return;
        }

        let isActive = true;
        let cleanupListener = null;

        const syncFromPermissionState = (state) => {
            if (!isActive) {
                return;
            }
            if (state === 'granted') {
                setMicrophoneReady(true);
                setMicrophoneError(null);
            } else {
                setMicrophoneReady(false);
                setMicrophoneError(new Error('Microphone access is required to begin.'));
            }
        };

        navigator.permissions
            .query({ name: 'microphone' })
            .then((status) => {
                if (!isActive) {
                    return;
                }

                const handlePermissionChange = () => syncFromPermissionState(status.state);
                syncFromPermissionState(status.state);

                if (typeof status.addEventListener === 'function') {
                    status.addEventListener('change', handlePermissionChange);
                    cleanupListener = () => status.removeEventListener('change', handlePermissionChange);
                } else if ('onchange' in status) {
                    status.onchange = handlePermissionChange;
                    cleanupListener = () => {
                        if ('onchange' in status) {
                            status.onchange = null;
                        }
                    };
                }
            })
            .catch(() => {
                // Permissions API not supported for microphone; rely on direct getUserMedia request.
            });

    return () => {
            isActive = false;
            if (typeof cleanupListener === 'function') {
                cleanupListener();
            }
        };
    }, [requiresMicrophone]);

    const missingDevices = useMemo(() => {
        const missing = [];
        if (!videoReady || videoError) {
            missing.push('camera');
        }
        if (requiresMicrophone && (!microphoneReady || microphoneError)) {
            missing.push('microphone');
        }
        return missing;
    }, [videoReady, videoError, requiresMicrophone, microphoneReady, microphoneError]);

    const showAnalyzingOverlay = isAnalyzingFinal && !isComplete;
    const canStartInterview = videoReady && microphoneReady && faceDetected;
    const deviceWarning = !videoReady
        ? 'Please allow camera access to continue'
        : !microphoneReady
            ? 'Please allow microphone access to continue'
            : !faceDetected
                ? 'Please position your face in the camera view'
                : '';

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

    const isPreInterview = questionNumber === 1 && !hasInterviewStarted;

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

    const videoPanelClasses = ['video-panel', 'video-panel--floating'];
    if (isPreInterview) {
        videoPanelClasses.push('video-panel--start');
    }

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
                    isNoAnsweredQuestions={isNoAnsweredQuestions}
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

                {/* Show video panel for speech-based questions or during pre-interview */}
                {(isPreInterview || shouldShowVideoPanel) && (
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
                            onFaceDetected={handleFaceDetected}
                            muted
                            showStatusText={false}
                        />
                        {isRecordingActive && !faceDetected && (
                            <p className="video-panel__warning" role="alert">
                                Face not detected. Please stay in frame — this may impact your feedback score.
                            </p>
                        )}
                        {isVideoUploading && (
                            <p className="video-panel__hint">Uploading your response video…</p>
                        )}
                        {videoError && (
                            <p className="video-panel__error" role="alert">Camera access failed. Please allow camera permissions and refresh.</p>
                        )}
                    </div>
                )}

                {isPreInterview ? (
                    <div className="start-interview-stage">
                        <button
                            className="start-answering-button"
                            onClick={handleStartInterview}
                            disabled={!canStartInterview}
                        >
                            Start Interview
                        </button>
                        {!canStartInterview && (
                            <p className="camera-warning">{deviceWarning}</p>
                        )}
                    </div>
                ) : (
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
                    ) : (
                        <div className="answering-container">
                            <div className="recording-status-header">
                                <span className="recording-attempts-badge">
                                    Attempt {recordingAttempts} of {MAX_RECORDING_ATTEMPTS}
                                </span>
                                {timeRemaining !== null && (
                                    <span className="recording-timer">
                                        {formatTime(timeRemaining)}
                                    </span>
                                )}
                            </div>

                            {!savedRecording && !isRecordingActive && (
                                <div className="recording-prompt">
                                    <p className="recording-prompt-text">
                                        Click "Start Recording" to record your answer with video and audio.
                                    </p>
                                </div>
                            )}

                            {isRecordingActive && (
                                <div className="recording-active-indicator">
                                    <div className="recording-status-chip">
                                        <div className="recording-pulse"></div>
                                        <span className="recording-status-text">Recording</span>
                                    </div>
                                    <div className="answer-preview">
                                        <div className="answer-preview-content">
                                            {answer || 'Speak to see your transcript here...'}
                                        </div>
                                    </div>
                                    {audioTrackStatus === 'muted' && (
                                        <p className="recording-audio-warning" role="alert">
                                            Microphone is muted. Please unmute to record audio.
                                        </p>
                                    )}
                                    {audioTrackStatus === 'ended' && (
                                        <p className="recording-audio-warning" role="alert">
                                            Microphone not working. Please check your microphone settings.
                                        </p>
                                    )}
                                </div>
                            )}

                            {savedRecording && !isRecordingActive && (
                                <div className="saved-recording-preview">
                                    <div className="saved-recording-header">
                                        <span className="saved-recording-label">✓ Recording Saved</span>
                                        <button
                                            type="button"
                                            className="delete-recording-button"
                                            onClick={handleDeleteRecording}
                                            title="Delete recording"
                                            disabled={!hasRemainingRecordingAttempts}
                                        >
                                            <FiTrash2 aria-hidden="true" />
                                        </button>
                                    </div>
                                    <div
                                        className="saved-recording-transcript"
                                        contentEditable
                                        suppressContentEditableWarning
                                        role="textbox"
                                        aria-label="Edit transcript before submitting"
                                        data-placeholder="No transcript available"
                                        ref={savedTranscriptRef}
                                        onInput={handleTranscriptEdit}
                                    />
                                </div>
                            )}

                            {answerError && (
                                <p className="answer-error" role="alert">{answerError}</p>
                            )}

                            <div className="recording-controls">
                                {!isRecordingActive && !savedRecording && (
                                    <button
                                        type="button"
                                        className="start-recording-button"
                                        onClick={handleStartRecording}
                                        disabled={recordingAttempts >= MAX_RECORDING_ATTEMPTS || isLoading || !faceDetected}
                                    >
                                        {recordingAttempts === 0 ? 'Start Recording' : 'Start Recording'}
                                    </button>
                                )}

                                {isRecordingActive && (
                                    <button
                                        type="button"
                                        className="stop-recording-button"
                                        onClick={handleStopRecording}
                                    >
                                        Stop Recording
                                    </button>
                                )}

                                {savedRecording && !isRecordingActive && recordingAttempts < MAX_RECORDING_ATTEMPTS && (
                                    <button
                                        type="button"
                                        className="re-record-button"
                                        onClick={handleReRecord}
                                        disabled={isLoading || !faceDetected}
                                    >
                                        Re-record
                                    </button>
                                )}

                                {savedRecording && (
                                    <button
                                        type="button"
                                        className="submit-answer-button"
                                        onClick={handleSubmitAnswer}
                                        disabled={isLoading || isVideoUploading}
                                    >
                                        {isLoading || isVideoUploading ? 'Submitting…' : 'Submit Answer'}
                                    </button>
                                )}
                            </div>

                            {recordingAttempts >= MAX_RECORDING_ATTEMPTS && !savedRecording && (
                                <p className="recording-limit-warning">
                                    You've used all {MAX_RECORDING_ATTEMPTS} recording attempts. Please submit your last recording.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                )}
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

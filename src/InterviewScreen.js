import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiBriefcase, FiHome, FiZap, FiAward } from 'react-icons/fi';
import { interviewApi, fetchSessionRating, submitSessionRating } from './api';
import SessionCompleted from './SessionCompleted';
import FeedbackScreen from './FeedbackScreen';
import './InterviewScreen.css';
import CodingWorkspace from './CodingWorkspace';
import SessionRatingModal from './SessionRatingModal';

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
    const [isAnswering, setIsAnswering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isAnalyzingFinal, setIsAnalyzingFinal] = useState(false);
    const [answer, setAnswer] = useState('');
    const [finalFeedback, setFinalFeedback] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [answerError, setAnswerError] = useState('');
    const [, setCodingSubmission] = useState(null);
    const [maxQuestions, setMaxQuestions] = useState(initialMaxQuestions);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [existingRating, setExistingRating] = useState({ rating: 0, comments: '' });
    const [ratingLoaded, setRatingLoaded] = useState(false);

    // Refs for speech recognition and text area focus management
    const recognitionRef = useRef(null);
    const answerInputRef = useRef(null);
    const answerRef = useRef('');

    const isCodingQuestion = question?.type === 'coding';
    const rawQuestionType = question?.raw?.question_type ?? question?.type ?? '';
    const normalizedQuestionType = typeof rawQuestionType === 'string' ? rawQuestionType.trim().toLowerCase() : '';
    const isSqlQuestion = isCodingQuestion && normalizedQuestionType.includes('sql');

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
    }, [isCodingQuestion, questionNumber]);

    useEffect(() => {
        if (isAnswering && !isCodingQuestion && answerInputRef.current) {
            answerInputRef.current.focus({ preventScroll: true });
        }
    }, [isAnswering, isCodingQuestion]);

    useEffect(() => {
        answerRef.current = answer;
    }, [answer]);

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

        if (isComplete) {
            loadExistingRating();
        }
    }, [isComplete, sessionId, interviewData?.studentEmail]);

    useEffect(() => {
        if (isComplete) {
            if (existingRating.rating > 0) {
                setIsRatingModalOpen(false);
            } else {
                setIsRatingModalOpen(true);
            }
        }
    }, [isComplete, ratingLoaded, existingRating.rating]);

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
        } catch (error) {
            console.error('Failed to submit session rating:', error);
            const message = error?.response?.data?.detail || 'Unable to submit rating. Please try again later.';
            addToast(message, 'error');
            throw new Error(message);
        }
    };

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

    const postAnswer = async (params) => {
        const response = await interviewApi.post(`/interview/${sessionId}/answer`, params);
        const {
            next_question,
            next_question_meta,
            acknowledgment,
            completed,
            feedback,
            question_number,
            current_max_questions,
        } = response.data;

        if (typeof current_max_questions === 'number') {
            setMaxQuestions(current_max_questions);
        }

        if (completed) {
            setIsAnalyzingFinal(true);
            if (acknowledgment) {
                addToast(acknowledgment);
            }

            const formattedFeedback = feedback
                ? (typeof feedback === 'string' ? { full_feedback: feedback } : feedback)
                : null;

            setFinalFeedback(formattedFeedback);
            setShowFeedback(false);
            setIsAnswering(false);
            setAnswer('');
            setCodingSubmission(null);
            setAnswerError('');
            setTimeout(() => {
                setIsComplete(true);
                setIsAnalyzingFinal(false);
            }, 300);
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
            addToast(acknowledgment);
        }

        setIsAnalyzingFinal(false);
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim()) {
            setAnswerError('Answer cannot be empty');
            if (answerInputRef.current) {
                answerInputRef.current.focus({ preventScroll: true });
            }
            return;
        }

        setAnswerError('');
        const isFinalQuestion = typeof maxQuestions === 'number' ? questionNumber >= maxQuestions : false;

        setIsLoading(true);
        stopSpeechRecognition();
        if (isFinalQuestion) {
            setIsAnalyzingFinal(true);
        } else {
            setIsAnalyzingFinal(false);
        }

        try {
            const params = new URLSearchParams();
            params.append('answer', answer);
            if (question?.id != null) {
                params.append('question_id', String(question.id));
            }
            if (question?.type) {
                params.append('question_type', question.type);
            }
            await postAnswer(params);
        } catch (error) {
            console.error('Error submitting answer:', error);
            setAnswerError('Failed to submit answer. Please try again.');
        } finally {
            setIsLoading(false);
            if (!isFinalQuestion) {
                setIsAnalyzingFinal(false);
            }
        }
    };

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
            const params = new URLSearchParams();
            params.append('answer', submission.stdout || submission.code);
            params.append('code', submission.code);
            if (submission.stdin) {
                params.append('stdin', submission.stdin);
            }
            if (submission.stdout) {
                params.append('stdout', submission.stdout);
            }
            if (submission.stderr) {
                params.append('stderr', submission.stderr);
            }
            if (submission.internalError) {
                params.append('runtime_error', submission.internalError);
            }
            params.append('execution_success', submission.success ? 'true' : 'false');
            params.append('has_run', submission.hasRun ? 'true' : 'false');
            if (question?.id != null) {
                params.append('question_id', String(question.id));
            }
            if (question?.type) {
                params.append('question_type', question.type);
            }
            await postAnswer(params);
        } catch (error) {
            console.error('Error submitting code answer:', error);
            alert('Failed to submit your code. Please try again.');
        } finally {
            setIsLoading(false);
            if (!isFinalQuestion) {
                setIsAnalyzingFinal(false);
            }
        }
    };

    if (isComplete) {
        if (showFeedback) {
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
                    <SessionRatingModal
                        isOpen={isRatingModalOpen}
                        defaultRating={existingRating.rating}
                        defaultComments={existingRating.comments}
                        onSubmit={handleRatingSubmit}
                    />
                </div>
            );
        }

        return (
            <div className="interview-screen">
                <SessionCompleted
                    onGetFeedback={() => setShowFeedback(true)}
                />
                <SessionRatingModal
                    isOpen={isRatingModalOpen && !showFeedback}
                    defaultRating={existingRating.rating}
                    defaultComments={existingRating.comments}
                    onSubmit={handleRatingSubmit}
                />
            </div>
        );
    }

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
            ? rawText.replace(/\\n/g, '\n')
            : 'Loading question...';

        const lines = sourceText.split(/\r?\n/);

        return lines.map((line, lineIndex) => {
            const segments = [];
            const boldRegex = /\*\*(.+?)\*\*/g;
            let lastIndex = 0;
            let match;
            let tokenIndex = 0;

            // Check if line starts with "- " to convert to bullet point
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

    const showAnalyzingOverlay = isAnalyzingFinal && !isComplete;

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
                </div>

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
                    ) : (
                        <div className="answering-container">
                            {questionNumber === 1 && !isAnswering ? (
                                <button className="start-answering-button" onClick={handleStartAnswering}>
                                    Start answering
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
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Submitting…' : 'Submit answer'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

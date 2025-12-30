import React, { useState } from 'react';
import './InstructionScreen.css';
import interviewFormatLogo from './assets/logos/interview_format_logo.png';
import whatToExpectLogo from './assets/logos/what_to_expect_logo.png';
import howToRespondLogo from './assets/logos/how_respond_effectively_logo.png';
import importantGuidelinesLogo from './assets/logos/important_guidelines.png';
import whenYouAreReadyLogo from "./assets/logos/when_you're_ready.png";
import afterTheInterviewLogo from './assets/logos/after_the_interview_logo.png';

const instructions = [
  {
    title: 'Interview Format',
    icon: interviewFormatLogo,
    points: [
      'The AI interviewer will ask you one question at a time, similar to how a human interviewer would.',
      'Speak your answer out loud, and you’ll see the live transcript as you talk.',
      'After answering, you’ll have the option to re-record or edit your response if you feel it wasn’t up to the mark.',
      'Once you’re satisfied and submit your response, you’ll be redirected to the next question automatically.',
      'You only have three attempts for each response, so use them wisely.',
    ],
  },
  {
    title: 'What to Expect',
    icon: whatToExpectLogo,
    variant: 'no-bullet',
    points: [
      {
        text: 'The questions are customized to your selected company, job role, and industry (not mandatory). You will be assessed across four main areas:',
        type: 'plain-sub-list-trigger',
        subPoints: [
          {
            heading: 'Question wise analysis',
            description: 'Scores each answer with strengths, gaps, and improvement guidance along with suggested answers.'
          },
          {
            heading: 'Video-based analysis',
            description: 'Video cues are evaluated for each question as part of the question-wise analysis. You’ll get insights on confidence, clarity, expressions, and any signs of nervousness for every answer you give.'
          },
          {
            heading: 'Overall interview feedback',
            description: 'You’ll receive detailed feedback aligned with the interview type highlighting what you did well and what to work on.'
          },
          {
            heading: 'Skill-wise scoring',
            description: 'You get personalized scores for each skill required for the specific role you’re preparing for.'
          }
        ]
      }
    ],
  },
  {
    title: 'How to Respond Effectively',
    icon: howToRespondLogo,
    points: [
      'Think out loud - explain your reasoning steps, not just the final answer.',
      'Use examples or experiences wherever possible (projects, internships, or coursework).',
      'If you’re unsure about an answer, say how you’d approach finding a solution - that still earns credit.',
      'Keep responses concise but complete (2–3 minutes per question is ideal).',
      'Avoid one-word or generic answers like “Yes,” “No,” or “I don’t know.”',
    ],
  },
  {
    title: 'After the Interview',
    icon: afterTheInterviewLogo,
    points: [
      {
        text: 'Once the interview is complete, you’ll receive personalized feedback based on:',
        type: 'sub-list-trigger',
        subPoints: [
          'Each question and your corresponding response alongside the AI suggested answers.',
          'Core competency breakdown based on predefined rubrics tailored to the interview type.',
          'Personalized scoring for each relevant skill.',
        ],
      },
      { text: 'The feedback will be structured and actionable, so you can focus on specific areas of improvement.', type: 'bullet' },
    ],
  },
  {
    title: 'Important Guidelines',
    icon: importantGuidelinesLogo,
    points: [
      'Be honest and authentic — don’t copy responses from the internet.',
      'The AI records your answers to analyze and generate feedback; no personal data is shared externally.',
      'Ensure a quiet environment and a stable internet connection for best results.',
    ],
  },
  {
    title: 'When You’re Ready',
    icon: whenYouAreReadyLogo,
    points: [
      'Click “Acknowledge & Start” when you’re prepared to begin.',
      'Take a deep breath - this is a safe, learning-focused space.',
      'Good luck! You’ve got this.',
    ],
  },
];

export default function InstructionScreen({ onStart, onClose, isStarting }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, instructions.length - 1));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const currentInstruction = instructions[currentStep];
  const listClasses = ['instruction-list-modal'];
  if (currentInstruction.variant === 'no-bullet') {
    listClasses.push('instruction-list--plain');
  }

  return (
    <div className="modal-overlay">
      <div className="instruction-modal card">
        <button className="close-button" onClick={onClose}>&times;</button>
        <h1 className="instruction-title">AI Mock Interview Instructions</h1>
        <p className="instruction-intro">Welcome! Please read the following instructions carefully before you begin.</p>
        
        <div className="carousel-content">
          <h2 className="step-title">
            {currentInstruction.icon && <img src={currentInstruction.icon} alt="" className="step-icon" />}
            <span>{currentInstruction.title}</span>
          </h2>
          <ul className={listClasses.join(' ')}>
            {currentInstruction.points.map((point, index) => {
              const item = typeof point === 'string' ? { text: point, type: 'bullet' } : point;
              return (
                <li key={index} className={`instruction-item--${item.type}`}>
                  {item.text}
                  {item.subPoints && (
                    <ul
                      className={[
                        'sub-instruction-list',
                        (item.type === 'sub-list-trigger' || item.type === 'plain-sub-list-trigger')
                          ? 'sub-instruction-list--square'
                          : null,
                      ].filter(Boolean).join(' ')}
                    >
                      {item.subPoints.map((subPoint, subIndex) => (
                        <li key={subIndex}>
                          {typeof subPoint === 'string' ? (
                            subPoint
                          ) : (
                            <>
                              <span className="sub-point-heading">{subPoint.heading}</span>
                              <span className="sub-point-description">{subPoint.description}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="progress-indicator">
          {instructions.map((_, index) => (
            <div key={index} className={`progress-dot ${index === currentStep ? 'active' : ''}`}></div>
          ))}
        </div>

        <div className="navigation-buttons">
          <button onClick={handlePrev} disabled={currentStep === 0}>Previous</button>
          {currentStep < instructions.length - 1 ? (
            <button onClick={handleNext}>Next</button>
          ) : (
            <button onClick={onStart} disabled={isStarting} className="start-button-final">
              {isStarting ? 'Starting...' : 'Acknowledge & Start'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

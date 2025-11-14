import React, { useEffect, useState } from 'react';
import './SessionRatingModal.css';

export default function SessionRatingModal({
  isOpen,
  defaultRating = 0,
  defaultComments = '',
  onSubmit,
  onSkip,
}) {
  const [rating, setRating] = useState(defaultRating);
  const [comments, setComments] = useState(defaultComments);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRating(defaultRating);
      setComments(defaultComments);
      setError('');
    }
  }, [isOpen, defaultRating, defaultComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!rating) {
      setError('Please select a rating.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({ rating, comments: comments.trim() || null });
    } catch (submissionError) {
      setError(submissionError?.message || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRatingClick = (value) => {
    setRating(value);
    if (error) setError('');
  };

  const handleSkip = () => {
    if (isSubmitting) return;
    onSkip?.();
  };

  if (!isOpen) return null;

  return (
    <div className="session-rating-modal" role="dialog" aria-modal="true" aria-labelledby="session-rating-title">
      <div className="session-rating-modal__backdrop" />
      <div className="session-rating-modal__content">
        <header className="session-rating-modal__header">
          <h2 id="session-rating-title">How was this interview?</h2>
          <p className="session-rating-modal__subtitle">
            Please rate your interview experience.
          </p>
        </header>
        <form onSubmit={handleSubmit} className="session-rating-modal__form">
          <fieldset className="session-rating-modal__rating" disabled={isSubmitting}>
            <legend>Interview rating</legend>
            <div className="session-rating-modal__stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`session-rating-modal__star ${value <= rating ? 'active' : ''}`}
                  onClick={() => handleRatingClick(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label className="session-rating-modal__label" htmlFor="session-rating-comments">
            Comments (optional)
          </label>
          <textarea
            id="session-rating-comments"
            className="session-rating-modal__textarea"
            placeholder="Share any specific feedback or suggestions"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            disabled={isSubmitting}
            rows={4}
          />

          {error && <p className="session-rating-modal__error" role="alert">{error}</p>}

          <footer className="session-rating-modal__actions">
            <button
              type="button"
              className="session-rating-modal__button session-rating-modal__button--ghost"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="session-rating-modal__button session-rating-modal__button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : 'Submit rating'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

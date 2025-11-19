import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

export default function AdminLogin({ onLogin, loading, session }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (session) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <h1 className="admin-login-title">Admin access active</h1>
          <p className="admin-login-sub">You are already signed in as {session.display_name || session.email}.</p>
          <button
            type="button"
            className="admin-login-button"
            onClick={() => navigate('/admin', { replace: true })}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onLogin({ email: email.trim(), password });
    } catch (err) {
      const message = err?.response?.data?.detail || 'Invalid credentials. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <h1 className="admin-login-title">Admin Portal</h1>
        <p className="admin-login-sub">Sign in to manage the AI Mock Interview platform.</p>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            autoComplete="username"
            disabled={submitting || loading}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            disabled={submitting || loading}
          />
          {error && <div className="admin-login-error">{error}</div>}
          <button
            type="submit"
            className="admin-login-button"
            disabled={submitting || loading}
          >
            {(submitting || loading) ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './StudentLogin.css';
import { loginStudent, requestPasswordReset, resetPassword } from './api';
import logo from './assets/logos/fut_logo.png';

export default function StudentLogin({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetStage, setResetStage] = useState('request'); // 'request' | 'confirm'
    const [resetEmail, setResetEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paramEmail = params.get('email');
        const paramToken = params.get('token');

        if (paramEmail || paramToken) {
            setResetEmail(paramEmail || '');
            setResetToken(paramToken || '');
            setResetStage(paramToken ? 'confirm' : 'request');
            setResetMessage(
                paramToken
                    ? 'Enter the token you received and choose a new password.'
                    : 'Enter your email address to request a reset token.'
            );
            setIsResetOpen(true);

            navigate(location.pathname, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);


    const handleLogin = async () => {
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data } = await loginStudent({
                email: email.trim(),
                password,
            });
            onLogin(data);
        } catch (err) {
            console.error('Login failed', err);
            const message = err.response?.data?.detail || 'Login failed. Please check your email or register.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const openResetModal = () => {
        setResetStage('request');
        setResetEmail(email.trim());
        setResetToken('');
        setNewPassword('');
        setResetMessage('');
        setError('');
        setIsResetOpen(true);
    };

    const closeResetModal = () => {
        if (resetLoading) return;
        setIsResetOpen(false);
    };

    const handleRequestReset = async () => {
        if (!resetEmail.trim()) {
            setResetMessage('Please enter your email to continue.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(resetEmail)) {
            setResetMessage('Please enter a valid email address.');
            return;
        }

        setResetLoading(true);
        setResetMessage('');
        try {
            await requestPasswordReset(resetEmail.trim());
            setResetStage('confirm');
            setResetMessage('A reset token has been sent to your email. Enter it below to set a new password.');
        } catch (err) {
            console.error('Password reset request failed', err);
            const message = err.response?.data?.detail || 'Failed to generate reset link.';
            setResetMessage(message);
        } finally {
            setResetLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetToken.trim()) {
            setResetMessage('Please enter the reset token you received.');
            return;
        }
        if (!newPassword.trim()) {
            setResetMessage('Please enter a new password.');
            return;
        }

        setResetLoading(true);
        setResetMessage('');
        try {
            await resetPassword({
                email: resetEmail.trim(),
                token: resetToken.trim(),
                new_password: newPassword,
            });
            setResetMessage('Password updated successfully. You can now log in with the new password.');
            setResetStage('done');
            setResetToken('');
            setNewPassword('');
        } catch (err) {
            console.error('Password reset failed', err);
            const message = err.response?.data?.detail || 'Failed to reset password.';
            setResetMessage(message);
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="login-container">
            <img src={logo} alt="Futurense Logo" className="login-logo" />
            <div className="login-box">
                <h1 className="login-title">Login</h1>
                <p className="login-subtitle">Get started with your AI mock interview.</p>
                <input
                    type="email"
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                />
                <input
                    type="password"
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                />
                {error && <div className="login-error">{error}</div>}
                <button
                    onClick={handleLogin}
                    className="login-button"
                    disabled={loading}
                >
                    {loading ? 'Processing…' : 'Login'}
                </button>
                <button
                    type="button"
                    className="login-forgot"
                    onClick={openResetModal}
                    disabled={loading}
                >
                    Forgot password?
                </button>
            </div>

            {isResetOpen && (
                <div className="reset-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="reset-modal">
                        <header className="reset-modal__header">
                            <h2>Reset your password</h2>
                            <button type="button" onClick={closeResetModal} className="reset-close" disabled={resetLoading}>
                                ✕
                            </button>
                        </header>
                        <div className="reset-modal__body">
                            {resetStage === 'request' && (
                                <>
                                    <p>Enter the email associated with your account. We will send you a reset token.</p>
                                    <input
                                        type="email"
                                        className="login-input"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        disabled={resetLoading}
                                    />
                                </>
                            )}

                            {resetStage === 'confirm' && (
                                <>
                                    <p>Enter the reset token you received and choose a new password.</p>
                                    <input
                                        type="text"
                                        className="login-input"
                                        value={resetToken}
                                        onChange={(e) => setResetToken(e.target.value)}
                                        placeholder="Reset token"
                                        disabled={resetLoading}
                                    />
                                    <input
                                        type="password"
                                        className="login-input"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New password"
                                        disabled={resetLoading}
                                    />
                                </>
                            )}

                            {resetStage === 'done' && (
                                <p className="reset-success">Password updated successfully! You can now close this window and log in.</p>
                            )}

                            {resetMessage && <div className="reset-message">{resetMessage}</div>}
                        </div>
                        <footer className="reset-modal__footer">
                            {resetStage === 'request' && (
                                <button onClick={handleRequestReset} className="reset-button" disabled={resetLoading}>
                                    {resetLoading ? 'Sending…' : 'Send reset link'}
                                </button>
                            )}
                            {resetStage === 'confirm' && (
                                <button onClick={handleResetPassword} className="reset-button" disabled={resetLoading}>
                                    {resetLoading ? 'Updating…' : 'Update password'}
                                </button>
                            )}
                            {resetStage === 'done' && (
                                <button onClick={closeResetModal} className="reset-button">
                                    Close
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

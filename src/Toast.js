import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 1000); // Corresponds to the animation duration

        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    return (
        <div className="toast">
            <span className="toast-icon">🤖</span>
            <div className="toast-content">
                <p>{message}</p>
            </div>
        </div>
    );
};

const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

export default ToastContainer;

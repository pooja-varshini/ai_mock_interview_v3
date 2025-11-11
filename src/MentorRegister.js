import React, { useState } from 'react';
import { importStudentsCsv } from './api';
import './MentorRegister.css';

const MentorRegister = () => {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
    setResult(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsSubmitting(true);
      const response = await importStudentsCsv(formData);
      setResult(response.data);
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to import students. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadedSample = () => {
    const rows = [
      ['name', 'email', 'program_name'],
      ['Jane Doe', 'jane.doe@example.com', 'Computer Science 2025'],
      ['John Smith', 'john.smith@example.com', 'MBA Leadership 2024'],
    ];

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student-upload-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mentor-register-page">
      <div className="mentor-register-card">
        <h1>Register Students</h1>
        <p className="mentor-register-description">
          Upload a CSV containing student names, emails, and program names. Each student will receive an email with their temporary password.
        </p>

        <div className="mentor-register-help">
          <h2>CSV import</h2>
          <p className="mentor-register-help-text">
            Your file must include the following columns. Download the template to start from a clean example.
          </p>

          <div className="mentor-register-info">
            <span className="mentor-register-info-icon">ℹ️</span>
            <span>You can import up to 200 students at a time.</span>
          </div>

          <div className="mentor-register-table-wrapper">
            <table className="mentor-register-table">
              <thead>
                <tr>
                  <th>Name*</th>
                  <th>Email*</th>
                  <th>Program name*</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Jane Doe</td>
                  <td>jane.doe@example.com</td>
                  <td>Computer Science 2025</td>
                </tr>
                <tr>
                  <td colSpan={3} className="mentor-register-table-note">* Required columns. Additional columns will be ignored.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mentor-register-info secondary">
            <span className="mentor-register-info-icon">✉️</span>
            <span>All imported students will receive an email containing their login credentials.</span>
          </div>

          <div className="mentor-register-tips">
            <h3>CSV import tips</h3>
            <ul>
              <li>Save the file with UTF-8 encoding and a single header row.</li>
              <li>Ensure there are no duplicate emails in the file.</li>
              <li>Program names should match exactly with existing programs</li>
              <li>For large batches, split uploads into multiple files of 200 rows each.</li>
            </ul>
          </div>
        </div>

        <div className="mentor-register-actions">
          <button type="button" className="sample-button" onClick={downloadedSample}>
            Download CSV template
          </button>
        </div>

        <form className="mentor-register-form" onSubmit={handleSubmit}>
          <label className="file-picker">
            <input type="file" accept=".csv" onChange={handleFileChange} disabled={isSubmitting} />
            <span>{file ? file.name : 'Choose CSV file...'}</span>
          </label>

          <button type="submit" className="upload-button" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading…' : 'Upload & Register'}
          </button>
        </form>

        {error && <div className="mentor-register-error">{error}</div>}

        {result && (
          <div className="mentor-register-summary">
            <h2>Import summary</h2>
            <ul>
              <li><strong>Total rows:</strong> {result.total_rows}</li>
              <li><strong>Students imported:</strong> {result.imported}</li>
              <li><strong>Emails sent:</strong> {result.email_sent}</li>
            </ul>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="mentor-register-errors">
                <h3>Rows requiring attention</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Email</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((rowError, idx) => (
                      <tr key={`${rowError.row}-${idx}`}>
                        <td>{rowError.row}</td>
                        <td>{rowError.email || '—'}</td>
                        <td>{rowError.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorRegister;

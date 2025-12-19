import React, { useEffect, useRef, useState } from 'react';
import { importStudentsCsv, fetchUniversities, fetchUbpPrograms, fetchUbpBatches, resolveUbp } from './api';
import './MentorRegister.css';

const ImportSummaryModal = ({ result, onClose }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!result || !modalRef.current) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      modalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => cancelAnimationFrame(rafId);
  }, [result]);

  if (!result) {
    return null;
  }

  const duplicates = Array.isArray(result.duplicates_ignored) ? result.duplicates_ignored : [];
  const errors = Array.isArray(result.errors) ? result.errors : [];

  return (
    <div className="mentor-summary-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mentor-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-summary-title"
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="mentor-summary-close" onClick={onClose} aria-label="Close import summary">✕</button>

        <div className="mentor-register-success" role="status">
          ✅ Upload successful!.
        </div>

        <h2 id="import-summary-title">Import summary</h2>
        <ul>
          <li><strong>Total rows processed:</strong> {result.total_rows}</li>
          <li><strong>Students imported:</strong> {result.imported}</li>
          <li><strong>Emails sent:</strong> {result.email_sent}</li>
          <li><strong>Duplicates ignored:</strong> {duplicates.length}</li>
        </ul>

        {duplicates.length > 0 && (
          <div className="mentor-register-duplicates">
            <h3>Ignored duplicates</h3>
            <p>The following emails were already registered and were skipped:</p>
            <ul>
              {duplicates.map((duplicate) => (
                <li key={`${duplicate.email}-${duplicate.row}`}>
                  <span className="duplicate-email">{duplicate.email}</span>
                  {typeof duplicate.row === 'number' ? <span className="duplicate-meta"> (row {duplicate.row})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
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
                {errors.map((rowError, idx) => (
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

        <div className="mentor-summary-footer">
          <button type="button" className="mentor-summary-close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const MentorRegister = () => {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const fileInputRef = useRef(null);

  // UBP selections
  const [universities, setUniversities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
    setResult(null);
    setError('');
    setIsSummaryOpen(false);
  };

  useEffect(() => {
    const loadUniversities = async () => {
      try {
        setLoadingMeta(true);
        const { data } = await fetchUniversities();
        setUniversities(Array.isArray(data) ? data : []);
      } catch (e) {
        setUniversities([]);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadUniversities();
  }, []);

  const onSelectUniversity = async (e) => {
    const uni = e.target.value || '';
    setSelectedUniversity(uni);
    setSelectedProgram('');
    setSelectedBatch('');
    setPrograms([]);
    setBatches([]);
    if (!uni) return;
    try {
      const { data } = await fetchUbpPrograms(uni);
      setPrograms(Array.isArray(data) ? data : []);
    } catch {
      setPrograms([]);
    }
  };

  const onSelectProgram = async (e) => {
    const prog = e.target.value || '';
    setSelectedProgram(prog);
    setSelectedBatch('');
    setBatches([]);
    if (!selectedUniversity || !prog) return;
    try {
      const { data } = await fetchUbpBatches(selectedUniversity, prog);
      setBatches(Array.isArray(data) ? data : []);
    } catch {
      setBatches([]);
    }
  };

  const onSelectBatch = (e) => {
    setSelectedBatch(e.target.value || '');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    if (!selectedUniversity || !selectedProgram || !selectedBatch) {
      setError('Please select University, Program, and Batch before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      // Resolve ubp_id to use as program_id for backend import
      const { data: resolved } = await resolveUbp(selectedUniversity, selectedProgram, selectedBatch);
      const ubpId = resolved?.ubp_id;
      if (!ubpId) {
        setError('Unable to resolve selected University/Program/Batch.');
        return;
      }
      // Provide multiple hints for maximum backend compatibility
      formData.append('program_id', String(ubpId));
      formData.append('ubp_id', String(ubpId));
      formData.append('university_name', selectedUniversity);
      formData.append('program_name', selectedProgram);
      formData.append('batch_label', selectedBatch);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to resolve UBP selection.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await importStudentsCsv(formData);
      const result = response.data;
      
      // Check if there are invalid email errors
      const hasInvalidEmails = result.errors && result.errors.some(error => 
        error.reason === 'Invalid email format' || 
        error.reason.includes('email') ||
        error.reason.includes('Invalid')
      );
      
      if (hasInvalidEmails && result.imported === 0) {
        // If no students were imported and there are invalid emails, show error message
        setError('The CSV file contains invalid email addresses. Please check the file and correct the email formats before uploading.');
      } else {
        // Otherwise show the summary modal (which will include the errors)
        setResult(result);
        setIsSummaryOpen(true);
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || '';
      if (errorDetail.includes('Invalid email format') || 
          errorDetail.includes('value is not a valid email address') ||
          errorDetail.includes('invalid emails')) {
        setError('The CSV file contains invalid email addresses. Please check the file and correct the email formats before uploading.');
      } else {
        setError(errorDetail || 'Failed to import students. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormState = () => {
    setFile(null);
    setResult(null);
    setError('');
    setIsSummaryOpen(false);
    setSelectedUniversity('');
    setSelectedProgram('');
    setSelectedBatch('');
    setPrograms([]);
    setBatches([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSummaryClose = () => {
    resetFormState();
  };

  const downloadedSample = () => {
    const rows = [
      ['name', 'email'],
      ['Jane Doe', 'jane.doe@example.com'],
      ['John Smith', 'john.smith@example.com'],
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
          Select the University, Program and Batch, then upload a CSV containing only student name and email. Each student will be assigned to the selected batch program and receive credentials.
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
                  
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Jane Doe</td>
                  <td>jane.doe@example.com</td>
                </tr>
                <tr>
                  <td colSpan={2} className="mentor-register-table-note">* Required columns. Additional columns will be ignored.</td>
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
          <select value={selectedUniversity} onChange={onSelectUniversity} disabled={isSubmitting || loadingMeta}>
            <option value="">Select University</option>
            {universities.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <select value={selectedProgram} onChange={onSelectProgram} disabled={!selectedUniversity || isSubmitting}>
            <option value="">Select Program</option>
            {programs.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select value={selectedBatch} onChange={onSelectBatch} disabled={!selectedProgram || isSubmitting}>
            <option value="">Select Batch</option>
            {batches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <label className="file-picker">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            <span>{file ? file.name : 'Choose CSV file...'}</span>
          </label>

          <button type="submit" className="upload-button" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading…' : 'Upload & Register'}
          </button>
        </form>

        {error && <div className="mentor-register-error">{error}</div>}

        <ImportSummaryModal result={isSummaryOpen ? result : null} onClose={handleSummaryClose} />
      </div>
    </div>
  );
};

export default MentorRegister;

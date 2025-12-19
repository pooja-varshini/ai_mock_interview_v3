import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAdminDashboardStats,
  fetchAdminStudents,
  fetchAdminSessions,
  fetchAdminPerformanceAnalytics,
  fetchAdminInsights,
  fetchAdminUbpPerformance,
  fetchAdminRetention,
  fetchAdminLeaderboard,
  fetchAdminLeaderboardFilters,
  fetchAdminRoleFilterOptions,
  bulkUploadInterviewQuestions,
  fetchBulkUploadOptions,
  mapProgramRoles,
  fetchWorkExperienceLevels,
  fetchUniversities,
  fetchUbpPrograms,
  fetchUbpBatches,
  fetchJobRolesByWorkExperience,
} from './api';
import FeedbackScreen from './FeedbackScreen';
import './AdminPage.css';
import './MentorRegister.css';
import {
  EngagementAreaChart,
  ProgramComposedChart,
  ProgramPieChart,
  ExperienceHorizontalBar,
  TrendingRolesBar,
  ChartPlaceholder,
} from './AdminAnalyticsCharts';

const formatNumber = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-IN') : '--';

const formatScore = (value) =>
  typeof value === 'number' ? value.toFixed(2) : '—';

const ordinal = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return `${value}`;
  const remainder = v % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${v}th`;
  }
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
};

const getScoreClass = (score) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return 'admin-score';
  }

  const numeric = Number(score);
  if (numeric > 3.5) return 'admin-score admin-score--good';
  if (numeric <= 2) return 'admin-score admin-score--low';
  return 'admin-score admin-score--average';
};

// Difficulty options for question forms
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

// CreatableMultiSelect component - allows typing to filter, adding custom values, and selecting from options
// Set allowCreate=false to disable creation of new values (select-only mode)
// Selected values shown as chips INSIDE the box with "+N more" for overflow
const CreatableMultiSelect = ({ label, options, selected, onChange, required = false, disabled = false, placeholder, allowCreate = true }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef(null);

  const allSelected = Array.isArray(selected) ? selected : [];

  // Include custom selected values that are not part of the original options so they
  // also appear in the dropdown and can be removed from there.
  const optionsWithCustom = React.useMemo(() => {
    const lowerBase = new Set((options || []).map((opt) => String(opt).toLowerCase()));
    const extras = allSelected.filter((sel) => !lowerBase.has(String(sel).toLowerCase()));
    return [...options, ...extras];
  }, [options, allSelected]);

  // Track which selected values are user-created (not part of the original options list)
  const customSelectedLower = React.useMemo(() => {
    const lowerBase = new Set((options || []).map((opt) => String(opt).toLowerCase()));
    return new Set(
      allSelected
        .filter((sel) => !lowerBase.has(String(sel).toLowerCase()))
        .map((sel) => String(sel).toLowerCase()),
    );
  }, [options, allSelected]);

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return optionsWithCustom;
    const searchTerm = inputValue.toLowerCase().trim();
    return optionsWithCustom.filter((option) => option.toLowerCase().includes(searchTerm));
  }, [optionsWithCustom, inputValue]);

  // Check if the current input value is a new custom value (not in options and not already selected)
  // Only relevant when allowCreate is true
  const isNewValue = React.useMemo(() => {
    if (!allowCreate) return false;
    if (!inputValue.trim()) return false;
    const trimmed = inputValue.trim();
    const existsInOptions = optionsWithCustom.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());
    const alreadySelected = allSelected.some((sel) => sel.toLowerCase() === trimmed.toLowerCase());
    return !existsInOptions && !alreadySelected;
  }, [allowCreate, inputValue, optionsWithCustom, allSelected]);

  const toggleOption = (option) => {
    // Handle "No specific industry" mutual exclusivity
    if (option === 'No specific industry') {
      if (!selected.includes(option)) {
        onChange([option]);
      } else {
        onChange(selected.filter((item) => item !== option));
      }
    } else {
      if (selected.includes(option)) {
        onChange(selected.filter((item) => item !== option));
      } else {
        onChange([...selected.filter((item) => item !== 'No specific industry'), option]);
      }
    }
  };

  const addCustomValue = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    // Check if already selected (case-insensitive)
    const alreadySelected = allSelected.some((sel) => sel.toLowerCase() === trimmed.toLowerCase());
    if (alreadySelected) {
      setInputValue('');
      return;
    }

    // Check if it matches an existing option (case-insensitive) - use the original case
    const existingOption = optionsWithCustom.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
    if (existingOption) {
      toggleOption(existingOption);
    } else if (allowCreate) {
      // Add as new custom value, removing "No specific industry" if present
      onChange([...selected.filter((item) => item !== 'No specific industry'), trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomValue();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
      // Remove last selected item when backspace is pressed with empty input
      onChange(selected.slice(0, -1));
    }
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    setIsOpen(true);
    // Focus the input when opening
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const displayPlaceholder = placeholder || `Select or type ${label}`;

  // Show only the first few chips, then "+N more" to avoid overflowing to a second line
  const MAX_VISIBLE_CHIPS = 2;
  const visibleSelected = allSelected.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenSelected = allSelected.slice(MAX_VISIBLE_CHIPS);
  const hiddenCount = hiddenSelected.length;

  return (
    <div className="admin-form-field admin-multiselect">
      <label>
        {label}
        {required && <span>*</span>}
      </label>
      <div
        onClick={handleTriggerClick}
        className={`admin-multiselect__trigger ${disabled ? 'admin-multiselect__trigger--disabled' : ''}`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="admin-multiselect__values">
          {visibleSelected.map((item) => (
            <span key={item} className="admin-multiselect__chip">
              {item}
              <button
                type="button"
                className="admin-multiselect__chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(item);
                }}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
          {hiddenCount > 0 && (
            <span
              className="admin-multiselect__chip admin-multiselect__chip--summary"
              title={hiddenSelected.join(', ')}
            >
              +{hiddenCount} more
            </span>
          )}
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              className="admin-multiselect__input"
              style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selected.length === 0 ? displayPlaceholder : ''}
              disabled={disabled}
              autoComplete="off"
            />
          ) : (
            selected.length === 0 && (
              <span className="admin-multiselect__placeholder">{displayPlaceholder}</span>
            )
          )}
        </div>
        <span className={`admin-multiselect__arrow ${isOpen ? 'admin-multiselect__arrow--open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <>
          <div className="admin-multiselect__backdrop" onClick={() => { setIsOpen(false); setInputValue(''); }} />
          <div className="admin-multiselect__dropdown">
            {/* Render existing options first, then an optional create row at the bottom */}
            {filteredOptions.length > 0 ? (
              <>
                {filteredOptions.map((option) => {
                  const isSelected = selected.includes(option);
                  const isCustom = customSelectedLower.has(String(option).toLowerCase());
                  const optionClassNames = [
                    'admin-multiselect__option',
                    isSelected ? 'admin-multiselect__option--selected' : '',
                    isCustom ? 'admin-multiselect__option--custom' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={optionClassNames}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span>{option}</span>
                      {isSelected && <span className="admin-multiselect__check">✓</span>}
                    </div>
                  );
                })}
                {isNewValue && (
                  <div
                    onClick={() => addCustomValue()}
                    className="admin-multiselect__option admin-multiselect__option--create"
                    role="option"
                  >
                    <span>Create "{inputValue.trim()}"</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {!isNewValue && (
                  <div className="admin-multiselect__option admin-multiselect__option--empty">
                    {inputValue.trim() ? 'No matches found.' : 'No options available'}
                  </div>
                )}
                {isNewValue && (
                  <div
                    onClick={() => addCustomValue()}
                    className="admin-multiselect__option admin-multiselect__option--create"
                    role="option"
                  >
                    <span>Create "{inputValue.trim()}"</span>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Alias for backward compatibility
const MultiSelect = CreatableMultiSelect;

// Single-select dropdown with the same visual style as MultiSelect
const SingleSelectDropdown = ({
  label,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  error,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (option) => {
    if (disabled) return;
    onChange(option);
    setIsOpen(false);
  };

  const displayPlaceholder = placeholder || `Select ${label}`;
  const hasValue = value !== undefined && value !== null && String(value).trim() !== '';

  return (
    <div className="admin-form-field admin-multiselect">
      <label>
        {label}
        {required && <span>*</span>}
      </label>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`admin-multiselect__trigger ${disabled ? 'admin-multiselect__trigger--disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="admin-multiselect__values">
          {hasValue ? (
            <span>{value}</span>
          ) : (
            <span className="admin-multiselect__placeholder">{displayPlaceholder}</span>
          )}
        </div>
        <span className={`admin-multiselect__arrow ${isOpen ? 'admin-multiselect__arrow--open' : ''}`}>
          ▼
        </span>
      </div>

      {isOpen && (
        <>
          <div className="admin-multiselect__backdrop" onClick={() => setIsOpen(false)} />
          <div className="admin-multiselect__dropdown">
            {options.length === 0 ? (
              <div className="admin-multiselect__option admin-multiselect__option--empty">No options available</div>
            ) : (
              options.map((option) => (
                <div
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`admin-multiselect__option ${value === option ? 'admin-multiselect__option--selected' : ''}`}
                  role="option"
                  aria-selected={value === option}
                >
                  <span>{option}</span>
                  {value === option && <span className="admin-multiselect__check">✓</span>}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

const copySampleCsv = () => {
  const rows = [
    ['question', 'mandatory_skills', 'predefined_answer', 'interview_type', 'difficulty', 'question_type'],
    ['Describe a challenging project you worked on.', 'Communication,Problem-solving', 'A strong answer should include specific examples of challenges faced and how they were overcome.', 'Technical', 'Medium', 'Speech Based'],
    ['Write a Python function to reverse a string.', 'Python,Algorithms', '', 'Technical', 'Easy', 'Coding (Python)'],
    ['Write a SQL query to find duplicate records.', 'SQL,Database', 'SELECT column, COUNT(*) FROM table GROUP BY column HAVING COUNT(*) > 1', 'Technical', 'Hard', 'Coding (SQL)'],
  ];

  const csvContent = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'question-upload-sample.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const BulkUploadSummaryModal = ({ result, onClose }) => {
  if (!result) {
    return null;
  }

  const skippedRows = Array.isArray(result.skipped_rows) ? result.skipped_rows : [];

  return (
    <div className="mentor-summary-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mentor-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-summary-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="mentor-summary-close"
          onClick={onClose}
          aria-label="Close upload summary"
        >
          ✕
        </button>

        <div className="mentor-register-success" role="status">
          ✅ Bulk upload completed.
        </div>

        <h2 id="bulk-summary-title">Upload summary</h2>
        <ul style={{ color: '#f5f5ff' }}>
          <li>
            <strong>Questions inserted:</strong> {result.inserted}
          </li>
          {result.questions_in_csv && (
            <li>
              <strong>Questions in CSV:</strong> {result.questions_in_csv}
            </li>
          )}
          <li>
            <strong>Rows skipped:</strong> {skippedRows.length}
          </li>
        </ul>

        {skippedRows.length > 0 && (
          <div className="mentor-register-duplicates">
            <h3>Skipped rows</h3>
            <p style={{ color: 'rgba(220, 232, 255, 0.9)' }}>
              The following rows were skipped (for example, empty or invalid questions):
            </p>
            <ul style={{ color: '#dce8ff' }}>
              {skippedRows.map((row, idx) => (
                <li key={`${row}-${idx}`}>
                  <span className="duplicate-email">Row {row}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mentor-summary-footer">
          <button type="button" className="mentor-summary-close-button" onClick={onClose}>
            Close &amp; refresh
          </button>
        </div>
      </div>
    </div>
  );
};

const QuestionSuccessModal = ({ summary, onClose }) => {
  const inserted = summary?.inserted ?? 1;

  return (
    <div className="mentor-summary-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mentor-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="mentor-summary-close"
          onClick={onClose}
          aria-label="Close success message"
        >
          ✕
        </button>

        <div className="mentor-register-success" role="status">
          ✅ Question added successfully.
        </div>

        <h2 id="question-success-title">Question summary</h2>
        <ul style={{ color: '#f5f5ff', marginTop: '8px' }}>
          <li>
            <strong>Questions inserted:</strong> {inserted}
          </li>
        </ul>

        <div className="mentor-summary-footer">
          <button type="button" className="mentor-summary-close-button" onClick={onClose}>
            Close &amp; refresh
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminPage = ({ admin, onLogout }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentPagination, setStudentPagination] = useState(null);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPagination, setSessionPagination] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [insightsState, setInsightsState] = useState(null);
  const [ubpCohorts, setUbpCohorts] = useState([]);
  const [retentionStats, setRetentionStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    role: '',
    company: '',
    program: '',
    university: '',
    batch: '',
  });
  const [leaderboardFilterInputs, setLeaderboardFilterInputs] = useState({
    role: '',
    company: '',
    program: '',
    university: '',
    batch: '',
  });
  const [leaderboardFilterOptions, setLeaderboardFilterOptions] = useState({
    roles: [],
    companies: [],
    universities: [],
    programs: [],
    batches: [],
  });
  const [leaderboardRoleOptions, setLeaderboardRoleOptions] = useState([]);
  const [leaderboardUbpOptions, setLeaderboardUbpOptions] = useState({
    programs: [],
    batches: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    try {
      return window.sessionStorage.getItem('adminActiveTab') || 'overview';
    } catch (e) {
      return 'overview';
    }
  });
  const [activeSession, setActiveSession] = useState(null);
  const [studentFilters, setStudentFilters] = useState({
    name: '',
    email: '',
    status: '',
    university_name: '',
    program_name: '',
    batch_label: '',
  });
  const [studentFilterInputs, setStudentFilterInputs] = useState({
    name: '',
    email: '',
    status: '',
    university_name: '',
    program_name: '',
    batch_label: '',
  });
  const [studentsLoading, setStudentsLoading] = useState(true);
  // Dependent dropdown options for student filters
  const [studentFilterOptions, setStudentFilterOptions] = useState({
    universities: [],
    programs: [],
    batches: [],
  });
  const [studentFilterOptionsLoading, setStudentFilterOptionsLoading] = useState(false);
  const [sessionFilters, setSessionFilters] = useState({
    role: '',
    student: '',
    email: '',
    company: '',
    minScore: '',
    maxScore: '',
    university_name: '',
    program_name: '',
    batch_label: '',
  });
  const [sessionFilterInputs, setSessionFilterInputs] = useState({
    role: '',
    student: '',
    email: '',
    company: '',
    minScore: '',
    maxScore: '',
    university_name: '',
    program_name: '',
    batch_label: '',
  });
  const [sessionFilterOptions, setSessionFilterOptions] = useState({
    universities: [],
    programs: [],
    batches: [],
  });
  const [sessionRoleOptions, setSessionRoleOptions] = useState([]);
  const [sessionFilterOptionsLoading, setSessionFilterOptionsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Single question form state
  const [questionForm, setQuestionForm] = useState({
    mandatory_skills: '',
    question: '',
    pre_def_answer: '',
    interview_type: '',
    difficulty: '',
    question_type: '',
  });
  // Category selections for single question form (multi-select for industry/company/role/work_exp)
  const [singleQuestionSelections, setSingleQuestionSelections] = useState({
    industries: [],
    companies: [],
    roles: [],
    work_experiences: [],
  });
  const [questionFormErrors, setQuestionFormErrors] = useState({});
  const [questionFormLoading, setQuestionFormLoading] = useState(false);
  // Bulk form - interview_type, difficulty, question_type now come from CSV
  const [bulkForm, setBulkForm] = useState({
    industries: [],
    companies: [],
    roles: [],
    work_experiences: [],
    file: null,
  });
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [questionSuccess, setQuestionSuccess] = useState(false);
  const [questionSummary, setQuestionSummary] = useState(null);
  const [toast, setToast] = useState(null);
  const [showProgramRoleMappingCard, setShowProgramRoleMappingCard] = useState(false);
  // Program role mapping state
  const [programRoleMapping, setProgramRoleMapping] = useState({
    university: '',
    program: '',
    batch: '',
    work_experience: '',
    job_roles: [],
  });
  const [programRoleOptions, setProgramRoleOptions] = useState({
    universities: [],
    programs: [],
    batches: [],
    work_experiences: [],
    job_roles: [],
  });
  const [programRoleLoading, setProgramRoleLoading] = useState(false);
  const [programRoleInlineMessage, setProgramRoleInlineMessage] = useState('');
  // All options for question upload (loaded without dependencies)
  const [bulkUploadOptions, setBulkUploadOptions] = useState({
    industries: [],
    companies: [],
    roles: [],
    interviewTypes: [],
    workExperiences: [],
    questionTypes: [],
  });

  const resetProgramRoleMapping = () => {
    setProgramRoleMapping({
      university: '',
      program: '',
      batch: '',
      work_experience: '',
      job_roles: [],
    });
    setProgramRoleOptions((prev) => ({
      ...prev,
      programs: [],
      batches: [],
      job_roles: [],
    }));
    setProgramRoleInlineMessage('');
  };

  const openProgramRoleMapping = () => {
    resetProgramRoleMapping();
    setShowProgramRoleMappingCard(true);
  };

  const closeProgramRoleMapping = () => {
    setShowProgramRoleMappingCard(false);
    resetProgramRoleMapping();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem('adminActiveTab', activeTab);
    } catch (e) {
      // ignore storage errors
    }
  }, [activeTab]);

  // Load bulk upload options when questions tab is active
  useEffect(() => {
    if (activeTab !== 'questions') return;
    let cancelled = false;

    const loadBulkOptions = async () => {
      try {
        const response = await fetchBulkUploadOptions();
        if (cancelled) return;
        const data = response.data ?? {};
        setBulkUploadOptions({
          industries: data.industries ?? [],
          companies: data.companies ?? [],
          roles: data.roles ?? [],
          interviewTypes: data.interview_types ?? [],
          workExperiences: data.work_experiences ?? [],
          questionTypes: data.question_types ?? [],
        });
      } catch (err) {
        console.warn('Failed to load bulk upload options', err);
      }
    };

    loadBulkOptions();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Load program role mapping options (UBP + work experience + existing roles) when questions tab is active
  useEffect(() => {
    if (activeTab !== 'questions') return;
    let cancelled = false;

    const loadProgramRoleOptions = async () => {
      try {
        const [uniRes, workRes] = await Promise.all([
          fetchUniversities(),
          fetchWorkExperienceLevels(),
        ]);
        if (cancelled) return;
        setProgramRoleOptions((prev) => ({
          ...prev,
          universities: Array.isArray(uniRes.data) ? uniRes.data : [],
          work_experiences: Array.isArray(workRes.data) ? workRes.data : [],
          // Leave job_roles as [] so this card is only for creating new roles
        }));
      } catch (error) {
        console.warn('Failed to load program role mapping options', error);
      }
    };

    loadProgramRoleOptions();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleProgramRoleUniversityChange = async (event) => {
    const university = event.target.value || '';
    setProgramRoleMapping((prev) => ({
      ...prev,
      university,
      program: '',
      batch: '',
    }));
    setProgramRoleOptions((prev) => ({ ...prev, programs: [], batches: [] }));

    if (!university) return;

    try {
      const { data } = await fetchUbpPrograms(university);
      setProgramRoleOptions((prev) => ({
        ...prev,
        programs: Array.isArray(data) ? data : [],
      }));
    } catch (error) {
      console.warn('Failed to load programs for role mapping', error);
    }
  };

  const handleProgramRoleProgramChange = async (event) => {
    const program = event.target.value || '';
    setProgramRoleMapping((prev) => ({
      ...prev,
      program,
      batch: '',
    }));
    setProgramRoleOptions((prev) => ({ ...prev, batches: [] }));

    const university = programRoleMapping.university;
    if (!university || !program) return;

    try {
      const { data } = await fetchUbpBatches(university, program);
      setProgramRoleOptions((prev) => ({
        ...prev,
        batches: Array.isArray(data) ? data : [],
      }));
    } catch (error) {
      console.warn('Failed to load batches for role mapping', error);
    }
  };

  const handleProgramRoleBatchChange = (event) => {
    const batch = event.target.value || '';
    setProgramRoleMapping((prev) => ({
      ...prev,
      batch,
    }));
  };

  const handleProgramRoleWorkExperienceChange = (event) => {
    const work_experience = event.target.value || '';
    setProgramRoleMapping((prev) => ({
      ...prev,
      work_experience,
    }));
  };

  // When university, program, batch and work experience are all selected,
  // load existing mapped job roles for that combination so the overlay shows
  // the current list while still allowing creation of new roles.
  useEffect(() => {
    const { university, program, batch, work_experience } = programRoleMapping;

    // If the selection is incomplete, clear suggestions but keep any in-progress edits.
    if (!university || !program || !batch || !work_experience) {
      setProgramRoleOptions((prev) => ({ ...prev, job_roles: [] }));
      return undefined;
    }

    let cancelled = false;

    const loadExistingRoles = async () => {
      try {
        const { data } = await fetchJobRolesByWorkExperience(work_experience, program);
        if (cancelled) return;

        const roles = Array.isArray(data) ? data.filter(Boolean) : [];

        // Populate options so they appear in the dropdown
        setProgramRoleOptions((prev) => ({
          ...prev,
          job_roles: roles,
        }));
      } catch (error) {
        console.warn('Failed to load existing job roles for program mapping', error);
        if (!cancelled) {
          setProgramRoleOptions((prev) => ({ ...prev, job_roles: [] }));
        }
      }
    };

    loadExistingRoles();

    return () => {
      cancelled = true;
    };
  }, [
    programRoleMapping.university,
    programRoleMapping.program,
    programRoleMapping.batch,
    programRoleMapping.work_experience,
  ]);

  const handleProgramRoleJobRolesChange = (values) => {
    setProgramRoleMapping((prev) => ({
      ...prev,
      job_roles: Array.isArray(values) ? values : [],
    }));
  };

  const handleBulkSummaryClose = () => {
    setBulkStatus(null);
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
      window.location.reload();
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const handleChange = (event) => setIsSidebarOpen(!event.matches);

    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboardRoles = async () => {
      try {
        const params = {};
        if (leaderboardFilterInputs.university) params.university = leaderboardFilterInputs.university;
        if (leaderboardFilterInputs.program) params.program = leaderboardFilterInputs.program;
        if (leaderboardFilterInputs.batch) params.batch = leaderboardFilterInputs.batch;

        const { data } = await fetchAdminRoleFilterOptions(params);
        if (cancelled) return;
        setLeaderboardRoleOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load role filter options for leaderboard', err);
          setLeaderboardRoleOptions([]);
        }
      }
    };

    loadLeaderboardRoles();

    return () => {
      cancelled = true;
    };
  }, [
    leaderboardFilterInputs.university,
    leaderboardFilterInputs.program,
    leaderboardFilterInputs.batch,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async () => {
      setLoading(true);
      setError('');

      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetchAdminDashboardStats(),
          fetchAdminPerformanceAnalytics({ days: 14 }),
        ]);

        if (cancelled) return;

        setStats(statsRes.data);
        setAnalytics(analyticsRes.data ?? null);

        try {
          const insightsRes = await fetchAdminInsights();
          if (!cancelled) {
            setInsightsState(insightsRes.data ?? null);
          }
        } catch (insightsError) {
          console.warn('Admin insights endpoint unavailable:', insightsError);
          if (!cancelled) {
            setInsightsState(null);
          }
        }
        try {
          const [ubpRes, retentionRes] = await Promise.all([
            fetchAdminUbpPerformance(),
            fetchAdminRetention(),
          ]);
          if (!cancelled) {
            setUbpCohorts(ubpRes.data?.cohorts ?? []);
            setRetentionStats(retentionRes.data ?? null);
          }
        } catch (advancedErr) {
          console.warn('Advanced admin analytics endpoints unavailable:', advancedErr);
          if (!cancelled) {
            setUbpCohorts([]);
            setRetentionStats(null);
          }
        }
        // Question options are now loaded via bulkUploadOptions when questions tab is active
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load admin dashboard', err);
          setError(getErrorMessage(err, 'Unable to load admin dashboard data. Please try again.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAdminData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboardFilters = async () => {
      try {
        const response = await fetchAdminLeaderboardFilters();
        if (cancelled) return;
        const data = response.data ?? {};
        setLeaderboardFilterOptions({
          roles: Array.isArray(data.roles) ? data.roles : [],
          companies: Array.isArray(data.companies) ? data.companies : [],
          universities: Array.isArray(data.universities) ? data.universities : [],
          programs: Array.isArray(data.programs) ? data.programs : [],
          batches: Array.isArray(data.batches) ? data.batches : [],
        });
      } catch (err) {
        console.warn('Failed to load leaderboard filter options', err);
      }
    };

    loadLeaderboardFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      try {
        const response = await fetchAdminLeaderboard({
          role: leaderboardFilters.role || undefined,
          company: leaderboardFilters.company || undefined,
          program: leaderboardFilters.program || undefined,
          university: leaderboardFilters.university || undefined,
          batch: leaderboardFilters.batch || undefined,
        });

        if (cancelled) return;

        const data = response.data ?? [];
        setLeaderboard(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load leaderboard', err);
          setLeaderboard([]);
        }
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    };

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [leaderboardFilters]);

  useEffect(() => {
    let cancelled = false;

    const hasStudentFilters =
      !!studentFilters.name ||
      !!studentFilters.email ||
      !!studentFilters.status ||
      !!studentFilters.university_name ||
      !!studentFilters.program_name ||
      !!studentFilters.batch_label;

    const timeout = setTimeout(async () => {
      setStudentsLoading(true);
      try {
        const response = await fetchAdminStudents({
          page: studentPage,
          limit: 10,
          name: studentFilters.name || undefined,
          email: studentFilters.email || undefined,
          status: studentFilters.status || undefined,
          university_name: studentFilters.university_name || undefined,
          program_name: studentFilters.program_name || undefined,
          batch_label: studentFilters.batch_label || undefined,
        });

        if (cancelled) return;
        const data = response.data ?? {};
        setStudents(data.students ?? []);
        setStudentPagination(data.pagination ?? null);
        setError('');
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load students', err);
          setStudentPagination(null);
          setError(getErrorMessage(err, 'Unable to load student data. Please try again.'));
        }
      } finally {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      }
    }, hasStudentFilters ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [studentFilters, studentPage]);

  const handleStudentFilterChange = (event) => {
    const { name, value } = event.target;
    setStudentFilterInputs((prev) => ({ ...prev, [name]: value }));
  };

  const applyStudentFilters = () => {
    setStudentFilters(studentFilterInputs);
    setStudentPage(1);
  };

  const clearStudentFilters = () => {
    const empty = {
      name: '',
      email: '',
      status: '',
      university_name: '',
      program_name: '',
      batch_label: '',
    };
    setStudentFilters(empty);
    setStudentFilterInputs(empty);
    setStudentFilterOptions((prev) => ({ ...prev, programs: [], batches: [] }));
    setStudentPage(1);
  };

  // Load universities on mount for student filter dropdowns
  useEffect(() => {
    const loadUniversities = async () => {
      try {
        setStudentFilterOptionsLoading(true);
        const { data } = await fetchUniversities();
        setStudentFilterOptions((prev) => ({
          ...prev,
          universities: Array.isArray(data) ? data : [],
        }));
      } catch (e) {
        console.warn('Failed to load universities for student filters', e);
      } finally {
        setStudentFilterOptionsLoading(false);
      }
    };
    loadUniversities();
  }, []);

  // Handle university selection - load programs
  const handleStudentUniversityChange = async (e) => {
    const university = e.target.value || '';
    setStudentFilterInputs((prev) => ({
      ...prev,
      university_name: university,
      program_name: '',
      batch_label: '',
    }));
    setStudentFilterOptions((prev) => ({ ...prev, programs: [], batches: [] }));

    if (!university) return;

    try {
      const { data } = await fetchUbpPrograms(university);
      setStudentFilterOptions((prev) => ({
        ...prev,
        programs: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      console.warn('Failed to load programs for student filters', e);
    }
  };

  // Handle program selection - load batches
  const handleStudentProgramChange = async (e) => {
    const program = e.target.value || '';
    setStudentFilterInputs((prev) => ({
      ...prev,
      program_name: program,
      batch_label: '',
    }));
    setStudentFilterOptions((prev) => ({ ...prev, batches: [] }));

    const universityName = studentFilterInputs.university_name;
    if (!universityName || !program) return;

    try {
      const { data } = await fetchUbpBatches(universityName, program);
      setStudentFilterOptions((prev) => ({
        ...prev,
        batches: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      console.warn('Failed to load batches for student filters', e);
    }
  };

  // Handle batch selection
  const handleStudentBatchChange = (e) => {
    const value = e.target.value || '';
    setStudentFilterInputs((prev) => ({
      ...prev,
      batch_label: value,
    }));
  };

  useEffect(() => {
    const loadSessionUniversities = async () => {
      try {
        setSessionFilterOptionsLoading(true);
        const { data } = await fetchUniversities();
        setSessionFilterOptions((prev) => ({
          ...prev,
          universities: Array.isArray(data) ? data : [],
        }));
      } catch (e) {
        console.warn('Failed to load universities for session filters', e);
      } finally {
        setSessionFilterOptionsLoading(false);
      }
    };
    loadSessionUniversities();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSessionRoles = async () => {
      try {
        const params = {};
        const uni = sessionFilterInputs.university_name;
        const prog = sessionFilterInputs.program_name;
        const batch = sessionFilterInputs.batch_label;

        if (uni) params.university = uni;
        if (prog) params.program = prog;
        if (batch) params.batch = batch;

        const { data } = await fetchAdminRoleFilterOptions(params);
        if (cancelled) return;
        setSessionRoleOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load role filter options for sessions', err);
          setSessionRoleOptions([]);
        }
      }
    };

    loadSessionRoles();

    return () => {
      cancelled = true;
    };
  }, [
    sessionFilterInputs.university_name,
    sessionFilterInputs.program_name,
    sessionFilterInputs.batch_label,
  ]);

  const handleSessionUniversityChange = async (e) => {
    const university = e.target.value || '';
    setSessionFilterInputs((prev) => ({
      ...prev,
      university_name: university,
      program_name: '',
      batch_label: '',
    }));
    setSessionFilterOptions((prev) => ({ ...prev, programs: [], batches: [] }));

    if (!university) return;

    try {
      const { data } = await fetchUbpPrograms(university);
      setSessionFilterOptions((prev) => ({
        ...prev,
        programs: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      console.warn('Failed to load programs for session filters', e);
    }
  };

  const handleSessionProgramChange = async (e) => {
    const program = e.target.value || '';
    setSessionFilterInputs((prev) => ({
      ...prev,
      program_name: program,
      batch_label: '',
    }));
    setSessionFilterOptions((prev) => ({ ...prev, batches: [] }));

    const universityName = sessionFilterInputs.university_name;
    if (!universityName || !program) return;

    try {
      const { data } = await fetchUbpBatches(universityName, program);
      setSessionFilterOptions((prev) => ({
        ...prev,
        batches: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      console.warn('Failed to load batches for session filters', e);
    }
  };

  const handleSessionBatchChange = (e) => {
    const value = e.target.value || '';
    setSessionFilterInputs((prev) => ({
      ...prev,
      batch_label: value,
    }));
  };

  const handleViewStudentAnalytics = (studentId) => {
    if (!studentId) return;
    navigate(`/admin/student/${studentId}`);
  };

  useEffect(() => {
    let cancelled = false;

    const hasSessionFilters =
      !!sessionFilters.role ||
      !!sessionFilters.student ||
      !!sessionFilters.email ||
      !!sessionFilters.company ||
      sessionFilters.minScore !== '' ||
      sessionFilters.maxScore !== '' ||
      !!sessionFilters.university_name ||
      !!sessionFilters.program_name ||
      !!sessionFilters.batch_label;

    const timeout = setTimeout(async () => {
      setSessionsLoading(true);
      try {
        const response = await fetchAdminSessions({
          page: sessionPage,
          limit: 10,
          student_name: sessionFilters.student || undefined,
          student_email: sessionFilters.email || undefined,
          job_role: sessionFilters.role || undefined,
          company_name: sessionFilters.company || undefined,
          min_score:
            sessionFilters.minScore !== '' && !Number.isNaN(Number(sessionFilters.minScore))
              ? Number(sessionFilters.minScore)
              : undefined,
          max_score:
            sessionFilters.maxScore !== '' && !Number.isNaN(Number(sessionFilters.maxScore))
              ? Number(sessionFilters.maxScore)
              : undefined,
          university_name: sessionFilters.university_name || undefined,
          program_name: sessionFilters.program_name || undefined,
          batch_label: sessionFilters.batch_label || undefined,
        });

        if (cancelled) return;
        const data = response.data ?? {};
        setSessions(data.sessions ?? []);
        setSessionPagination(data.pagination ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load sessions', err);
          setSessionPagination(null);
          setError(getErrorMessage(err, 'Unable to load session data. Please try again.'));
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    }, hasSessionFilters ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [sessionFilters, sessionPage]);

  const handleSessionFilterChange = (event) => {
    const { name, value } = event.target;
    setSessionFilterInputs((prev) => ({ ...prev, [name]: value }));
  };

  const applySessionFilters = () => {
    setSessionFilters(sessionFilterInputs);
    setSessionPage(1);
  };

  const clearSessionFilters = () => {
    const empty = {
      role: '',
      student: '',
      email: '',
      company: '',
      minScore: '',
      maxScore: '',
      university_name: '',
      program_name: '',
      batch_label: '',
    };
    setSessionFilters(empty);
    setSessionFilterInputs(empty);
    setSessionFilterOptions((prev) => ({ ...prev, programs: [], batches: [] }));
    setSessionPage(1);
  };

  const handleLeaderboardFilterChange = (event) => {
    const { name, value } = event.target;
    setLeaderboardFilterInputs((prev) => ({ ...prev, [name]: value }));
  };

  const applyLeaderboardFilters = () => {
    setLeaderboardFilters(leaderboardFilterInputs);
  };

  const clearLeaderboardFilters = () => {
    const empty = { role: '', company: '', program: '', university: '', batch: '' };
    setLeaderboardFilters(empty);
    setLeaderboardFilterInputs(empty);
    setLeaderboardUbpOptions({ programs: [], batches: [] });
    setLeaderboardRoleOptions([]);
  };

  const handleLeaderboardUniversityChange = async (event) => {
    const university = event.target.value || '';
    setLeaderboardFilterInputs((prev) => ({
      ...prev,
      university,
      program: '',
      batch: '',
    }));
    setLeaderboardUbpOptions({ programs: [], batches: [] });

    if (!university) {
      return;
    }

    try {
      const { data } = await fetchUbpPrograms(university);
      setLeaderboardUbpOptions((prev) => ({
        ...prev,
        programs: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.warn('Failed to load programs for leaderboard filters', err);
    }
  };

  const handleLeaderboardProgramChange = async (event) => {
    const program = event.target.value || '';
    setLeaderboardFilterInputs((prev) => ({
      ...prev,
      program,
      batch: '',
    }));
    setLeaderboardUbpOptions((prev) => ({ ...prev, batches: [] }));

    const universityName = leaderboardFilterInputs.university;
    if (!universityName || !program) {
      return;
    }

    try {
      const { data } = await fetchUbpBatches(universityName, program);
      setLeaderboardUbpOptions((prev) => ({
        ...prev,
        batches: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.warn('Failed to load batches for leaderboard filters', err);
    }
  };

  const handleLeaderboardBatchChange = (event) => {
    const batch = event.target.value || '';
    setLeaderboardFilterInputs((prev) => ({
      ...prev,
      batch,
    }));
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const showToast = (message, tone = 'success') => {
    const safeMessage =
      typeof message === 'string'
        ? message
        : message && typeof message.toString === 'function'
        ? message.toString()
        : 'An unexpected error occurred';
    setToast({ message: safeMessage, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const getErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail ?? err?.message;
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (!first) return fallback;
      if (typeof first === 'string') return first;
      if (first && typeof first.msg === 'string') return first.msg;
      return fallback;
    }
    if (detail && typeof detail.msg === 'string') return detail.msg;
    return fallback;
  };

  const handleProgramRoleSubmit = async (event) => {
    event.preventDefault();
    if (programRoleLoading) return;

    const { university, program, batch, work_experience, job_roles } = programRoleMapping;
    if (!university || !program || !batch || !work_experience || !job_roles.length) {
      showToast('Select University, Program, Batch, Work Experience and at least one Role', 'error');
      return;
    }

    setProgramRoleLoading(true);
    try {
      const payload = {
        university_name: university,
        program_name: program,
        batch_label: batch,
        work_experience,
        job_roles,
      };
      const { data } = await mapProgramRoles(payload);
      const inserted = data?.inserted ?? 0;
      const skipped = data?.skipped ?? 0;
      const message = `Mapped ${inserted} role${inserted === 1 ? '' : 's'}`;
      showToast(message, 'success');

      // Also show a simple inline success message inside the mapping overlay
      setProgramRoleInlineMessage(message);

      // Immediately reflect newly mapped roles in the single/bulk upload
      // Roles dropdowns, without needing a full page refresh. We only
      // touch the options list; existing form selections are left intact.
      setBulkUploadOptions((prev) => {
        const existing = Array.isArray(prev.roles) ? prev.roles : [];
        const added = Array.isArray(job_roles) ? job_roles.filter(Boolean) : [];
        const merged = Array.from(new Set([...existing, ...added])).sort((a, b) =>
          String(a).localeCompare(String(b)),
        );
        return {
          ...prev,
          roles: merged,
        };
      });
    } catch (err) {
      console.error('Failed to map roles to program', err);
      setProgramRoleInlineMessage('');
      showToast(getErrorMessage(err, 'Failed to map roles to program'), 'error');
    } finally {
      setProgramRoleLoading(false);
    }
  };

  // Handler for question text fields (question, mandatory_skills, pre_def_answer)
  const handleQuestionFormChange = (event) => {
    const { name, value } = event.target;
    setQuestionForm((prev) => ({ ...prev, [name]: value }));
    setQuestionFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Simplified handler for bulk form - only handles file input now
  const handleBulkFileChange = (event) => {
    const { files } = event.target;
    setBulkForm((prev) => ({ ...prev, file: files?.[0] ?? null }));
  };

  // Note: All dropdowns now use MultiSelect with bulkUploadOptions

  const validateQuestionForm = () => {
    const errors = {};
    if (singleQuestionSelections.industries.length === 0) {
      errors.industries = 'At least one industry is required';
    }
    if (singleQuestionSelections.companies.length === 0) {
      errors.companies = 'At least one company is required';
    }
    if (singleQuestionSelections.roles.length === 0) {
      errors.roles = 'At least one role is required';
    }
    if (!questionForm.interview_type) {
      errors.interview_type = 'Interview type is required';
    }
    if (!questionForm.difficulty) {
      errors.difficulty = 'Difficulty is required';
    }
    if (!questionForm.question_type) {
      errors.question_type = 'Question type is required';
    }
    if (!questionForm.mandatory_skills || !questionForm.mandatory_skills.trim()) {
      errors.mandatory_skills = 'Mandatory skills is required';
    }
    if (!questionForm.question || !questionForm.question.trim()) {
      errors.question = 'Required';
    }
    setQuestionFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleQuestionFormSubmit = async (event) => {
    event.preventDefault();
    if (questionFormLoading) return;
    if (!validateQuestionForm()) {
      return;
    }
    setQuestionFormLoading(true);
    try {
      // Use the bulk upload endpoint with the question as inline data
      const formData = new FormData();
      formData.append('industries', JSON.stringify(singleQuestionSelections.industries));
      formData.append('companies', JSON.stringify(singleQuestionSelections.companies));
      formData.append('roles', JSON.stringify(singleQuestionSelections.roles));
      formData.append('work_experiences', JSON.stringify(singleQuestionSelections.work_experiences));
      
      // Create a CSV blob with the single question (interview_type, difficulty, question_type come from form)
      const csvContent = `question,mandatory_skills,predefined_answer,interview_type,difficulty,question_type\n"${questionForm.question.replace(/"/g, '""')}","${questionForm.mandatory_skills.replace(/"/g, '""')}","${(questionForm.pre_def_answer || '').replace(/"/g, '""')}","${questionForm.interview_type}","${questionForm.difficulty}","${questionForm.question_type}"`;
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('questions_file', csvBlob, 'single_question.csv');

      const response = await bulkUploadInterviewQuestions(formData);
      const inserted = response?.data?.inserted ?? 1;
      const categoryCombinations = response?.data?.category_combinations ?? null;

      setQuestionSummary({ inserted, category_combinations: categoryCombinations });
      
      // Reset form but keep selections
      setQuestionForm({
        ...questionForm,
        mandatory_skills: '',
        question: '',
        pre_def_answer: '',
      });
      setQuestionFormErrors({});
      showToast(`Successfully created ${inserted} question${inserted > 1 ? 's' : ''} across selected categories`, 'success');
      setQuestionSuccess(true);
    } catch (err) {
      console.error('Failed to create interview question', err);
      showToast(getErrorMessage(err, 'Failed to create interview question'), 'error');
    } finally {
      setQuestionFormLoading(false);
    }
  };

  const handleBulkSubmit = async (event) => {
    event.preventDefault();
    if (bulkLoading) return;
    if (!bulkForm.file) {
      showToast('Please select a CSV file to upload', 'error');
      return;
    }
    // Validate required multi-select fields
    if (bulkForm.industries.length === 0) {
      showToast('At least one Industry is required for bulk upload', 'error');
      return;
    }
    if (bulkForm.companies.length === 0) {
      showToast('At least one Company is required for bulk upload', 'error');
      return;
    }
    if (bulkForm.roles.length === 0) {
      showToast('At least one Role is required for bulk upload', 'error');
      return;
    }

    // Build FormData with JSON arrays for multi-select fields
    // interview_type, difficulty, question_type now come from CSV
    const formData = new FormData();
    formData.append('industries', JSON.stringify(bulkForm.industries));
    formData.append('companies', JSON.stringify(bulkForm.companies));
    formData.append('roles', JSON.stringify(bulkForm.roles));
    formData.append('work_experiences', JSON.stringify(bulkForm.work_experiences));
    formData.append('questions_file', bulkForm.file);

    setBulkLoading(true);
    try {
      const response = await bulkUploadInterviewQuestions(formData);
      setBulkStatus(response.data);
      showToast('Bulk upload completed');
      setBulkForm((prev) => ({ ...prev, file: null }));
    } catch (err) {
      console.error('Bulk upload failed', err);
      showToast(getErrorMessage(err, 'Bulk upload failed'), 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const dailyTrends = useMemo(() => analytics?.daily_trends ?? [], [analytics]);
  const engagementSummary = useMemo(() => insightsState?.engagement_summary ?? null, [insightsState]);
  const programPerformance = useMemo(() => insightsState?.program_performance ?? [], [insightsState]);
  const experienceBreakdown = useMemo(() => insightsState?.experience_breakdown ?? [], [insightsState]);
  const industryHotspots = useMemo(() => insightsState?.industry_company_hotspots ?? [], [insightsState]);
  const trendingRoles = useMemo(() => insightsState?.trending_roles ?? [], [insightsState]);
  const reattemptHotspots = useMemo(() => insightsState?.reattempt_hotspots ?? [], [insightsState]);

  const programChartData = useMemo(() => {
    if (!Array.isArray(programPerformance)) return [];
    return programPerformance.map((program) => ({
      ...program,
      avg_overall:
        program.completed_sessions && Number.isFinite(program.avg_overall) && program.avg_overall > 0
          ? program.avg_overall
          : null,
    }));
  }, [programPerformance]);

  const completionRates = useMemo(() => {
    if (!Array.isArray(programPerformance)) return [];
    return programPerformance.map((program) => {
      const totalSessions = (program.completed_sessions || 0) + (program.remaining_sessions || 0);
      const completionRate = totalSessions > 0 ? ((program.completed_sessions || 0) / totalSessions) * 100 : 0;
      return {
        program_name: program.program_name,
        completion_rate: Number.isFinite(completionRate) ? Math.round(completionRate) : 0,
      };
    });
  }, [programPerformance]);

  const industryVolume = useMemo(() => {
    if (!Array.isArray(industryHotspots)) return [];
    const grouped = new Map();
    industryHotspots.forEach((item) => {
      const key = item.industry || 'Unknown';
      grouped.set(key, (grouped.get(key) || 0) + (item.total_sessions || 0));
    });
    return Array.from(grouped.entries()).map(([industry, total]) => ({ industry, total_sessions: total }));
  }, [industryHotspots]);

  const companyTreemapData = useMemo(() => {
    if (!Array.isArray(industryHotspots)) return [];
    return industryHotspots.map((item) => ({ name: item.company, size: item.total_sessions || 0 }));
  }, [industryHotspots]);

  const engagementCards = useMemo(() => {
    if (!engagementSummary) return [];
    const cards = [
      {
        key: 'total-students',
        label: 'Total Students',
        value: formatNumber(engagementSummary.total_students),
        hint: 'Registered overall',
      },
      {
        key: 'active-students',
        label: 'Active (30 days)',
        value: formatNumber(engagementSummary.active_students_30_days),
        hint: 'Any session (30d)',
      },
      {
        key: 'inactive-students',
        label: 'Inactive (30 days)',
        value: formatNumber(engagementSummary.inactive_students_30_days),
        hint: 'Need outreach',
      },
      {
        key: 'avg-session',
        label: 'Avg Sessions / Active',
        value: formatScore(engagementSummary.avg_sessions_per_active),
        hint: 'Last 30 days',
      },
    ];

    return cards;
  }, [engagementSummary, retentionStats]);

  const handleViewReport = (sessionId) => {
    if (!sessionId) return;
    setActiveSession(sessionId);
  };

  const closeReportModal = () => setActiveSession(null);

  return (
    <div className="admin-page">
      <button
        type="button"
        className={`admin-hamburger admin-hamburger--floating ${isSidebarOpen ? 'is-open' : ''}`}
        onClick={toggleSidebar}
        aria-label={`${isSidebarOpen ? 'Hide' : 'Show'} navigation`}
        aria-expanded={isSidebarOpen}
        aria-controls="admin-sidebar"
      >
        <span />
        <span />
        <span />
      </button>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <div className={`admin-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <aside
          id="admin-sidebar"
          className={`admin-sidebar ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
          aria-label="Admin navigation"
        >
          <header className="admin-sidebar__head">
            <h1>Admin Panel</h1>
          </header>
          <p className="admin-sidebar__sub">Monitor student progress and session activity.</p>
          <nav className="admin-tabs" aria-label="Admin Sections">
            <button
              type="button"
              className={`admin-tab ${activeTab === 'overview' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'students' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Students
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'sessions' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              Sessions
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'analytics' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'questions' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              Interview Questions
            </button>
          </nav>
          {admin && (
            <footer className="admin-sidebar__footer" aria-label="Admin actions">
              <div className="admin-sidebar__account">
                <span className="admin-account-name">{admin.display_name || admin.email}</span>
                {onLogout && (
                  <button type="button" className="admin-button-text admin-button-text--logout" onClick={onLogout}>
                    Logout
                  </button>
                )}
              </div>
            </footer>
          )}
        </aside>

        <section
          className={`admin-content ${activeTab === 'analytics' ? 'admin-content--analytics' : ''}`}
          aria-live="polite"
        >
          {activeTab === 'overview' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <h2>Overview</h2>
                {loading && !stats ? (
                  <div className="admin-panel admin-panel--loading">Loading dashboard stats…</div>
                ) : (
                  <div className="admin-grid admin-grid--stats">
                    <article className="admin-card">
                      <h3>Total Students</h3>
                      <p className="admin-metric">{formatNumber(stats?.total_students)}</p>
                      <span className="admin-card__hint">Registered in the platform</span>
                    </article>
                    <article className="admin-card">
                      <h3>Total Sessions</h3>
                      <p className="admin-metric">{formatNumber(stats?.total_sessions)}</p>
                      <span className="admin-card__hint">Across all time</span>
                    </article>
                    <article className="admin-card">
                      <h3>Active Sessions</h3>
                      <p className="admin-metric admin-metric--accent">{formatNumber(stats?.active_sessions)}</p>
                      <span className="admin-card__hint">Currently in progress</span>
                    </article>
                    <article className="admin-card">
                      <h3>Average Score</h3>
                      <p className="admin-metric">{formatScore(stats?.avg_score)}</p>
                      <span className="admin-card__hint">Out of 5.0 scale</span>
                    </article>
                    <article className="admin-card">
                      <h3>Sessions Today</h3>
                      <p className="admin-metric">{formatNumber(stats?.today_sessions)}</p>
                      <span className="admin-card__hint">Daily activity</span>
                    </article>
                  </div>
                )}
              </section>
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Leaderboard</h2>
                  <span className="admin-section__hint">Top performers by average score</span>
                </div>
                <div className="admin-filters" role="group" aria-label="Leaderboard filters">
                  {/* University */}
                  <div className="admin-filter">
                    <label htmlFor="leaderboard-university-filter">University</label>
                    <select
                      id="leaderboard-university-filter"
                      name="university"
                      value={leaderboardFilterInputs.university}
                      onChange={handleLeaderboardUniversityChange}
                    >
                      <option value="">All universities</option>
                      {leaderboardFilterOptions.universities.map((university) => (
                        <option key={university} value={university}>
                          {university}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Program */}
                  <div className="admin-filter">
                    <label htmlFor="leaderboard-program-filter">Program</label>
                    <select
                      id="leaderboard-program-filter"
                      name="program"
                      value={leaderboardFilterInputs.program}
                      onChange={handleLeaderboardProgramChange}
                      disabled={!leaderboardFilterInputs.university}
                    >
                      <option value="">All programs</option>
                      {leaderboardUbpOptions.programs.map((program) => (
                        <option key={program} value={program}>
                          {program}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Batch */}
                  <div className="admin-filter">
                    <label htmlFor="leaderboard-batch-filter">Batch</label>
                    <select
                      id="leaderboard-batch-filter"
                      name="batch"
                      value={leaderboardFilterInputs.batch}
                      onChange={handleLeaderboardBatchChange}
                      disabled={!leaderboardFilterInputs.program}
                    >
                      <option value="">All batches</option>
                      {leaderboardUbpOptions.batches.map((batch) => (
                        <option key={batch} value={batch}>
                          {batch}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Role */}
                  <div className="admin-filter">
                    <label htmlFor="leaderboard-role-filter">Role</label>
                    <select
                      id="leaderboard-role-filter"
                      name="role"
                      value={leaderboardFilterInputs.role}
                      onChange={handleLeaderboardFilterChange}
                    >
                      <option value="">All roles</option>
                      {leaderboardRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Company */}
                  <div className="admin-filter">
                    <label htmlFor="leaderboard-company-filter">Company</label>
                    <select
                      id="leaderboard-company-filter"
                      name="company"
                      value={leaderboardFilterInputs.company}
                      onChange={handleLeaderboardFilterChange}
                    >
                      <option value="">All companies</option>
                      {leaderboardFilterOptions.companies.map((company) => (
                        <option key={company} value={company}>
                          {company}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="admin-filters__actions">
                    <button
                      type="button"
                      className="admin-button-text"
                      onClick={applyLeaderboardFilters}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="admin-button-text admin-button-text--ghost"
                      onClick={clearLeaderboardFilters}
                      disabled={
                        !leaderboardFilterInputs.role &&
                        !leaderboardFilterInputs.company &&
                        !leaderboardFilterInputs.program &&
                        !leaderboardFilterInputs.university &&
                        !leaderboardFilterInputs.batch
                      }
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="admin-panel">
                  {leaderboardLoading && leaderboard.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading leaderboard…</div>
                  ) : leaderboard.length === 0 ? (
                    <div className="admin-panel__placeholder">No leaderboard data available yet.</div>
                  ) : (
                    <ul className="admin-leaderboard">
                      {leaderboard.map((entry) => (
                        <li key={entry.student_id}>
                          <span className="admin-rank">{ordinal(entry.rank)}</span>
                          <div>
                            <div className="admin-leaderboard__name">{entry.student_name}</div>
                          </div>
                          <div className="admin-leaderboard__meta">
                            <span className={getScoreClass(entry.avg_score)}>
                              Avg {formatScore(entry.avg_score)}
                            </span>
                            <span className="admin-text--muted">
                              {formatNumber(entry.total_sessions)} session
                              {entry.total_sessions === 1 ? '' : 's'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Recent Student Progress</h2>
                </div>
                {/* Search by Name and Email */}
                <div
                  className="admin-filters admin-filters--students-main"
                  role="group"
                  aria-label="Search by name and email"
                >
                  <div className="admin-filter">
                    <label htmlFor="student-name-filter">Name</label>
                    <input
                      id="student-name-filter"
                      name="name"
                      type="search"
                      placeholder="Search by student name"
                      value={studentFilterInputs.name}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-email-filter">Email</label>
                    <input
                      id="student-email-filter"
                      name="email"
                      type="search"
                      placeholder="Search by email"
                      value={studentFilterInputs.email}
                      onChange={handleStudentFilterChange}
                    />
                  </div>
                </div>

                {/* University, Program, Batch dependent dropdowns */}
                <div className="admin-filters" role="group" aria-label="Filter by university, program, batch">
                  <div className="admin-filter">
                    <label htmlFor="student-university-filter">University</label>
                    <select
                      id="student-university-filter"
                      name="university_name"
                      value={studentFilterInputs.university_name}
                      onChange={handleStudentUniversityChange}
                      disabled={studentFilterOptionsLoading}
                    >
                      <option value="">All Universities</option>
                      {studentFilterOptions.universities.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-program-filter">Program</label>
                    <select
                      id="student-program-filter"
                      name="program_name"
                      value={studentFilterInputs.program_name}
                      onChange={handleStudentProgramChange}
                      disabled={!studentFilterInputs.university_name}
                    >
                      <option value="">All Programs</option>
                      {studentFilterOptions.programs.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="student-batch-filter">Batch</label>
                    <select
                      id="student-batch-filter"
                      name="batch_label"
                      value={studentFilterInputs.batch_label}
                      onChange={handleStudentBatchChange}
                      disabled={!studentFilterInputs.program_name}
                    >
                      <option value="">All Batches</option>
                      {studentFilterOptions.batches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status filter and Clear button */}
                <div
                  className="admin-filters admin-filters--students-status"
                  role="group"
                  aria-label="Status filter"
                >
                  <div className="admin-filter">
                    <label htmlFor="student-status-filter">Status</label>
                    <select
                      id="student-status-filter"
                      name="status"
                      value={studentFilterInputs.status}
                      onChange={handleStudentFilterChange}
                    >
                      <option value="">All</option>
                      <option value="Completed">Completed</option>
                      <option value="No Sessions">No Sessions</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="admin-button-text"
                    onClick={applyStudentFilters}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={clearStudentFilters}
                    disabled={
                      !studentFilterInputs.name &&
                      !studentFilterInputs.email &&
                      !studentFilterInputs.status &&
                      !studentFilterInputs.university_name &&
                      !studentFilterInputs.program_name &&
                      !studentFilterInputs.batch_label
                    }
                  >
                    Clear
                  </button>
                  {studentsLoading && (
                    <span className="admin-filters__status" aria-live="polite">
                      Searching…
                    </span>
                  )}
                </div>
                <div className="admin-panel">
                  {studentsLoading && students.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading students…</div>
                  ) : students.length === 0 ? (
                    <div className="admin-panel__placeholder">No student records found.</div>
                  ) : (
                    <div className="admin-table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>University</th>
                            <th>Program</th>
                            <th>Batch</th>
                            <th>Sessions</th>
                            <th>Avg. Score</th>
                            <th>Status</th>
                            <th>Last Session</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.student_id}>
                              <td>{student.name}</td>
                              <td className="admin-text--muted">{student.email}</td>
                              <td className="admin-text--muted">{student.university_name || '—'}</td>
                              <td className="admin-text--muted">{student.program_name || '—'}</td>
                              <td className="admin-text--muted">{student.batch_label || '—'}</td>
                              <td>{formatNumber(student.total_sessions)}</td>
                              <td>{formatScore(student.avg_score)}</td>
                              <td>
                                <span
                                  className={`admin-chip ${
                                    student.status === 'Active'
                                      ? 'admin-chip--success'
                                      : student.status === 'Completed'
                                      ? 'admin-chip--neutral'
                                      : 'admin-chip--muted'
                                  }`}
                                >
                                  {student.status}
                                </span>
                              </td>
                              <td>{student.last_session ? new Date(student.last_session).toLocaleDateString() : '—'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-button-text admin-button-text--ghost"
                                  onClick={() => handleViewStudentAnalytics(student.student_id)}
                                >
                                  View analytics
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {studentPagination &&
                    studentPagination.pages > 1 && (
                      <div className="admin-pagination" aria-label="Student pagination">
                        <button
                          type="button"
                          className="admin-button-text admin-button-text--ghost"
                          onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                          disabled={studentPage <= 1}
                        >
                          Previous
                        </button>
                        <span className="admin-pagination__info">
                          Page {studentPagination.page} of {studentPagination.pages}
                        </span>
                        <button
                          type="button"
                          className="admin-button-text admin-button-text--ghost"
                          onClick={() =>
                            setStudentPage((prev) =>
                              Math.min(studentPagination.pages, prev + 1),
                            )
                          }
                          disabled={studentPage >= studentPagination.pages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Recent Sessions</h2>
                </div>

                {/* Search by student name and email */}
                <div
                  className="admin-filters admin-filters--sessions-main"
                  role="group"
                  aria-label="Search by student name and email"
                >
                  <div className="admin-filter">
                    <label htmlFor="session-student-filter">Student</label>
                    <input
                      id="session-student-filter"
                      name="student"
                      type="search"
                      placeholder="Filter by student name"
                      value={sessionFilterInputs.student}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-email-filter">Email</label>
                    <input
                      id="session-email-filter"
                      name="email"
                      type="search"
                      placeholder="Filter by email"
                      value={sessionFilterInputs.email}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                </div>

                {/* Role, company, and UBP filters */}
                <div
                  className="admin-filters admin-filters--sessions-meta"
                  role="group"
                  aria-label="Session filters"
                >
                  <div className="admin-filter">
                    <label htmlFor="session-university-filter">University</label>
                    <select
                      id="session-university-filter"
                      name="university_name"
                      value={sessionFilterInputs.university_name}
                      onChange={handleSessionUniversityChange}
                      disabled={sessionFilterOptionsLoading}
                    >
                      <option value="">All universities</option>
                      {sessionFilterOptions.universities.map((university) => (
                        <option key={university} value={university}>
                          {university}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-program-filter">Program</label>
                    <select
                      id="session-program-filter"
                      name="program_name"
                      value={sessionFilterInputs.program_name}
                      onChange={handleSessionProgramChange}
                      disabled={!sessionFilterInputs.university_name}
                    >
                      <option value="">All programs</option>
                      {sessionFilterOptions.programs.map((program) => (
                        <option key={program} value={program}>
                          {program}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-batch-filter">Batch</label>
                    <select
                      id="session-batch-filter"
                      name="batch_label"
                      value={sessionFilterInputs.batch_label}
                      onChange={handleSessionBatchChange}
                      disabled={!sessionFilterInputs.program_name}
                    >
                      <option value="">All batches</option>
                      {sessionFilterOptions.batches.map((batch) => (
                        <option key={batch} value={batch}>
                          {batch}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-role-filter">Role</label>
                    <select
                      id="session-role-filter"
                      name="role"
                      value={sessionFilterInputs.role}
                      onChange={handleSessionFilterChange}
                    >
                      <option value="">All roles</option>
                      {sessionRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-company-filter">Company</label>
                    <select
                      id="session-company-filter"
                      name="company"
                      value={sessionFilterInputs.company}
                      onChange={handleSessionFilterChange}
                    >
                      <option value="">All companies</option>
                      {leaderboardFilterOptions.companies.map((company) => (
                        <option key={company} value={company}>
                          {company}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Score filters and actions */}
                <div
                  className="admin-filters admin-filters--sessions-score"
                  role="group"
                  aria-label="Session score filters"
                >
                  <div className="admin-filter">
                    <label htmlFor="session-min-score">Min Score</label>
                    <input
                      id="session-min-score"
                      name="minScore"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="5"
                      step="0.01"
                      placeholder="0.0"
                      value={sessionFilterInputs.minScore}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <div className="admin-filter">
                    <label htmlFor="session-max-score">Max Score</label>
                    <input
                      id="session-max-score"
                      name="maxScore"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="5"
                      step="0.01"
                      placeholder="5.0"
                      value={sessionFilterInputs.maxScore}
                      onChange={handleSessionFilterChange}
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-button-text"
                    onClick={applySessionFilters}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={clearSessionFilters}
                    disabled={
                      !sessionFilterInputs.role &&
                      !sessionFilterInputs.student &&
                      !sessionFilterInputs.email &&
                      !sessionFilterInputs.company &&
                      !sessionFilterInputs.minScore &&
                      !sessionFilterInputs.maxScore &&
                      !sessionFilterInputs.university_name &&
                      !sessionFilterInputs.program_name &&
                      !sessionFilterInputs.batch_label
                    }
                  >
                    Clear
                  </button>
                  {sessionsLoading && (
                    <span className="admin-filters__status" aria-live="polite">
                      Searching…
                    </span>
                  )}
                </div>
                <div className="admin-panel admin-panel--table">
                  {sessionsLoading && sessions.length === 0 ? (
                    <div className="admin-panel__placeholder">Loading sessions…</div>
                  ) : sessions.length === 0 ? (
                    <div className="admin-panel__placeholder">No sessions available.</div>
                  ) : (
                    <div className="admin-table-wrapper" role="region" aria-label="Recent interview sessions">
                      <table className="admin-table admin-table--records">
                        <thead>
                          <tr>
                            <th>Interview Role</th>
                            <th>Student</th>
                            <th>Company</th>
                            <th>Interview Type</th>
                            <th>Date &amp; Time</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((session) => {
                            const attemptLabel = typeof session.attempt_number === 'number'
                              ? `${ordinal(session.attempt_number)} attempt`
                              : null;
                            const statusClass = session.status?.toLowerCase() === 'completed'
                              ? 'admin-chip--success'
                              : 'admin-chip--neutral';

                            return (
                              <tr key={session.session_id}>
                                <td>
                                  <div className="admin-role-cell">
                                    <span className="admin-role-title">{session.job_role}</span>
                                    {attemptLabel ? (
                                      <span className={`admin-attempt-chip ${session.attempt_number > 1 ? 'repeat' : 'first'}`}>
                                        {attemptLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  <div className="admin-student-cell">
                                    <span className="admin-student-name">{session.student_name}</span>
                                  </div>
                                </td>
                                <td>{session.company_name || 'N/A'}</td>
                                <td>{session.interview_type || 'N/A'}</td>
                                <td>
                                  {(() => {
                                    const displayTime = session.completed_at || session.started_at;
                                    return displayTime ? new Date(displayTime).toLocaleString() : 'N/A';
                                  })()}
                                </td>
                                <td className={getScoreClass(session.overall_score)}>
                                  {session.overall_score != null ? formatScore(session.overall_score) : 'N/A'}
                                </td>
                                <td>
                                  <span className={`admin-chip ${statusClass}`}>{session.status}</span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="view-report-button"
                                    onClick={() => handleViewReport(session.session_id)}
                                  >
                                    View Report
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sessionPagination &&
                    sessionPagination.pages > 1 && (
                      <div className="admin-pagination" aria-label="Session pagination">
                        <button
                          type="button"
                          className="admin-button-text admin-button-text--ghost"
                          onClick={() => setSessionPage((prev) => Math.max(1, prev - 1))}
                          disabled={sessionPage <= 1}
                        >
                          Previous
                        </button>
                        <span className="admin-pagination__info">
                          Page {sessionPagination.page} of {sessionPagination.pages}
                        </span>
                        <button
                          type="button"
                          className="admin-button-text admin-button-text--ghost"
                          onClick={() =>
                            setSessionPage((prev) =>
                              Math.min(sessionPagination.pages, prev + 1),
                            )
                          }
                          disabled={sessionPage >= sessionPagination.pages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="admin-tabpanel" role="tabpanel">
              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Engagement Summary</h2>
                  <span className="admin-section__hint">Snapshot of the last 30 days.</span>
                </div>
                {loading && engagementCards.length === 0 ? (
                  <ChartPlaceholder message="Loading engagement insights…" />
                ) : engagementCards.length === 0 ? (
                  <ChartPlaceholder message="No engagement insights yet." />
                ) : (
                  <div className="admin-grid admin-grid--metrics">
                    {engagementCards.map((metric) => (
                      <article key={metric.key} className="admin-card admin-card--metric">
                        <h3>{metric.label}</h3>
                        <p className="admin-metric">{metric.value}</p>
                        {metric.hint ? <span className="admin-card__hint">{metric.hint}</span> : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Engagement Overview</h2>
                  <span className="admin-section__hint">Monitor student activity and session trends.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  <header className="admin-panel__head">
                    <h3>Engagement Trends</h3>
                    <span className="admin-section__hint">Sessions vs. completed sessions</span>
                  </header>
                  {loading && dailyTrends.length === 0 ? (
                    <ChartPlaceholder message="Loading trend data…" />
                  ) : dailyTrends.length === 0 ? (
                    <ChartPlaceholder message="Trend data unavailable." />
                  ) : (
                    <EngagementAreaChart
                      data={dailyTrends.map((trend) => ({
                        label: new Date(trend.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                        sessions: trend.sessions,
                        completed: trend.completed,
                      }))}
                    />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Program Performance</h2>
                  <span className="admin-section__hint">Compare outcomes across programs.</span>
                </div>
                <div className="admin-grid admin-grid--analytics">
                  <article className="admin-panel admin-panel--chart">
                    <header className="admin-panel__head">
                      <h3>Sessions &amp; Average Scores</h3>
                    </header>
                    {loading && programChartData.length === 0 ? (
                      <ChartPlaceholder message="Loading program metrics…" />
                    ) : programChartData.length === 0 ? (
                      <ChartPlaceholder />
                    ) : (
                      <ProgramComposedChart data={programChartData} />
                    )}
                  </article>

                  <article className="admin-panel admin-panel--chart">
                    <header className="admin-panel__head">
                      <h3>Student Distribution</h3>
                    </header>
                    {loading && programPerformance.length === 0 ? (
                      <ChartPlaceholder message="Loading distribution…" />
                    ) : programPerformance.length === 0 ? (
                      <ChartPlaceholder />
                    ) : (
                      <ProgramPieChart data={programPerformance} />
                    )}
                  </article>
                </div>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Performance</h2>
                  <span className="admin-section__hint">Compare cohorts by university, program, and batch.</span>
                </div>
                {loading && ubpCohorts.length === 0 ? (
                  <ChartPlaceholder message="Loading metrics…" />
                ) : ubpCohorts.length === 0 ? (
                  <ChartPlaceholder message="No analytics yet." />
                ) : (
                  <div className="admin-panel admin-panel--table">
                    <div className="admin-table-scroll">
                      <table className="admin-table admin-table--compact">
                        <thead>
                          <tr>
                            <th>University</th>
                            <th>Program</th>
                            <th>Batch</th>
                            <th>Students</th>
                            <th>Completed Sessions</th>
                            <th>Avg. Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ubpCohorts.slice(0, 50).map((cohort, index) => (
                            <tr key={`${cohort.university_name}-${cohort.program_name}-${cohort.batch_label}-${index}`}>
                              <td className="admin-text--muted">{cohort.university_name}</td>
                              <td>{cohort.program_name}</td>
                              <td className="admin-text--muted">{cohort.batch_label}</td>
                              <td>{formatNumber(cohort.student_count)}</td>
                              <td>{formatNumber(cohort.completed_sessions)}</td>
                              <td className={getScoreClass(cohort.avg_overall)}>{formatScore(cohort.avg_overall)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Experience Breakdown</h2>
                  <span className="admin-section__hint">Sessions and scores by work experience.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  {loading && experienceBreakdown.length === 0 ? (
                    <ChartPlaceholder message="Loading experience data…" />
                  ) : experienceBreakdown.length === 0 ? (
                    <ChartPlaceholder />
                  ) : (
                    <ExperienceHorizontalBar data={experienceBreakdown} />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Trending Roles</h2>
                  <span className="admin-section__hint">Roles with the highest number of completed sessions.</span>
                </div>
                <article className="admin-panel admin-panel--chart">
                  {loading && trendingRoles.length === 0 ? (
                    <ChartPlaceholder message="Loading role data…" />
                  ) : trendingRoles.length === 0 ? (
                    <ChartPlaceholder />
                  ) : (
                    <TrendingRolesBar data={trendingRoles} />
                  )}
                </article>
              </section>

              <section className="admin-section">
                <div className="admin-section__head">
                  <h2>Reattempt Hotspots</h2>
                  <span className="admin-section__hint">Role &amp; company pairings with repeat attempts.</span>
                </div>
                {loading && reattemptHotspots.length === 0 ? (
                  <ChartPlaceholder message="Loading reattempt data…" />
                ) : reattemptHotspots.length === 0 ? (
                  <ChartPlaceholder message="No reattempt hotspots detected yet." />
                ) : (
                  <div className="admin-panel admin-panel--table">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th>Job Role</th>
                          <th>Company</th>
                          <th>Repeat Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reattemptHotspots.map((item, index) => (
                          <tr key={`${item.job_role}-${item.company}-${index}`}>
                            <td>{item.job_role}</td>
                            <td>{item.company}</td>
                            <td>{formatNumber(item.repeat_students)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="admin-tabpanel" role="tabpanel">
              {/* Single Question Form */}
              <section className="admin-section">
                <form
                  className="admin-panel admin-panel--form admin-question-card"
                  onSubmit={handleQuestionFormSubmit}
                >
                  {/* Header */}
                  <div className="admin-question-header">
                    <div className="admin-question-header__icon">+</div>
                    <div>
                      <h2 className="admin-question-title">Add Single Question</h2>
                      <span className="admin-question-subtitle">
                        Create one question and apply it across multiple categories
                      </span>
                    </div>
                  </div>

                  {/* Target Audience Section */}
                  <div className="admin-form-section">
                    <div className="admin-form-grid admin-form-grid--bulk-meta">
                      <MultiSelect
                        label="Industries"
                        options={['No specific industry', ...bulkUploadOptions.industries]}
                        selected={singleQuestionSelections.industries}
                        onChange={(values) =>
                          setSingleQuestionSelections((prev) => {
                            const NONE = 'No specific industry';
                            const hasNonePrev = (prev.industries || []).includes(NONE);
                            const hasNoneNow = values.includes(NONE);
                            const othersNow = values.filter((v) => v !== NONE);

                            let finalValues = values;

                            if (hasNoneNow && othersNow.length > 0) {
                              if (hasNonePrev && prev.industries.length === 1) {
                                finalValues = othersNow;
                              } else if (!hasNonePrev) {
                                finalValues = [NONE];
                              } else {
                                finalValues = othersNow;
                              }
                            }

                            return { ...prev, industries: finalValues };
                          })
                        }
                        required
                      />
                      {questionFormErrors.industries && (
                        <span className="admin-form-error">{questionFormErrors.industries}</span>
                      )}

                      <MultiSelect
                        label="Companies"
                        options={bulkUploadOptions.companies}
                        selected={singleQuestionSelections.companies}
                        onChange={(values) =>
                          setSingleQuestionSelections((prev) => ({ ...prev, companies: values }))
                        }
                        required
                      />
                      {questionFormErrors.companies && (
                        <span className="admin-form-error">{questionFormErrors.companies}</span>
                      )}
                    </div>
                  </div>

                  {/* Roles & Experience Section */}
                  <div className="admin-form-section">
                    <div className="admin-form-grid admin-form-grid--bulk-meta">
                      <div>
                        <MultiSelect
                          label="Roles"
                          options={bulkUploadOptions.roles}
                          selected={singleQuestionSelections.roles}
                          onChange={(values) =>
                            setSingleQuestionSelections((prev) => ({ ...prev, roles: values }))
                          }
                          required
                          allowCreate={false}
                        />
                        {questionFormErrors.roles && (
                          <span className="admin-form-error">{questionFormErrors.roles}</span>
                        )}
                        <button
                          type="button"
                          className="admin-add-roles-link"
                          onClick={openProgramRoleMapping}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          Add new roles
                        </button>
                      </div>

                      <MultiSelect
                        label="Work Experience"
                        options={bulkUploadOptions.workExperiences}
                        selected={singleQuestionSelections.work_experiences}
                        onChange={(values) =>
                          setSingleQuestionSelections((prev) => ({
                            ...prev,
                            work_experiences: values,
                          }))
                        }
                        allowCreate={false}
                      />
                    </div>
                  </div>

                  {/* Question Configuration Section */}
                  <div className="admin-form-section">
                    <div className="admin-form-grid admin-form-grid--bulk-secondary">
                      <SingleSelectDropdown
                        label="Interview Type"
                        options={bulkUploadOptions.interviewTypes}
                        value={questionForm.interview_type || ''}
                        onChange={(option) => {
                          setQuestionForm((prev) => ({ ...prev, interview_type: option }));
                          setQuestionFormErrors((prev) => ({ ...prev, interview_type: undefined }));
                        }}
                        required
                        error={questionFormErrors.interview_type}
                      />

                      <SingleSelectDropdown
                        label="Difficulty"
                        options={DIFFICULTY_OPTIONS}
                        value={questionForm.difficulty || ''}
                        onChange={(option) => {
                          setQuestionForm((prev) => ({ ...prev, difficulty: option }));
                          setQuestionFormErrors((prev) => ({ ...prev, difficulty: undefined }));
                        }}
                        required
                        error={questionFormErrors.difficulty}
                      />

                      <SingleSelectDropdown
                        label="Question Type"
                        options={["Coding (Python)", "Coding (SQL)", "Speech Based"]}
                        value={questionForm.question_type || ''}
                        onChange={(option) => {
                          setQuestionForm((prev) => ({ ...prev, question_type: option }));
                          setQuestionFormErrors((prev) => ({ ...prev, question_type: undefined }));
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Mandatory Skills Section */}
                  <div className="admin-form-section admin-form-section--skills">
                    <div className="admin-form-field admin-form-field--mandatory-skills">
                      <label htmlFor="q-mandatory-skills">
                        Mandatory Skills<span>*</span>
                      </label>
                      <input
                        id="q-mandatory-skills"
                        name="mandatory_skills"
                        type="text"
                        value={questionForm.mandatory_skills}
                        onChange={handleQuestionFormChange}
                        placeholder="e.g., React, Node.js, SQL"
                        className="admin-input"
                        required
                      />
                      <span className="admin-form-hint">List the key technical skills required to answer this question</span>
                      {questionFormErrors.mandatory_skills && (
                        <span className="admin-form-error">{questionFormErrors.mandatory_skills}</span>
                      )}
                    </div>
                  </div>

                  {/* Question Content Section */}
                  <div className="admin-form-section">
                    <div className="admin-question-main">
                      <div className="admin-form-field">
                        <label htmlFor="q-question">
                          Question<span>*</span>
                        </label>
                        <textarea
                          id="q-question"
                          name="question"
                          value={questionForm.question}
                          onChange={handleQuestionFormChange}
                          placeholder="Enter the interview question"
                          rows="5"
                          required
                        />
                        <span className="admin-form-hint">Write your interview question clearly and concisely</span>
                        {questionFormErrors.question && (
                          <span className="admin-form-error">{questionFormErrors.question}</span>
                        )}
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="q-pre-def-answer">Predefined Answer</label>
                        <textarea
                          id="q-pre-def-answer"
                          name="pre_def_answer"
                          value={questionForm.pre_def_answer}
                          onChange={handleQuestionFormChange}
                          placeholder="Reference answer for AI evaluation"
                          rows="5"
                        />
                        <span className="admin-form-hint">Optional: Provide a model answer for evaluation reference</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="admin-form-actions admin-form-actions--question">
                    <button
                      type="button"
                      className="admin-button-text admin-button-text--ghost"
                      onClick={() => {
                        setQuestionForm({
                          mandatory_skills: '',
                          question: '',
                          pre_def_answer: '',
                          interview_type: '',
                          difficulty: '',
                          question_type: '',
                        });
                        setSingleQuestionSelections({
                          industries: [],
                          companies: [],
                          roles: [],
                          work_experiences: [],
                        });
                        setQuestionFormErrors({});
                      }}
                    >
                      Clear Form
                    </button>
                    <button
                      type="submit"
                      className="admin-button-text admin-button-text--primary"
                      disabled={questionFormLoading}
                    >
                      {questionFormLoading ? 'Creating Question...' : 'Create Question'}
                    </button>
                  </div>
                </form>
              </section>

              {/* Bulk Upload Form */}
              <section className="admin-section">
                <form
                  className="admin-panel admin-panel--form admin-question-card admin-question-card--bulk"
                  onSubmit={handleBulkSubmit}
                >
                  <div className="admin-question-header">
                    <div className="admin-question-header__icon">⬆</div>
                    <div>
                      <h2 className="admin-question-title">Bulk Upload Questions</h2>
                      <span className="admin-question-subtitle">
                        Upload multiple questions via CSV. Select multiple categories to apply the same questions across different contexts.
                      </span>
                    </div>
                  </div>

                  <div className="admin-form-grid admin-form-grid--bulk-meta">
                    <MultiSelect
                      label="Industries"
                      options={['No specific industry', ...bulkUploadOptions.industries]}
                      selected={bulkForm.industries}
                      onChange={(values) =>
                        setBulkForm((prev) => {
                          const NONE = 'No specific industry';
                          const prevValues = prev.industries || [];
                          const hasNonePrev = prevValues.includes(NONE);
                          const hasNoneNow = values.includes(NONE);
                          const othersNow = values.filter((v) => v !== NONE);

                          let finalValues = values;

                          if (hasNoneNow && othersNow.length > 0) {
                            if (hasNonePrev && prevValues.length === 1) {
                              finalValues = othersNow;
                            } else if (!hasNonePrev) {
                              finalValues = [NONE];
                            } else {
                              finalValues = othersNow;
                            }
                          }

                          return { ...prev, industries: finalValues };
                        })
                      }
                      required
                    />

                    <MultiSelect
                      label="Companies"
                      options={bulkUploadOptions.companies}
                      selected={bulkForm.companies}
                      onChange={(values) =>
                        setBulkForm((prev) => ({ ...prev, companies: values }))
                      }
                      required
                    />
                  </div>

                  <div className="admin-form-grid admin-form-grid--bulk-meta">
                    <div>
                      <MultiSelect
                        label="Roles"
                        options={bulkUploadOptions.roles}
                        selected={bulkForm.roles}
                        onChange={(values) =>
                          setBulkForm((prev) => ({ ...prev, roles: values }))
                        }
                        required
                        allowCreate={false}
                      />
                      <button
                        type="button"
                        className="admin-add-roles-link"
                        onClick={openProgramRoleMapping}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add new roles
                      </button>
                    </div>

                    <MultiSelect
                      label="Work Experience"
                      options={bulkUploadOptions.workExperiences}
                      selected={bulkForm.work_experiences}
                      onChange={(values) =>
                        setBulkForm((prev) => ({ ...prev, work_experiences: values }))
                      }
                      required
                      allowCreate={false}
                    />
                  </div>

                  <div className="admin-bulk-upload-file">
                    <label className="admin-bulk-upload-label">
                      CSV File<span>*</span>
                    </label>
                    <label htmlFor="bulk-file" className="admin-bulk-upload-dropzone">
                      {bulkForm.file ? (
                        <>
                          <span className="admin-bulk-upload-dropzone__title">{bulkForm.file.name}</span>
                          <span className="admin-bulk-upload-dropzone__subtitle">Click to change file</span>
                        </>
                      ) : (
                        <>
                          <span className="admin-bulk-upload-dropzone__title">Click to upload CSV file</span>
                        </>
                      )}
                    </label>
                    <input
                      id="bulk-file"
                      type="file"
                      name="file"
                      accept=".csv"
                      onChange={handleBulkFileChange}
                      required
                      className="admin-bulk-upload-input"
                    />
                  </div>

                  <div className="admin-bulk-csv-info">
                    <div className="admin-bulk-upload-note">
                      <span className="admin-bulk-upload-note__icon">i</span>
                      <span>
                        <strong>CSV Format Requirements:</strong> Your CSV file must contain the following columns
                        (column names must match exactly):
                      </span>
                    </div>
                    <ul className="admin-bulk-csv-columns admin-bulk-csv-columns--left">
                      <li>
                        <strong>question</strong>
                        <span className="admin-required">*</span> - The interview question
                      </li>
                      <li>
                        <strong>mandatory_skills</strong>
                        <span className="admin-required">*</span> - Comma-separated skills
                      </li>
                      <li>
                        <strong>predefined_answer</strong> - Reference answer for AI evaluation (optional)
                      </li>
                      <li>
                        <strong>interview_type</strong>
                        <span className="admin-required">*</span> - Technical, HR, or Behavioral
                      </li>
                      <li>
                        <strong>difficulty</strong>
                        <span className="admin-required">*</span> - Easy, Medium, or Hard
                      </li>
                      <li>
                        <strong>question_type</strong>
                        <span className="admin-required">*</span> - Coding (Python), Coding (SQL), or Speech Based
                      </li>
                    </ul>
                  </div>

                  <div className="admin-form-actions admin-form-actions--spread">
                    <button
                      type="submit"
                      className="admin-button-text"
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? 'Uploading...' : 'Upload CSV'}
                    </button>
                    <button
                      type="button"
                      className="admin-button-text admin-button-text--ghost"
                      onClick={() => {
                        copySampleCsv();
                        showToast('Sample CSV downloaded');
                      }}
                    >
                      Download Sample CSV
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </section>
      </div>

      {questionSuccess && (
        <QuestionSuccessModal
          summary={questionSummary}
          onClose={() => {
            setQuestionSuccess(false);
            setQuestionSummary(null);
            if (
              typeof window !== 'undefined' &&
              window.location &&
              typeof window.location.reload === 'function'
            ) {
              window.location.reload();
            }
          }}
        />
      )}

      {bulkStatus && <BulkUploadSummaryModal result={bulkStatus} onClose={handleBulkSummaryClose} />}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.tone || 'success'}`}>
          {toast.message}
        </div>
      )}

      {showProgramRoleMappingCard && (
        <div className="feedback-modal-backdrop feedback-modal-backdrop--light" role="dialog" aria-modal="true">
          <div className="feedback-modal feedback-modal--light">
            <header className="feedback-modal__header feedback-modal__header--roles">
              <button
                type="button"
                className="feedback-modal__back"
                onClick={closeProgramRoleMapping}
              >
                ← Back to questions
              </button>
              <h3>Map Job Roles to Program</h3>
              <button
                type="button"
                className="feedback-modal__close"
                onClick={closeProgramRoleMapping}
              >
                ✕
              </button>
            </header>
            <div className="feedback-modal__body">
              <form
                className="admin-panel admin-panel--form admin-question-card"
                onSubmit={handleProgramRoleSubmit}
              >
                <div className="admin-form-section">
                  <div className="admin-form-grid admin-form-grid--bulk-meta">
                    <div className="admin-form-field">
                      <label htmlFor="program-role-university">University</label>
                      <select
                        id="program-role-university"
                        value={programRoleMapping.university}
                        onChange={handleProgramRoleUniversityChange}
                        required
                      >
                        <option value="">Select university</option>
                        {programRoleOptions.universities.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-form-field">
                      <label htmlFor="program-role-program">Program</label>
                      <select
                        id="program-role-program"
                        value={programRoleMapping.program}
                        onChange={handleProgramRoleProgramChange}
                        required
                        disabled={!programRoleMapping.university}
                      >
                        <option value="">Select program</option>
                        {programRoleOptions.programs.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-form-field">
                      <label htmlFor="program-role-batch">Batch</label>
                      <select
                        id="program-role-batch"
                        value={programRoleMapping.batch}
                        onChange={handleProgramRoleBatchChange}
                        required
                        disabled={!programRoleMapping.program}
                      >
                        <option value="">Select batch</option>
                        {programRoleOptions.batches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-form-field">
                      <label htmlFor="program-role-workexp">Work Experience</label>
                      <select
                        id="program-role-workexp"
                        value={programRoleMapping.work_experience}
                        onChange={handleProgramRoleWorkExperienceChange}
                        required
                      >
                        <option value="">Select work experience</option>
                        {programRoleOptions.work_experiences?.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="admin-form-section">
                  <CreatableMultiSelect
                    label="New Job Roles for this Program"
                    options={programRoleOptions.job_roles || []}
                    selected={programRoleMapping.job_roles}
                    onChange={handleProgramRoleJobRolesChange}
                    required
                    placeholder="Type to add new job roles for this program"
                  />
                </div>

                {programRoleInlineMessage && (
                  <div className="admin-inline-success">{programRoleInlineMessage}</div>
                )}

                <div className="admin-form-actions admin-form-actions--spread">
                  <button
                    type="button"
                    className="admin-button-text admin-button-text--ghost"
                    onClick={closeProgramRoleMapping}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-button-text admin-button-text--primary"
                    disabled={programRoleLoading}
                  >
                    {programRoleLoading ? 'Mapping roles…' : 'Map Roles to Program'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeSession ? (
        <div className="feedback-modal-backdrop" role="dialog" aria-modal="true">
          <div className="feedback-modal">
            <header className="feedback-modal__header">
              <h3>Session Feedback Report</h3>
              <button type="button" className="feedback-modal__close" onClick={closeReportModal}>
                ✕
              </button>
            </header>
            <div className="feedback-modal__body">
              <FeedbackScreen sessionId={activeSession} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPage;

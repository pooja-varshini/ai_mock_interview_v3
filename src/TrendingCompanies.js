import React from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { fetchJobRolesByWorkExperience, fetchPublicInterviewTypes, fetchPublicWorkExperienceLevels } from './api';
// We will create this CSS file next
import './TrendingCompanies.css';

// Placeholder for company logos - in a real app, these would be imported or URLs

const CustomDropdown = ({ placeholder, value, options, onChange, onOpen }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    const toggleDropdown = () => {
        setIsOpen((prev) => !prev);
        if (!isOpen && typeof onOpen === 'function') {
            onOpen();
        }
    };

    const closeDropdown = React.useCallback(() => setIsOpen(false), []);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                closeDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [closeDropdown]);

    const handleSelect = (option) => {
        if (typeof onChange === 'function') {
            onChange(option);
        }
        closeDropdown();
    };

    return (
        <div className={`custom-dropdown${isOpen ? ' open' : ''}`} ref={dropdownRef}>
            <button
                type="button"
                className="custom-dropdown__trigger"
                onClick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={`custom-dropdown__value${value ? '' : ' placeholder'}`}>
                    {value || placeholder}
                </span>
                <FiChevronDown className="custom-dropdown__icon" />
            </button>
            {isOpen && (
                <ul className="custom-dropdown__menu" role="listbox">
                    {options.length === 0 ? (
                        <li className="custom-dropdown__option custom-dropdown__option--empty">No options available</li>
                    ) : (
                        options.map((option) => (
                            <li key={option}>
                                <button
                                    type="button"
                                    role="option"
                                    className={`custom-dropdown__option${option === value ? ' selected' : ''}`}
                                    aria-selected={option === value}
                                    onClick={() => handleSelect(option)}
                                >
                                    {option}
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

const TrendingCompanies = ({
    companies = [],
    allRoles = [],
    interviewTypes = [],
    workExperienceOptions = [],
    programName = '',
    onSelectRole,
    onQuickStart,
    onInteract,
    manualResetTick = 0,
    externalSelections = { company: '', industry: '', interviewType: '', workExperience: '' },
}) => {
    const [activeCompany, setActiveCompany] = React.useState(null);

    const safeCompanyList = Array.isArray(companies) ? companies : [];
    const safeRoleList = Array.isArray(allRoles) ? allRoles : [];
    const [safeInterviewTypes, setSafeInterviewTypes] = React.useState(Array.isArray(interviewTypes) ? interviewTypes : []);
    const [safeWorkExperience, setSafeWorkExperience] = React.useState(Array.isArray(workExperienceOptions) ? workExperienceOptions : []);

    React.useEffect(() => {
        setSafeInterviewTypes(Array.isArray(interviewTypes) ? interviewTypes : []);
    }, [interviewTypes]);

    React.useEffect(() => {
        setSafeWorkExperience(Array.isArray(workExperienceOptions) ? workExperienceOptions : []);
    }, [workExperienceOptions]);

    React.useEffect(() => {
        if (!safeInterviewTypes || safeInterviewTypes.length === 0) {
            fetchPublicInterviewTypes()
                .then(res => setSafeInterviewTypes(Array.isArray(res.data) ? res.data : []))
                .catch(() => setSafeInterviewTypes([]));
        }
    }, [safeInterviewTypes?.length]);

    React.useEffect(() => {
        if (!safeWorkExperience || safeWorkExperience.length === 0) {
            fetchPublicWorkExperienceLevels()
                .then(res => setSafeWorkExperience(Array.isArray(res.data) ? res.data : []))
                .catch(() => setSafeWorkExperience([]));
        }
    }, [safeWorkExperience?.length]);

    React.useEffect(() => {
        if (manualResetTick > 0) {
            setActiveCompany(null);
        }
    }, [manualResetTick]);

    React.useEffect(() => {
        // External selections coming from main form should not influence card state, but we keep placeholder for future sync.
    }, [externalSelections]);

    const handleCardSelection = (companyName) => {
        setActiveCompany(companyName);
        if (typeof onInteract === 'function') {
            onInteract({ company: companyName });
        }
    };

    return (
        <section className="trending-companies-section card">
            <h2>Top Trending Companies</h2>
            <div className="companies-grid">
                {safeCompanyList.map(company => (
                    <CompanyCard
                        key={company.name}
                        company={company}
                        allRoles={safeRoleList}
                        interviewTypes={safeInterviewTypes}
                        workExperienceOptions={safeWorkExperience}
                        programName={programName}
                        onSelectRole={onSelectRole}
                        onQuickStart={onQuickStart}
                        isActive={activeCompany === company.name}
                        onCardSelection={handleCardSelection}
                        activeCompany={activeCompany}
                        onInteract={onInteract}
                    />
                ))}
            </div>
        </section>
    );
};

const CompanyCard = ({
    company,
    allRoles,
    interviewTypes,
    workExperienceOptions,
    programName,
    onSelectRole,
    onQuickStart,
    isActive,
    onCardSelection,
    activeCompany,
    onInteract,
}) => {
    const [selectedRole, setSelectedRole] = React.useState('');
    const [selectedInterviewType, setSelectedInterviewType] = React.useState('');
    const [selectedWorkExperience, setSelectedWorkExperience] = React.useState('');
    const [filteredRoles, setFilteredRoles] = React.useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);
    const [showConfirm, setShowConfirm] = React.useState(false);

    const resetSelections = React.useCallback(() => {
        setSelectedRole('');
        setSelectedInterviewType('');
        setSelectedWorkExperience('');
        setFilteredRoles([]);
        setShowConfirm(false);
    }, []);

    const ensureActiveCard = React.useCallback(() => {
        if (typeof onCardSelection === 'function') {
            onCardSelection(company.name);
        }
    }, [company.name, onCardSelection]);

    const handleRoleSelection = (role) => {
        setSelectedRole(role);
        ensureActiveCard();
        if (onSelectRole) {
            onSelectRole(company.name, role);
        }
    };

    const startQuickInterview = () => {
        if (
            onQuickStart &&
            selectedRole &&
            selectedInterviewType &&
            selectedWorkExperience
        ) {
            onQuickStart({
                company: company.name,
                role: selectedRole,
                industry: company.industry || '',
                interviewType: selectedInterviewType,
                workExperience: selectedWorkExperience,
                reset: () => {
                    setSelectedRole('');
                    setSelectedInterviewType('');
                    setSelectedWorkExperience('');
                    setShowConfirm(false);
                    if (typeof onCardSelection === 'function') {
                        onCardSelection(null);
                    }
                },
            });
        }
    };

    React.useEffect(() => {
        if (!isActive) {
            setShowConfirm(false);
        }
    }, [isActive]);

    React.useEffect(() => {
        if (activeCompany !== company.name) {
            resetSelections();
        }
    }, [activeCompany, company.name, resetSelections]);

    React.useEffect(() => {
        if (selectedWorkExperience) {
            setIsLoadingRoles(true);
            fetchJobRolesByWorkExperience(selectedWorkExperience, programName)
                .then((response) => {
                    setFilteredRoles(response.data || []);
                    setSelectedRole('');
                })
                .catch((error) => {
                    console.error('Error fetching job roles by work experience:', error);
                    setFilteredRoles([]);
                    setSelectedRole('');
                })
                .finally(() => {
                    setIsLoadingRoles(false);
                });
        } else {
            setFilteredRoles([]);
            setSelectedRole('');
        }
    }, [selectedWorkExperience, programName]);

    React.useEffect(() => {
        if (isActive) {
            setShowConfirm(Boolean(selectedRole && selectedInterviewType && selectedWorkExperience));
        }
    }, [isActive, selectedRole, selectedInterviewType, selectedWorkExperience]);

    React.useEffect(() => {
        // When program changes, reset role selection so the user re-selects with new context
        setFilteredRoles([]);
        setSelectedRole('');
    }, [programName]);

    return (
        <div className={`company-card${isActive ? ' company-card--active' : ''}`}>
            <img 
                src={company.logo || `https://logo.clearbit.com/${company.name.toLowerCase().replace(/\s+/g, '')}.com`}
                alt={`${company.name} logo`} 
                className="company-logo" 
            />
            <p className="company-name">{company.name}</p>
            <CustomDropdown
                placeholder="Interview Type"
                value={selectedInterviewType}
                options={interviewTypes}
                onOpen={ensureActiveCard}
                onChange={(value) => {
                    ensureActiveCard();
                    setSelectedInterviewType(value);
                    if (typeof onInteract === 'function') {
                        onInteract({ interviewType: value });
                    }
                }}
            />
            <CustomDropdown
                placeholder="Work Experience"
                value={selectedWorkExperience}
                options={workExperienceOptions}
                onOpen={ensureActiveCard}
                onChange={(value) => {
                    ensureActiveCard();
                    setSelectedWorkExperience(value);
                    if (typeof onInteract === 'function') {
                        onInteract({ workExperience: value });
                    }
                }}
            />
            <CustomDropdown
                placeholder={isLoadingRoles ? "Loading roles..." : "Job Role"}
                value={selectedRole}
                options={filteredRoles.length > 0 ? filteredRoles : []}
                onChange={(value) => {
                    handleRoleSelection(value);
                    if (typeof onInteract === 'function') {
                        onInteract({ jobRole: value });
                    }
                }}
                onOpen={ensureActiveCard}
            />
            <div className="role-confirm-placeholder" style={{ height: showConfirm && isActive ? '52px' : '0px' }}>
                {showConfirm && isActive ? (
                    <div className="role-confirm-panel">
                        <button className="quick-start-button" onClick={startQuickInterview}>
                            Launch Interview
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default TrendingCompanies;

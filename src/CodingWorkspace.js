import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';

import { fetchPistonRuntimes, executeWithPiston } from './api';

const DEFAULT_CODE = '# Write your answer here\n';

const CODE_TEMPLATES = {
  python: '# Write your answer here\n',
  javascript: `// Write your answer here\nfunction solve() {\n  return '';\n}\n\nconsole.log(solve());\n`,
  typescript: `// Write your answer here\nfunction solve(): string {\n  return '';\n}\n\nconsole.log(solve());\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your answer here\n        System.out.println("Hello, world!");\n    }\n}\n`,
  c: `#include <stdio.h>\n\nint main(void) {\n    // Write your answer here\n    printf("Hello, world!\\n");\n    return 0;\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your answer here\n    cout << "Hello, world!" << endl;\n    return 0;\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your answer here\n    fmt.Println("Hello, world!")\n}\n`,
  ruby: `# Write your answer here\nputs 'Hello, world!'\n`,
  php: `<?php\n// Write your answer here\necho "Hello, world!\\n";\n`,
  rust: `fn main() {\n    // Write your answer here\n    println!("Hello, world!");\n}\n`,
  swift: `import Foundation\n\n// Write your answer here\nprint("Hello, world!")\n`,
  kotlin: `fun main() {\n    // Write your answer here\n    println("Hello, world!")\n}\n`,
  mysql: `-- Write your answer here\nSELECT VERSION();\n`,
  sql: `-- Write your answer here\nSELECT 1;\n`,
  sqlite: `-- Write your answer here\nSELECT sqlite_version();\n`,
  postgres: `-- Write your answer here\nSELECT version();\n`,
};

const MONACO_LANGUAGE_MAP = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  node: 'javascript',
  nodejs: 'javascript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cplusplus: 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  r: 'r',
  perl: 'perl',
  pascal: 'pascal',
  lua: 'lua',
  haskell: 'haskell',
  elixir: 'elixir',
  mysql: 'sql',
  sql: 'sql',
  sqlite: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
};

const runtimeToKey = (runtime) => `${runtime.language}@${runtime.version}`;

const LANGUAGE_DISPLAY_NAMES = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  mysql: 'MySQL',
  sql: 'SQL',
  sqlite: 'SQLite',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
};

const formatLanguageLabel = (language) => {
  if (!language) return '';
  const normalized = language.toLowerCase();
  if (LANGUAGE_DISPLAY_NAMES[normalized]) {
    return LANGUAGE_DISPLAY_NAMES[normalized];
  }
  return language
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const CORE_LANGUAGE_ORDER = [
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
  'ruby',
  'mysql',
  'sql',
  'sqlite',
  'postgres',
  'postgresql',
];
const CORE_LANGUAGE_SET = new Set(CORE_LANGUAGE_ORDER);

const PLACEHOLDER_PATTERNS = [
  /^#\s*write your answer here\s*$/i,
  /^\/\/\s*write your answer here\s*$/i,
  /^--\s*write your answer here\s*$/i,
  /^\/\*\s*write your answer here\s*\*\/$/i,
];

const matchesLanguage = (runtime, targetLanguage) => {
  if (!runtime || !targetLanguage) return false;
  const normalized = targetLanguage.toLowerCase();
  if (runtime.language.toLowerCase() === normalized) {
    return true;
  }
  return (runtime.aliases || []).some((alias) => alias.toLowerCase() === normalized);
};

const isRuntimeAllowed = (runtime, allowedLanguages) => {
  if (!Array.isArray(allowedLanguages) || allowedLanguages.length === 0) {
    return true;
  }
  const normalizedAllowed = new Set(allowedLanguages.map((lang) => lang.toLowerCase()));
  const langLower = runtime.language.toLowerCase();
  if (normalizedAllowed.has(langLower)) {
    return true;
  }
  return (runtime.aliases || []).some((alias) => normalizedAllowed.has(alias.toLowerCase()));
};

const isSqliteRuntime = (runtime) => {
  if (!runtime) return false;
  const langLower = runtime.language.toLowerCase();
  if (langLower.includes('sqlite')) {
    return true;
  }
  return (runtime.aliases || []).some((alias) => alias.toLowerCase().includes('sqlite'));
};

const findRuntimeForLanguage = (runtimes, targetLanguage, allowedLanguages) => {
  if (!Array.isArray(runtimes) || runtimes.length === 0) return null;
  const normalizedTarget = targetLanguage?.toLowerCase();

  const filteredRuntimes = Array.isArray(allowedLanguages) && allowedLanguages.length > 0
    ? runtimes.filter((runtime) => isRuntimeAllowed(runtime, allowedLanguages))
    : runtimes;

  if (!filteredRuntimes.length) {
    return null;
  }

  if (normalizedTarget) {
    const directMatch = filteredRuntimes.find((runtime) => matchesLanguage(runtime, normalizedTarget));
    if (directMatch) {
      return directMatch;
    }
  }

  return filteredRuntimes[0];
};

const getMonacoLanguageId = (runtime) => {
  if (!runtime) return 'plaintext';
  const lang = runtime.language.toLowerCase();
  if (MONACO_LANGUAGE_MAP[lang]) {
    return MONACO_LANGUAGE_MAP[lang];
  }
  for (const alias of runtime.aliases || []) {
    const aliasLower = alias.toLowerCase();
    if (MONACO_LANGUAGE_MAP[aliasLower]) {
      return MONACO_LANGUAGE_MAP[aliasLower];
    }
  }
  return 'plaintext';
};

const matchesCoreLanguage = (runtime) => {
  const langLower = runtime.language.toLowerCase();
  if (CORE_LANGUAGE_SET.has(langLower)) {
    return true;
  }
  return (runtime.aliases || []).some((alias) => CORE_LANGUAGE_SET.has(alias.toLowerCase()));
};

export default function CodingWorkspace({
  onSubmit,
  isSubmitting,
  initialCode = DEFAULT_CODE,
  supportedLanguages,
  defaultLanguage,
  theme = 'vs-dark',
  runShortcut = 'Ctrl+Enter',
  onRunShortcut,
  editorHeight = '420px',
  addToast,
  enforceSqlOnly = false,
}) {
  const [code, setCode] = useState(initialCode);
  const [stdinText, setStdinText] = useState('');
  const [stdoutText, setStdoutText] = useState('');
  const [stderrText, setStderrText] = useState('');
  const [internalError, setInternalError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [lastRunSucceeded, setLastRunSucceeded] = useState(null);
  const [runtimes, setRuntimes] = useState([]);
  const [selectedRuntimeKey, setSelectedRuntimeKey] = useState(null);
  const [loadingRuntimes, setLoadingRuntimes] = useState(true);
  const [userLanguageOverride, setUserLanguageOverride] = useState(false);
  const [languageCodeMap, setLanguageCodeMap] = useState({});
  const [manualInputEnabled, setManualInputEnabled] = useState(false);
  const consoleRef = useRef(null);
  const manualInputRef = useRef(null);

  const normalizedDefaultLanguage = (defaultLanguage || 'python').toLowerCase();
  const normalizedSupportedLanguages = useMemo(() => {
    if (!Array.isArray(supportedLanguages) || supportedLanguages.length === 0) {
      return null;
    }
    const lowercased = supportedLanguages
      .map((lang) => (typeof lang === 'string' ? lang.toLowerCase() : ''))
      .filter(Boolean);

    if (enforceSqlOnly) {
      return lowercased.filter((lang) => lang.includes('sql'));
    }

    return lowercased.filter((lang) => !lang.includes('sqlite'));
  }, [supportedLanguages, enforceSqlOnly]);

  const effectiveCoreLanguages = useMemo(() => (
    enforceSqlOnly
      ? CORE_LANGUAGE_ORDER
      : CORE_LANGUAGE_ORDER.filter((lang) => !lang.includes('sqlite'))
  ), [enforceSqlOnly]);

  const selectedRuntime = useMemo(() => {
    if (!selectedRuntimeKey) return null;
    return runtimes.find((runtime) => runtimeToKey(runtime) === selectedRuntimeKey) || null;
  }, [runtimes, selectedRuntimeKey]);

  const monacoLanguageId = useMemo(() => getMonacoLanguageId(selectedRuntime), [selectedRuntime]);

  const runtimeDisabled = isRunning || loadingRuntimes || !selectedRuntime;
  const submitDisabled = isSubmitting;

  const lineCount = useMemo(() => {
    if (!code) {
      return 1;
    }
    return (code.match(/\n/g)?.length || 0) + 1;
  }, [code]);

  const workspaceClassName = useMemo(() => {
    const classes = ['coding-workspace', 'neo-layout'];
    if (hasRun) {
      classes.push('neo-layout--expanded');
    }
    if (lineCount > 80) {
      classes.push('coding-workspace--xl');
    } else if (lineCount > 40) {
      classes.push('coding-workspace--lg');
    }
    return classes.join(' ');
  }, [hasRun, lineCount]);

  const notify = React.useCallback((message, type = 'warning') => {
    if (typeof addToast === 'function') {
      addToast(message, type);
    }
  }, [addToast]);

  const hasMeaningfulCode = React.useCallback((value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return false;
    }
    return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
  }, []);

  const resetOutputs = () => {
    setStdoutText('');
    setStderrText('');
    setInternalError(null);
    setLastRunSucceeded(null);
  };

  const compilerMessage = useMemo(() => {
    if (!hasRun) {
      return 'Run the code to view compiler results';
    }
    return lastRunSucceeded
      ? 'Compilation successful'
      : stderrText || internalError || 'Unknown compilation error';
  }, [hasRun, lastRunSucceeded, stderrText, internalError]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRuntimes(true);

    fetchPistonRuntimes()
      .then((response) => {
        if (cancelled) return;
        const fetched = Array.isArray(response?.data) ? response.data : [];
        // Sort alphabetically for stable dropdown order
        fetched.sort((a, b) => a.language.localeCompare(b.language) || a.version.localeCompare(b.version));
        setRuntimes(fetched);
        setLoadingRuntimes(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to fetch Piston runtimes:', error);
        setLoadingRuntimes(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimes.length) {
      return;
    }

    if (userLanguageOverride && selectedRuntimeKey) {
      // Respect user's manual selection unless a new question resets it
      return;
    }

    const allowedList = normalizedSupportedLanguages && normalizedSupportedLanguages.length
      ? normalizedSupportedLanguages
      : effectiveCoreLanguages;

    const candidateRuntimes = runtimes.filter((runtime) => {
      const isSqlite = isSqliteRuntime(runtime);
      if (enforceSqlOnly) {
        if (!isSqlite) {
          return false;
        }
      } else if (isSqlite) {
        return false;
      }

      if (normalizedSupportedLanguages && normalizedSupportedLanguages.length) {
        return isRuntimeAllowed(runtime, allowedList);
      }

      return matchesCoreLanguage(runtime) && isRuntimeAllowed(runtime, allowedList);
    });

    const runtime = findRuntimeForLanguage(candidateRuntimes, normalizedDefaultLanguage, allowedList);
    if (runtime) {
      setSelectedRuntimeKey(runtimeToKey(runtime));
      return;
    }

    if (!selectedRuntimeKey) {
      const firstAllowed = candidateRuntimes.find((rt) => matchesCoreLanguage(rt) && isRuntimeAllowed(rt, allowedList));
      if (firstAllowed) {
        setSelectedRuntimeKey(runtimeToKey(firstAllowed));
      }
    }
  }, [
    runtimes,
    normalizedDefaultLanguage,
    normalizedSupportedLanguages,
    selectedRuntimeKey,
    userLanguageOverride,
    effectiveCoreLanguages,
    enforceSqlOnly,
  ]);

  useEffect(() => {
    setLanguageCodeMap({});
    setCode(initialCode || DEFAULT_CODE);
    setStdinText('');
    setManualInputEnabled(false);
    resetOutputs();
    setHasRun(false);
  }, [initialCode]);

  useEffect(() => {
    if (!selectedRuntimeKey) {
      return;
    }
    setLanguageCodeMap((prev) => {
      const existing = prev[selectedRuntimeKey];
      if (existing === code) {
        return prev;
      }
      return {
        ...prev,
        [selectedRuntimeKey]: code,
      };
    });
  }, [code, selectedRuntimeKey]);

  useEffect(() => {
    // Reset user language override when a new question arrives
    setUserLanguageOverride(false);
  }, [initialCode, normalizedDefaultLanguage]);

  const runCode = async () => {
    if (!hasMeaningfulCode(code)) {
      notify('Please write your solution before running.');
      return {
        stdout: '',
        stderr: '',
        success: false,
        internalError: 'No code to execute',
        language: selectedRuntime?.language || normalizedDefaultLanguage,
      };
    }

    if (!selectedRuntime) {
      notify('Please select a language runtime before running.');
      return {
        stdout: '',
        stderr: '',
        success: false,
        internalError: 'No runtime selected',
        language: normalizedDefaultLanguage,
      };
    }

    if (isRunning) {
      return {
        stdout: stdoutText,
        stderr: stderrText,
        success: lastRunSucceeded,
        internalError,
        language: selectedRuntime?.language || normalizedDefaultLanguage,
      };
    }

    setIsRunning(true);
    setStdoutText('');
    setStderrText('');
    setInternalError(null);
    // Don't reset lastRunSucceeded until we have new results

    try {
      const runtimeLanguage = selectedRuntime.language;
      const runtimeLanguageLower = runtimeLanguage.toLowerCase();
      const fallbackExtension = (selectedRuntime.aliases?.[0]?.toLowerCase()) || runtimeLanguageLower;
      const fileName = (() => {
        switch (runtimeLanguageLower) {
          case 'python':
            return 'main.py';
          case 'javascript':
          case 'node':
          case 'nodejs':
            return 'main.js';
          case 'typescript':
          case 'ts':
            return 'main.ts';
          case 'java':
            return 'Main.java';
          case 'c':
            return 'main.c';
          case 'cpp':
          case 'cplusplus':
            return 'main.cpp';
          case 'csharp':
          case 'c#':
            return 'Program.cs';
          case 'go':
          case 'golang':
            return 'main.go';
          case 'rust':
            return 'main.rs';
          case 'ruby':
            return 'main.rb';
          case 'php':
            return 'main.php';
          case 'swift':
            return 'main.swift';
          case 'kotlin':
            return 'Main.kt';
          default:
            return `main.${fallbackExtension || runtimeLanguageLower}`;
        }
      })();

      const payload = {
        language: selectedRuntime.language,
        version: selectedRuntime.version,
        stdin: stdinText,
        files: [
          {
            name: fileName,
            content: code,
          },
        ],
      };

      const response = await executeWithPiston(payload);
      const data = response?.data || {};
      const runResult = data.run || {};
      const compileResult = data.compile || {};

      const stdoutValue = runResult.output ?? runResult.stdout ?? '';
      const stderrSegments = [];
      if (compileResult.output || compileResult.stderr) {
        stderrSegments.push(compileResult.output || compileResult.stderr);
      }
      if (runResult.stderr) {
        stderrSegments.push(runResult.stderr);
      }
      const stderrCombined = stderrSegments.join('\n').trim();
      const success = (compileResult.code == null || compileResult.code === 0) && runResult.code === 0;

      setStdoutText(stdoutValue);
      setStderrText(stderrCombined);
      setInternalError(null);
      setLastRunSucceeded(success);
      setHasRun(true);

      return {
        stdout: stdoutValue,
        stderr: stderrCombined,
        success,
        internalError: null,
        language: selectedRuntime.language,
      };
    } catch (error) {
      console.error('Error executing code via Piston:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to execute code.';
      setInternalError(errorMessage);
      // Set lastRunSucceeded after error is set
      setLastRunSucceeded(false);
      setHasRun(true);

      return {
        stdout: '',
        stderr: '',
        success: false,
        internalError: errorMessage,
        language: selectedRuntime?.language || normalizedDefaultLanguage,
      };
    } finally {
      setIsRunning(false);
      requestAnimationFrame(() => {
        if (consoleRef.current) {
          const element = consoleRef.current;
          const scrollOptions = { top: element.scrollHeight, behavior: 'smooth' };

          if (typeof element.scrollTo === 'function') {
            element.scrollTo(scrollOptions);
          } else {
            element.scrollTop = element.scrollHeight;
          }
        }
      });
    }
  };

  const handleSubmit = async () => {
    if (!hasMeaningfulCode(code)) {
      notify('Please write your solution before submitting.');
      return;
    }

    if (!hasRun) {
      notify('Please run your code before submitting.');
      return;
    }

    if (!selectedRuntime) {
      notify('Please select a language runtime before submitting.');
      return;
    }

    let latest = {
      stdout: stdoutText,
      stderr: stderrText,
      success: lastRunSucceeded,
      internalError,
      language: selectedRuntime?.language || normalizedDefaultLanguage,
    };

    onSubmit({
      code,
      stdin: stdinText,
      stdout: latest?.stdout ?? stdoutText,
      stderr: latest?.stderr ?? stderrText,
      success: latest?.success ?? false,
      internalError: latest?.internalError || internalError,
      hasRun: hasRun || Boolean(latest),
      language: latest?.language || selectedRuntime?.language || normalizedDefaultLanguage,
    });
  };

  const handleLanguageChange = (event) => {
    const value = event.target.value;
    setSelectedRuntimeKey(value);
    setUserLanguageOverride(true);
    resetOutputs();
    setHasRun(false);

    const runtime = runtimes.find((rt) => runtimeToKey(rt) === value);
    if (runtime) {
      const runtimeLang = runtime.language.toLowerCase();
      const template = CODE_TEMPLATES[runtimeLang];
      const storedCode = languageCodeMap[value];

      if (storedCode != null) {
        setCode(storedCode);
      } else if (template) {
        setCode(template);
      } else {
        setCode('');
      }
    }
  };

  const languageOptions = useMemo(() => {
    if (!runtimes.length) return [];

    const allowedList = normalizedSupportedLanguages && normalizedSupportedLanguages.length
      ? normalizedSupportedLanguages
      : effectiveCoreLanguages;

    const applicableRuntimes = runtimes.filter((runtime) => {
      const isSqlite = isSqliteRuntime(runtime);
      if (enforceSqlOnly) {
        if (!isSqlite) {
          return false;
        }
      } else if (isSqlite) {
        return false;
      }

      if (normalizedSupportedLanguages && normalizedSupportedLanguages.length) {
        return isRuntimeAllowed(runtime, allowedList);
      }

      return matchesCoreLanguage(runtime) && isRuntimeAllowed(runtime, allowedList);
    });

    applicableRuntimes.sort((a, b) => {
      const aLang = a.language.toLowerCase();
      const bLang = b.language.toLowerCase();

      if (normalizedSupportedLanguages && normalizedSupportedLanguages.length) {
        const aIndex = allowedList.indexOf(aLang);
        const bIndex = allowedList.indexOf(bLang);
        if (aIndex !== bIndex) {
          return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
        }
      } else {
        const aIndex = effectiveCoreLanguages.indexOf(aLang);
        const bIndex = effectiveCoreLanguages.indexOf(bLang);
        const orderDiff = (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
        if (orderDiff !== 0) return orderDiff;
      }

      return a.version.localeCompare(b.version);
    });

    const seenLanguages = new Set();
    const primaryRuntimes = [];

    for (const runtime of applicableRuntimes) {
      const langLower = runtime.language.toLowerCase();
      if (seenLanguages.has(langLower)) {
        continue;
      }
      seenLanguages.add(langLower);
      primaryRuntimes.push(runtime);
    }

    return primaryRuntimes.map((runtime) => ({
      key: runtimeToKey(runtime),
      label: formatLanguageLabel(runtime.language),
    }));
  }, [runtimes, normalizedSupportedLanguages, effectiveCoreLanguages, enforceSqlOnly]);

  return (
    <div className={workspaceClassName}>
      <div className="neo-toolbar">
        <div className="neo-toolbar__left">
          <label htmlFor="coding-language-select" className="neo-toolbar__label">Language</label>
          <select
            id="coding-language-select"
            className="coding-language-select"
            value={selectedRuntimeKey || ''}
            disabled={loadingRuntimes || !languageOptions.length}
            onChange={handleLanguageChange}
          >
            {languageOptions.length === 0 && (
              <option value="">{loadingRuntimes ? 'Loading…' : 'No runtimes available'}</option>
            )}
            {languageOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="neo-toolbar__right">
          <button
            type="button"
            className="coding-button secondary"
            onClick={runCode}
            disabled={runtimeDisabled}
          >
            {isRunning ? 'Running…' : 'Run code'}
          </button>
          <button
            type="button"
            className="coding-button primary"
            onClick={handleSubmit}
            disabled={submitDisabled}
          >
            {isSubmitting ? 'Submitting…' : 'Submit & next'}
          </button>
        </div>
      </div>

      <Split
        className="neo-split-container"
        direction="vertical"
        sizes={[90, 10]}
        minSize={[120, 80]}
        expandToMin={false}
        gutterSize={8}
        snapOffset={0}
        dragInterval={1}
        cursor="row-resize"
      >
        <div className="neo-editor">
          <Editor
            height="100%"
            language={monacoLanguageId}
            defaultLanguage={monacoLanguageId}
            theme="vs-dark"
            value={code}
            defaultValue={initialCode}
            onChange={(value) => setCode(value ?? '')}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              scrollbar: {
                alwaysConsumeMouseWheel: false,
              },
            }}
          />
        </div>

        <div className="neo-runner" ref={consoleRef}>
        <div className="neo-runner__header">
          <div className="neo-runner__title">Execution Console</div>
          <label className="neo-runner__manual-toggle">
            <input
              type="checkbox"
              checked={manualInputEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setManualInputEnabled(enabled);
                if (!enabled) {
                  setStdinText('');
                }
              }}
            />
            <span>Manual input</span>
          </label>
        </div>

        {manualInputEnabled && (
          <div className="neo-runner__manual">
            <label htmlFor="coding-stdin">Provide input</label>
            <textarea
              id="coding-stdin"
              value={stdinText}
              onChange={(event) => setStdinText(event.target.value)}
              placeholder="Type manual input here"
              ref={manualInputRef}
            />
          </div>
        )}

        {hasRun && (
          <div className="neo-runner__results">
            <div className={`neo-runner__message ${lastRunSucceeded ? 'success' : 'error'}`}>
              <label>Compiler message</label>
              <pre aria-live="polite">{compilerMessage}</pre>
            </div>
            {lastRunSucceeded ? (
              <div className="neo-runner__output">
                <label>Output</label>
                <pre aria-live="polite">{stdoutText || '— No output —'}</pre>
              </div>
            ) : null}
          </div>
        )}
        </div>
      </Split>
    </div>
  );
}

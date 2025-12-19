import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    MiniMap,
    Controls,
    Background,
    MarkerType,
    Handle,
    Position,
    ConnectionMode,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './SystemDesignCanvas.css';

const COMPONENT_CATEGORIES = [
    {
        id: 'client-entry',
        title: 'Client / Entry',
        nodes: [
            { label: 'Users / Clients', icon: '👥', color: '#3b82f6', borderColor: '#60a5fa' },
            { label: 'Web App', icon: '💻', color: '#2563eb', borderColor: '#93c5fd' },
            { label: 'Mobile App', icon: '📱', color: '#0ea5e9', borderColor: '#7dd3fc' },
            { label: 'DNS', icon: '🌐', color: '#0891b2', borderColor: '#67e8f9' },
            { label: 'CDN', icon: '🚀', color: '#1d4ed8', borderColor: '#60a5fa' },
            { label: 'Webhook Processor', icon: '🔔', color: '#0f766e', borderColor: '#34d399' },
        ],
    },
    {
        id: 'traffic',
        title: 'Traffic Management',
        nodes: [
            { label: 'Load Balancer', icon: '⚖️', color: '#a855f7', borderColor: '#c084fc' },
            { label: 'API Gateway', icon: '🌀', color: '#8b5cf6', borderColor: '#d8b4fe' },
            { label: 'Reverse Proxy', icon: '🔁', color: '#7c3aed', borderColor: '#c4b5fd' },
            { label: 'Web Server', icon: '🖥️', color: '#6d28d9', borderColor: '#b39bfc' },
            { label: 'Rate Limiter', icon: '⏱️', color: '#fb923c', borderColor: '#fdba74' },
            { label: 'WAF', icon: '🛡️', color: '#f97316', borderColor: '#fdba74' },
        ],
    },
    {
        id: 'application',
        title: 'Application Layer',
        nodes: [
            { label: 'Application Server', icon: '⚙️', color: '#c026d3', borderColor: '#f472b6' },
            { label: 'Microservice', icon: '🧩', color: '#db2777', borderColor: '#f9a8d4' },
            { label: 'Backend Service', icon: '🛠️', color: '#e11d48', borderColor: '#fda4af' },
            { label: 'Serverless Function', icon: '⚡', color: '#e879f9', borderColor: '#f5d0fe' },
            { label: 'Search Service', icon: '🔍', color: '#ef4444', borderColor: '#fca5a5' },
            { label: 'Notification Service', icon: '📣', color: '#facc15', borderColor: '#fde047' },
            { label: 'Feature Flag Service', icon: '🚩', color: '#f97316', borderColor: '#fdba74' },
            { label: 'Health Check Service', icon: '🩺', color: '#22d3ee', borderColor: '#bae6fd' },
        ],
    },
    {
        id: 'compute',
        title: 'Compute',
        nodes: [
            { label: 'Virtual Machine', icon: '🧮', color: '#0ea5e9', borderColor: '#38bdf8' },
            { label: 'Container / Pod', icon: '🐳', color: '#0284c7', borderColor: '#7dd3fc' },
            { label: 'Auto-Scaling Group', icon: '📈', color: '#2563eb', borderColor: '#93c5fd' },
        ],
    },
    {
        id: 'data',
        title: 'Data Layer',
        nodes: [
            { label: 'Relational Database', icon: '🗄️', color: '#2563eb', borderColor: '#bae6fd' },
            { label: 'NoSQL Database', icon: '🧱', color: '#1d4ed8', borderColor: '#93c5fd' },
            { label: 'Cache', icon: '⚡', color: '#f97316', borderColor: '#fdba74' },
            { label: 'Object Storage', icon: '🗂️', color: '#f59e0b', borderColor: '#fcd34d' },
            { label: 'Distributed Cache', icon: '🧊', color: '#0ea5e9', borderColor: '#38bdf8' },
            { label: 'Session Store', icon: '🧠', color: '#a855f7', borderColor: '#c084fc' },
            { label: 'File Server', icon: '📁', color: '#f472b6', borderColor: '#fbcfe8' },
        ],
    },
    {
        id: 'messaging',
        title: 'Messaging & Async',
        nodes: [
            { label: 'Message Queue', icon: '📬', color: '#f59e0b', borderColor: '#fde68a' },
            { label: 'Event Stream', icon: '🌊', color: '#06b6d4', borderColor: '#67e8f9' },
            { label: 'Background Worker', icon: '🛠️', color: '#10b981', borderColor: '#6ee7b7' },
            { label: 'Scheduler', icon: '🗓️', color: '#a3e635', borderColor: '#bef264' },
            { label: 'Job Queue', icon: '📂', color: '#facc15', borderColor: '#fde047' },
            { label: 'Dead Letter Queue', icon: '📦', color: '#fb7185', borderColor: '#fda4af' },
        ],
    },
    {
        id: 'networking',
        title: 'Networking',
        nodes: [
            { label: 'VPC / Network Boundary', icon: '🕸️', color: '#9333ea', borderColor: '#d8b4fe' },
            { label: 'Subnet', icon: '📡', color: '#7e22ce', borderColor: '#c084fc' },
            { label: 'Firewall', icon: '🔥', color: '#ea580c', borderColor: '#fdba74' },
            { label: 'NAT Gateway', icon: '🌐', color: '#0f766e', borderColor: '#34d399' },
            { label: 'Service Discovery', icon: '🧭', color: '#a855f7', borderColor: '#ddd6fe' },
            { label: 'Configuration Server', icon: '⚙️', color: '#7c3aed', borderColor: '#c4b5fd' },
        ],
    },
    {
        id: 'security',
        title: 'Security',
        nodes: [
            { label: 'Auth / AuthZ', icon: '🛡️', color: '#ef4444', borderColor: '#fca5a5' },
            { label: 'IAM / Roles', icon: '🧾', color: '#f97316', borderColor: '#fdba74' },
            { label: 'Secrets Manager', icon: '🔐', color: '#10b981', borderColor: '#6ee7b7' },
            { label: 'Encryption Service', icon: '🧬', color: '#14b8a6', borderColor: '#5eead4' },
        ],
    },
    {
        id: 'observability',
        title: 'Observability',
        nodes: [
            { label: 'Logging', icon: '📝', color: '#22d3ee', borderColor: '#bae6fd' },
            { label: 'Metrics / Monitoring', icon: '📊', color: '#0ea5e9', borderColor: '#7dd3fc' },
            { label: 'Alerting', icon: '🚨', color: '#fb7185', borderColor: '#fecdd3' },
        ],
    },
    {
        id: 'devops',
        title: 'DevOps / Reliability',
        nodes: [
            { label: 'CI/CD Pipeline', icon: '🔁', color: '#f472b6', borderColor: '#fbcfe8' },
            { label: 'Configuration Mgmt', icon: '🧾', color: '#c084fc', borderColor: '#ddd6fe' },
            { label: 'Backup / Recovery', icon: '💾', color: '#06b6d4', borderColor: '#67e8f9' },
            { label: 'Failover / Multi-Region', icon: '🌍', color: '#22d3ee', borderColor: '#a5f3fc' },
        ],
    },
];

const CustomNode = ({ data, selected }) => (
    <div
        className="custom-node"
        style={{
            background: data.color,
            borderColor: selected ? '#fef08a' : data.borderColor,
            borderWidth: selected ? 3 : 2,
            borderStyle: 'solid',
        }}
    >
        <div className="custom-node__label">
            {data.icon ? `${data.icon} ` : ''}{data.label}
        </div>
        {data.description && (
            <div className="custom-node__description">{data.description}</div>
        )}
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
        <Handle type="target" position={Position.Left} />
    </div>
);

const nodeTypes = { customNode: CustomNode };

const defaultEdgeOptions = {
    type: 'smoothstep',
    markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#f472b6',
    },
    style: {
        strokeWidth: 2,
        stroke: '#f472b6',
    },
    animated: true,
};

const FlowCanvas = ({ onDiagramChange, initialDiagram }) => {
    const reactFlowWrapper = useRef(null);
    const connectingNodeId = useRef(null);
    const { screenToFlowPosition } = useReactFlow();

    // Parse initial diagram if provided
    const parsedInitial = useMemo(() => {
        if (!initialDiagram) return { nodes: [], edges: [] };
        try {
            const parsed = JSON.parse(initialDiagram);
            return {
                nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
                edges: Array.isArray(parsed.edges) ? parsed.edges : [],
            };
        } catch {
            return { nodes: [], edges: [] };
        }
    }, [initialDiagram]);

    const [nodes, setNodes] = useState(parsedInitial.nodes);
    const [edges, setEdges] = useState(parsedInitial.edges);
    const [selection, setSelection] = useState({ nodes: [], edges: [] });
    const [isEdgeLabelModalOpen, setIsEdgeLabelModalOpen] = useState(false);
    const [edgeLabelDraft, setEdgeLabelDraft] = useState('');
    const [edgeEditingId, setEdgeEditingId] = useState(null);
    const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
    const [nodeDraft, setNodeDraft] = useState({ id: null, label: '', description: '' });
    const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
    const [customNodeDraft, setCustomNodeDraft] = useState({ label: '', description: '', color: '#6366f1' });
    const [collapsedCategories, setCollapsedCategories] = useState(() => new Set(COMPONENT_CATEGORIES.map((c) => c.id)));
    const [history, setHistory] = useState([]);
    const historyPointer = useRef(-1);
    const importInputRef = useRef(null);

    const pushHistory = useCallback((nextNodes, nextEdges) => {
        setHistory((prev) => {
            const snapshots = prev.slice(0, historyPointer.current + 1);
            const snapshot = {
                nodes: nextNodes,
                edges: nextEdges,
            };
            const updated = [...snapshots, snapshot].slice(-50);
            historyPointer.current = updated.length - 1;
            return updated;
        });
    }, []);

    useEffect(() => {
        pushHistory(nodes, edges);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (typeof onDiagramChange === 'function') {
            onDiagramChange(JSON.stringify({ nodes, edges }));
        }
    }, [nodes, edges, onDiagramChange]);

    const onNodesChange = useCallback((changes) => {
        setNodes((nds) => {
            const next = applyNodeChanges(changes, nds);
            pushHistory(next, edges);
            return next;
        });
    }, [edges, pushHistory]);

    const onEdgesChange = useCallback((changes) => {
        setEdges((eds) => {
            const next = applyEdgeChanges(changes, eds);
            pushHistory(nodes, next);
            return next;
        });
    }, [nodes, pushHistory]);

    const onConnect = useCallback((connection) => {
        const id = `edge_${Date.now()}`;
        const newEdge = {
            ...connection,
            id,
            type: 'smoothstep',
            label: '',
            data: { description: '' },
        };
        setEdges((eds) => {
            const next = addEdge(newEdge, eds);
            pushHistory(nodes, next);
            return next;
        });
        setEdgeEditingId(id);
        setEdgeLabelDraft('');
        setIsEdgeLabelModalOpen(true);
    }, [nodes, pushHistory]);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/reactflow');
        if (!raw) return;
        const data = JSON.parse(raw);
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });
        const id = `node_${Date.now()}`;
        const newNode = {
            id,
            type: 'customNode',
            position,
            data: {
                label: data.label,
                description: data.description || '',
                color: data.color,
                borderColor: data.borderColor,
                icon: data.icon,
            },
        };
        setNodes((nds) => {
            const next = [...nds, newNode];
            pushHistory(next, edges);
            return next;
        });
    }, [edges, pushHistory, screenToFlowPosition]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDeleteSelected = useCallback(() => {
        if (selection.nodes.length === 0 && selection.edges.length === 0) {
            return;
        }
        setNodes((nds) => {
            const filtered = nds.filter((node) => !selection.nodes.find((sel) => sel.id === node.id));
            pushHistory(filtered, edges);
            return filtered;
        });
        setEdges((eds) => {
            const filtered = eds.filter((edge) => !selection.edges.find((sel) => sel.id === edge.id));
            pushHistory(nodes, filtered);
            return filtered;
        });
        setSelection({ nodes: [], edges: [] });
    }, [edges, nodes, selection, pushHistory]);

    useEffect(() => {
        const handler = (event) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                onDeleteSelected();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onDeleteSelected]);

    const handleExportDiagram = useCallback(() => {
        const payload = JSON.stringify({ nodes, edges }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `system-design-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges]);

    const handleImportDiagram = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
                    setNodes(parsed.nodes);
                    setEdges(parsed.edges);
                    pushHistory(parsed.nodes, parsed.edges);
                }
            } catch (error) {
                console.error('Failed to import diagram', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [pushHistory]);

    const handleUndo = useCallback(() => {
        if (historyPointer.current <= 0) return;
        historyPointer.current -= 1;
        const snapshot = history[historyPointer.current];
        if (snapshot) {
            setNodes(snapshot.nodes);
            setEdges(snapshot.edges);
        }
    }, [history]);

    const onNodeDoubleClick = useCallback((_event, node) => {
        setNodeDraft({
            id: node.id,
            label: node.data.label,
            description: node.data.description || '',
        });
        setIsNodeModalOpen(true);
    }, []);

    const onEdgeDoubleClick = useCallback((_event, edge) => {
        setEdgeEditingId(edge.id);
        setEdgeLabelDraft(edge.label || '');
        setIsEdgeLabelModalOpen(true);
    }, []);

    const onSaveNodeLabel = useCallback(() => {
        if (!nodeDraft.id) {
            setIsNodeModalOpen(false);
            return;
        }
        setNodes((nds) => nds.map((node) => {
            if (node.id === nodeDraft.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: nodeDraft.label,
                        description: nodeDraft.description,
                    },
                };
            }
            return node;
        }));
        setIsNodeModalOpen(false);
        setNodeDraft({ id: null, label: '', description: '' });
    }, [nodeDraft]);

    const onSaveEdgeLabel = useCallback(() => {
        if (!edgeEditingId) {
            setIsEdgeLabelModalOpen(false);
            return;
        }
        setEdges((eds) => eds.map((edge) => {
            if (edge.id === edgeEditingId) {
                return {
                    ...edge,
                    label: edgeLabelDraft,
                };
            }
            return edge;
        }));
        setIsEdgeLabelModalOpen(false);
        setEdgeLabelDraft('');
        setEdgeEditingId(null);
    }, [edgeEditingId, edgeLabelDraft]);

    const handleClearCanvas = useCallback(() => {
        setNodes([]);
        setEdges([]);
        pushHistory([], []);
    }, [pushHistory]);

    const handleAddCustomNode = useCallback(() => {
        setIsAddNodeModalOpen(true);
        setCustomNodeDraft({ label: '', description: '', color: '#6366f1' });
    }, []);

    const saveCustomNode = useCallback(() => {
        if (!customNodeDraft.label.trim()) {
            return;
        }
        const position = { x: Math.random() * 200, y: Math.random() * 200 };
        const id = `node_${Date.now()}`;
        const newNode = {
            id,
            type: 'customNode',
            position,
            data: {
                label: customNodeDraft.label.trim(),
                description: customNodeDraft.description.trim(),
                color: customNodeDraft.color,
                borderColor: '#ffffff',
                icon: '🧩',
            },
        };
        setNodes((nds) => {
            const next = [...nds, newNode];
            pushHistory(next, edges);
            return next;
        });
        setIsAddNodeModalOpen(false);
    }, [customNodeDraft, edges, pushHistory]);

    const onSelectionChange = useCallback((changes) => {
        setSelection({
            nodes: changes.nodes || [],
            edges: changes.edges || [],
        });
    }, []);

    const toggleCategory = useCallback((id) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    return (
        <div className="system-design-canvas">
            <aside className="system-design-sidebar">
                <h3>System Design Blocks</h3>
                {COMPONENT_CATEGORIES.map((category) => {
                    const isCollapsed = collapsedCategories.has(category.id);
                    return (
                        <div key={category.id} className="component-category">
                            <div
                                className="component-category__header"
                                onClick={() => toggleCategory(category.id)}
                            >
                                <span>{category.title}</span>
                                <span>{isCollapsed ? '+' : '-'}</span>
                            </div>
                            {!isCollapsed && (
                                <div className="component-list">
                                    {category.nodes.map((node) => (
                                        <div
                                            key={node.label}
                                            className="component-pill"
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData(
                                                    'application/reactflow',
                                                    JSON.stringify(node),
                                                );
                                                event.dataTransfer.effectAllowed = 'move';
                                            }}
                                        >
                                            <span>{node.icon}</span>
                                            {node.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </aside>
            <div className="system-design-main" ref={reactFlowWrapper}>
                <div className="system-design-toolbar">
                    <button type="button" onClick={handleAddCustomNode}>Add Custom Node</button>
                    <button type="button" onClick={handleUndo} disabled={historyPointer.current <= 0}>Undo</button>
                    <button type="button" onClick={onDeleteSelected} disabled={selection.nodes.length === 0 && selection.edges.length === 0}>
                        Delete Selected
                    </button>
                    <button type="button" onClick={handleClearCanvas}>Clear</button>
                    <button type="button" onClick={handleExportDiagram}>Export JSON</button>
                    <button type="button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
                </div>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    defaultEdgeOptions={defaultEdgeOptions}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    minZoom={0.3}
                    maxZoom={2}
                    connectionMode={ConnectionMode.Loose}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onEdgeDoubleClick={onEdgeDoubleClick}
                    onSelectionChange={onSelectionChange}
                >
                    <MiniMap />
                    <Controls />
                    <Background variant="dots" gap={20} size={2} color="rgba(140, 120, 200, 0.55)" />
                </ReactFlow>
                {nodes.length === 0 && (
                    <div className="system-design-empty-state">
                        Drag components from the left to begin your architecture.
                    </div>
                )}
                <input
                    type="file"
                    accept="application/json"
                    className="system-design-import-input"
                    ref={importInputRef}
                    onChange={handleImportDiagram}
                />
            </div>

            {isEdgeLabelModalOpen && (
                <div className="system-design-modal-overlay">
                    <div className="system-design-modal">
                        <h4>Edge Label</h4>
                        <div className="system-design-modal__field">
                            <label className="system-design-modal__field-label" htmlFor="edge-description">
                                Connection summary
                            </label>
                            <textarea
                                id="edge-description"
                                value={edgeLabelDraft}
                                onChange={(event) => setEdgeLabelDraft(event.target.value)}
                                placeholder="Describe how these components interact…"
                            />
                        </div>
                        <div className="system-design-modal__actions">
                            <button type="button" className="secondary" onClick={() => setIsEdgeLabelModalOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="primary" onClick={onSaveEdgeLabel}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isNodeModalOpen && (
                <div className="system-design-modal-overlay">
                    <div className="system-design-modal">
                        <h4>Edit Component</h4>
                        <div className="system-design-modal__field">
                            <label className="system-design-modal__field-label" htmlFor="node-label">
                                Component name
                            </label>
                            <input
                                id="node-label"
                                value={nodeDraft.label}
                                onChange={(event) => setNodeDraft((prev) => ({ ...prev, label: event.target.value }))}
                                placeholder="e.g. API Gateway"
                            />
                        </div>
                        <div className="system-design-modal__field">
                            <label className="system-design-modal__field-label" htmlFor="node-description">
                                Description
                            </label>
                            <textarea
                                id="node-description"
                                value={nodeDraft.description}
                                onChange={(event) => setNodeDraft((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Optional notes about responsibilities, scaling, etc."
                            />
                        </div>
                        <div className="system-design-modal__actions">
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => setIsNodeModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" className="primary" onClick={onSaveNodeLabel}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAddNodeModalOpen && (
                <div className="system-design-modal-overlay">
                    <div className="system-design-modal">
                        <h4>Create Custom Component</h4>
                        <div className="system-design-modal__field">
                            <label className="system-design-modal__field-label" htmlFor="custom-label">
                                Component name
                            </label>
                            <input
                                id="custom-label"
                                value={customNodeDraft.label}
                                onChange={(event) => setCustomNodeDraft((prev) => ({ ...prev, label: event.target.value }))}
                                placeholder="Name your component"
                            />
                        </div>
                        <label className="system-design-modal__field system-design-modal__color-field">
                            <span className="system-design-modal__field-label">Color</span>
                            <input
                                type="color"
                                value={customNodeDraft.color}
                                onChange={(event) => setCustomNodeDraft((prev) => ({ ...prev, color: event.target.value }))}
                            />
                        </label>
                        <div className="system-design-modal__actions">
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => setIsAddNodeModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" className="primary" onClick={saveCustomNode}>
                                Add Component
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SystemDesignCanvas = ({ onDiagramChange, initialDiagram }) => (
    <div className="system-design-wrapper">
        <ReactFlowProvider>
            <FlowCanvas onDiagramChange={onDiagramChange} initialDiagram={initialDiagram} />
        </ReactFlowProvider>
    </div>
);

export default SystemDesignCanvas;

import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, Handle, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import './SystemDesignViewer.css';

const CustomNode = ({ data }) => {
    const bgColor = data.bgColor || data.color || '#1e1e2f';
    const style = {
        background: bgColor,
        borderColor: data.borderColor || '#6366f1',
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 120,
        textAlign: 'center',
        color: '#fff',
        boxShadow: `0 4px 12px ${bgColor}40`,
        position: 'relative',
    };

    return (
        <div style={style}>
            {data.icon && <span style={{ marginRight: 6 }}>{data.icon}</span>}
            <strong>{data.label}</strong>
            {data.description && (
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 4 }}>
                    {data.description}
                </div>
            )}
            {/* Handles for edge connections - same as SystemDesignCanvas */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
            <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
        </div>
    );
};

const nodeTypes = { default: CustomNode, custom: CustomNode, customNode: CustomNode };

const DiagramCanvas = ({ nodes, edges, title }) => {
    // Debug logging
    console.log('[SystemDesignViewer] DiagramCanvas received:', { 
        nodesCount: nodes?.length, 
        edgesCount: edges?.length,
        edges: edges 
    });

    const processedNodes = useMemo(() => {
        if (!Array.isArray(nodes) || nodes.length === 0) return [];
        
        // Use AI positions directly - no extra processing
        return nodes.map((node) => ({
            ...node,
            type: node.type || 'default',
            position: node.position || { x: 0, y: 0 },
            draggable: false,
            selectable: false,
        }));
    }, [nodes]);

    const processedEdges = useMemo(() => {
        if (!Array.isArray(edges)) return [];
        console.log('[SystemDesignViewer] Processing edges:', edges);
        return edges.map((edge, index) => {
            // Remove null sourceHandle/targetHandle to prevent ReactFlow errors
            const cleanEdge = { ...edge };
            if (cleanEdge.sourceHandle === null || cleanEdge.sourceHandle === 'null') {
                delete cleanEdge.sourceHandle;
            }
            if (cleanEdge.targetHandle === null || cleanEdge.targetHandle === 'null') {
                delete cleanEdge.targetHandle;
            }
            return {
                ...cleanEdge,
                // Ensure edge has an id (required by ReactFlow)
                id: edge.id || `edge-${index}-${edge.source}-${edge.target}`,
                type: 'smoothstep',
                animated: edge.animated !== false,
                style: { stroke: '#a78bfa', strokeWidth: 2 },
                labelStyle: { fill: '#fff', fontSize: 11, fontWeight: 600 },
                labelBgStyle: { fill: '#0f0a1f', fillOpacity: 1, stroke: '#a78bfa', strokeWidth: 1 },
                labelBgPadding: [8, 4],
                labelShowBg: true,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#a78bfa',
                    width: 20,
                    height: 20,
                },
            };
        });
    }, [edges]);

    if (processedNodes.length === 0) {
        return (
            <div className="system-design-viewer-empty">
                No diagram available
            </div>
        );
    }

    return (
        <div className="system-design-viewer">
            {title && <h4 className="system-design-viewer__title">{title}</h4>}
            <div className="system-design-viewer__canvas">
                <ReactFlow
                    nodes={processedNodes}
                    edges={processedEdges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3, minZoom: 0.4, maxZoom: 1 }}
                    minZoom={0.2}
                    maxZoom={1.5}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        style: { stroke: '#a78bfa', strokeWidth: 2 },
                        animated: true,
                    }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    panOnDrag={true}
                    zoomOnScroll={true}
                >
                    <Background variant="dots" gap={16} size={1} color="rgba(140, 120, 200, 0.3)" />
                    <Controls showInteractive={false} />
                    <MiniMap
                        nodeColor={(node) => node.data?.bgColor || node.data?.color || '#6366f1'}
                        maskColor="rgba(10, 8, 20, 0.8)"
                    />
                </ReactFlow>
            </div>
        </div>
    );
};

const SystemDesignViewer = ({ diagram, title }) => {
    const parsedDiagram = useMemo(() => {
        if (!diagram) return null;
        if (typeof diagram === 'object') return diagram;
        try {
            return JSON.parse(diagram);
        } catch {
            return null;
        }
    }, [diagram]);

    if (!parsedDiagram || !parsedDiagram.nodes) {
        return null;
    }

    return (
        <ReactFlowProvider>
            <DiagramCanvas
                nodes={parsedDiagram.nodes}
                edges={parsedDiagram.edges || []}
                title={title}
            />
        </ReactFlowProvider>
    );
};

export default SystemDesignViewer;

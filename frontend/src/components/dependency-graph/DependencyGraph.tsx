import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MigrationNode } from './MigrationNode';
import { useTheme } from '@/hooks/use-theme';
import type { DependencyGraph as DependencyGraphData } from '@/lib/migration-graph';

interface DependencyGraphProps {
  graph: DependencyGraphData;
}

const nodeTypes = { migration: MigrationNode };

const edgeColors: Record<string, string> = {
  'creates-for': '#22c55e',     // green
  'modifies-after': '#f59e0b',  // amber
  'drops-created': '#ef4444',   // red
};

/**
 * Lays out migration nodes in a horizontal flow (left to right by version).
 * Nodes are arranged in rows when there are many migrations.
 */
function layoutNodes(graph: DependencyGraphData): Node[] {
  const NODE_WIDTH = 260;
  const NODE_HEIGHT = 160;
  const GAP_X = 100;
  const GAP_Y = 40;
  const MAX_PER_ROW = Math.max(4, Math.ceil(Math.sqrt(graph.nodes.length * 2)));

  return graph.nodes.map((node, i) => {
    const col = i % MAX_PER_ROW;
    const row = Math.floor(i / MAX_PER_ROW);

    return {
      id: node.migrationId,
      type: 'migration',
      position: {
        x: col * (NODE_WIDTH + GAP_X),
        y: row * (NODE_HEIGHT + GAP_Y),
      },
      data: {
        label: `V${node.version}`,
        version: node.version,
        description: node.description,
        tables: node.tables,
        riskLevel: node.riskLevel,
      },
    };
  });
}

/**
 * Creates edges from the dependency graph data.
 */
function createEdges(graph: DependencyGraphData): Edge[] {
  return graph.edges.map((edge, i) => ({
    id: `dep-${i}`,
    source: edge.from,
    target: edge.to,
    label: edge.table,
    type: 'smoothstep',
    animated: edge.type === 'drops-created',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      strokeWidth: 2,
      stroke: edgeColors[edge.type] || '#6b7280',
    },
    labelStyle: {
      fontSize: 10,
      fill: '#9ca3af',
    },
  }));
}

/**
 * Interactive dependency graph for migrations.
 * Shows migrations as nodes, with edges indicating table-level dependencies.
 */
export function DependencyGraphView({ graph }: DependencyGraphProps) {
  const { theme } = useTheme();

  const initialNodes = useMemo(() => layoutNodes(graph), [graph]);
  const initialEdges = useMemo(() => createEdges(graph), [graph]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const colorMode = theme === 'dark' ? 'dark' : 'light';

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}

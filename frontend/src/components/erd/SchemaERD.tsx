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
import { TableNode } from './TableNode';
import type { SchemaTable } from '@shared/types';
import { useTheme } from '@/hooks/use-theme';

interface SchemaERDProps {
  tables: SchemaTable[];
}

const nodeTypes = { table: TableNode };

/**
 * Lays out tables in a grid pattern, computing positions based on table count.
 */
function layoutTables(tables: SchemaTable[]): Node[] {
  const NODE_WIDTH = 260;
  const NODE_HEIGHT_BASE = 60;
  const ROW_HEIGHT_PER_COL = 28;
  const GAP_X = 80;
  const GAP_Y = 60;
  const COLS = Math.max(1, Math.ceil(Math.sqrt(tables.length)));

  return tables.map((table, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    return {
      id: table.name,
      type: 'table',
      position: {
        x: col * (NODE_WIDTH + GAP_X),
        y: row * (NODE_HEIGHT_BASE + 10 * ROW_HEIGHT_PER_COL + GAP_Y),
      },
      data: {
        label: table.name,
        columns: table.columns,
        foreignKeys: table.foreignKeys,
      },
    };
  });
}

/**
 * Creates edges from foreign key relationships.
 */
function createEdges(tables: SchemaTable[]): Edge[] {
  const edges: Edge[] = [];
  const tableNames = new Set(tables.map((t) => t.name));

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      if (tableNames.has(fk.referencedTable)) {
        edges.push({
          id: `${table.name}-${fk.columnName}-${fk.referencedTable}`,
          source: table.name,
          target: fk.referencedTable,
          label: fk.columnName,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
        });
      }
    }
  }

  return edges;
}

/**
 * Interactive ERD (Entity-Relationship Diagram) component.
 * Renders database tables as nodes with foreign key edges using React Flow.
 */
export function SchemaERD({ tables }: SchemaERDProps) {
  const { theme } = useTheme();

  const initialNodes = useMemo(() => layoutTables(tables), [tables]);
  const initialEdges = useMemo(() => createEdges(tables), [tables]);

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
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}

import { useState, useCallback } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { OperationSelector, type SqlOperation } from './OperationSelector';
import { SqlPreview } from './SqlPreview';

// Builder form imports
import { CreateTableBuilder } from './builders/CreateTableBuilder';
import { DropTableBuilder } from './builders/DropTableBuilder';
import { RenameTableBuilder } from './builders/RenameTableBuilder';
import { AddColumnBuilder } from './builders/AddColumnBuilder';
import { DropColumnBuilder } from './builders/DropColumnBuilder';
import { RenameColumnBuilder } from './builders/RenameColumnBuilder';
import { AlterColumnTypeBuilder } from './builders/AlterColumnTypeBuilder';
import { CreateIndexBuilder } from './builders/CreateIndexBuilder';
import { DropIndexBuilder } from './builders/DropIndexBuilder';
import { AddForeignKeyBuilder } from './builders/AddForeignKeyBuilder';
import { DropConstraintBuilder } from './builders/DropConstraintBuilder';
import { AddNotNullBuilder } from './builders/AddNotNullBuilder';
import { DropNotNullBuilder } from './builders/DropNotNullBuilder';
import { CreateEnumBuilder } from './builders/CreateEnumBuilder';
import { CreateViewBuilder } from './builders/CreateViewBuilder';
import { DropViewBuilder } from './builders/DropViewBuilder';

interface SqlBuilderPanelProps {
  schema: SchemaSnapshot | null;
  onInsertSql: (sql: string) => void;
}

/**
 * Root SQL Builder panel: operation selector, scrollable form, SQL preview, action buttons.
 */
export function SqlBuilderPanel({ schema, onInsertSql }: SqlBuilderPanelProps) {
  const [operation, setOperation] = useState<SqlOperation | ''>('');
  const [generatedSql, setGeneratedSql] = useState('');

  const handleSqlChange = useCallback((sql: string) => {
    setGeneratedSql(sql);
  }, []);

  const handleInsert = () => {
    if (generatedSql) onInsertSql(generatedSql);
  };

  const handleClear = () => {
    setOperation('');
    setGeneratedSql('');
  };

  const renderBuilder = () => {
    switch (operation) {
      case 'create-table':
        return <CreateTableBuilder onSqlChange={handleSqlChange} />;
      case 'drop-table':
        return <DropTableBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'rename-table':
        return <RenameTableBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'add-column':
        return <AddColumnBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'drop-column':
        return <DropColumnBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'rename-column':
        return <RenameColumnBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'alter-column-type':
        return <AlterColumnTypeBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'create-index':
        return <CreateIndexBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'drop-index':
        return <DropIndexBuilder onSqlChange={handleSqlChange} />;
      case 'add-foreign-key':
        return <AddForeignKeyBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'drop-constraint':
        return <DropConstraintBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'add-not-null':
        return <AddNotNullBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'drop-not-null':
        return <DropNotNullBuilder schema={schema} onSqlChange={handleSqlChange} />;
      case 'create-enum':
        return <CreateEnumBuilder onSqlChange={handleSqlChange} />;
      case 'create-view':
        return <CreateViewBuilder onSqlChange={handleSqlChange} />;
      case 'drop-view':
        return <DropViewBuilder onSqlChange={handleSqlChange} />;
      default:
        return (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Select an operation above to get started.
          </p>
        );
    }
  };

  return (
    <div className="flex h-full flex-col border-l bg-card">
      {/* Header */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">SQL Builder</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {schema ? `${schema.tables.length} tables loaded` : 'No schema — using free-text inputs'}
        </p>
      </div>

      <Separator />

      {/* Operation selector */}
      <div className="px-4 py-3">
        <OperationSelector value={operation} onChange={setOperation} />
      </div>

      <Separator />

      {/* Scrollable form area */}
      <ScrollArea className="flex-1 px-4 py-3">
        {renderBuilder()}
      </ScrollArea>

      <Separator />

      {/* SQL Preview + actions */}
      <div className="px-4 py-3">
        <SqlPreview sql={generatedSql} onInsert={handleInsert} onClear={handleClear} />
      </div>
    </div>
  );
}

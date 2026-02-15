import { useEffect, useRef } from 'react';

interface ValidationLogProps {
  lines: string[];
}

/**
 * Scrolling log output component for validation results.
 * Auto-scrolls to the bottom as new lines are added.
 */
export function ValidationLog({ lines }: ValidationLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div
      ref={containerRef}
      className="h-64 overflow-y-auto rounded-lg border bg-gray-900 p-4 font-mono text-sm text-gray-100"
    >
      {lines.length === 0 ? (
        <span className="text-gray-500">Waiting for log output...</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        ))
      )}
    </div>
  );
}

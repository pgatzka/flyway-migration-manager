import type { RiskLevel } from '@shared/sql-analyzer';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

const config: Record<RiskLevel, { label: string; className: string; Icon: typeof ShieldAlert }> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-600 text-white hover:bg-red-700',
    Icon: ShieldAlert,
  },
  high: {
    label: 'High',
    className: 'bg-orange-500 text-white hover:bg-orange-600',
    Icon: AlertTriangle,
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-500 text-white hover:bg-yellow-600',
    Icon: AlertTriangle,
  },
  low: {
    label: 'Safe',
    className: 'bg-green-600 text-white hover:bg-green-700',
    Icon: ShieldCheck,
  },
};

interface RiskBadgeProps {
  risk: RiskLevel;
  issueCount?: number;
  className?: string;
}

/** Displays a colored badge indicating the risk level of a migration */
export function RiskBadge({ risk, issueCount, className }: RiskBadgeProps) {
  const { label, className: badgeClass, Icon } = config[risk];
  return (
    <Badge
      className={cn('gap-1 border-transparent text-[11px]', badgeClass, className)}
      title={issueCount ? `${issueCount} issue${issueCount > 1 ? 's' : ''} found` : label}
    >
      <Icon className="h-3 w-3" />
      {label}
      {issueCount !== undefined && issueCount > 0 && (
        <span className="ml-0.5">({issueCount})</span>
      )}
    </Badge>
  );
}

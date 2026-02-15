import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import * as api from '@/api/client';
import type { ValidationResult, Migration } from '@shared/types';
import { analyzeSql, type RiskLevel } from '@shared/sql-analyzer';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface DailyStat {
  date: string;
  pass: number;
  fail: number;
}

/**
 * Migration Execution Stats Dashboard — shows validation history,
 * pass/fail rates, risk distribution, and migration statistics.
 */
export function StatsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.listValidations(projectId),
      api.listMigrations(projectId),
    ])
      .then(([v, m]) => {
        setValidations(v);
        setMigrations(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  // Compute stats
  const stats = useMemo(() => {
    const passCount = validations.filter((v) => v.status === 'pass').length;
    const failCount = validations.filter((v) => v.status === 'fail').length;
    const total = validations.length;
    const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

    // Daily stats for last 30 days
    const dailyMap = new Map<string, DailyStat>();
    for (const v of validations) {
      const date = v.executedAt.split('T')[0];
      const stat = dailyMap.get(date) || { date, pass: 0, fail: 0 };
      if (v.status === 'pass') stat.pass++;
      else stat.fail++;
      dailyMap.set(date, stat);
    }
    const dailyStats = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    // Risk distribution of migrations
    const riskDistribution: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const m of migrations) {
      const analysis = analyzeSql(m.sqlContent);
      riskDistribution[analysis.overallRisk]++;
    }

    // Total SQL lines
    const totalLines = migrations.reduce((sum, m) => sum + m.sqlContent.split('\n').length, 0);

    // Recent streak
    const sortedValidations = [...validations].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
    let streak = 0;
    let streakType: 'pass' | 'fail' | null = null;
    for (const v of sortedValidations) {
      if (!streakType) streakType = v.status as 'pass' | 'fail';
      if (v.status === streakType) streak++;
      else break;
    }

    return {
      passCount,
      failCount,
      total,
      passRate,
      dailyStats,
      riskDistribution,
      totalLines,
      migrationCount: migrations.length,
      streak,
      streakType,
    };
  }, [validations, migrations]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const maxDailyCount = Math.max(1, ...stats.dailyStats.map((d) => d.pass + d.fail));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Project
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Execution Stats</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Pass Rate
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {stats.passRate}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.passCount} of {stats.total} validations
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            Migrations
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {stats.migrationCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.totalLines.toLocaleString()} SQL lines
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Total Runs
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {stats.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <span className="text-emerald-500">{stats.passCount} pass</span>
            {' / '}
            <span className="text-red-500">{stats.failCount} fail</span>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {stats.streakType === 'pass' ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            Current Streak
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {stats.streak}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            consecutive {stats.streakType === 'pass' ? 'passes' : 'failures'}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Validation history chart (simple bar chart) */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Validation History</h3>
          {stats.dailyStats.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No validations yet
            </div>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {stats.dailyStats.slice(-20).map((day) => {
                const height = ((day.pass + day.fail) / maxDailyCount) * 100;
                const passRatio = day.pass / (day.pass + day.fail);
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col justify-end group relative"
                    title={`${day.date}: ${day.pass} pass, ${day.fail} fail`}
                  >
                    {day.pass > 0 && (
                      <div
                        className="bg-emerald-500 rounded-t-sm min-h-[2px]"
                        style={{ height: `${height * passRatio}%` }}
                      />
                    )}
                    {day.fail > 0 && (
                      <div
                        className="bg-red-500 min-h-[2px]"
                        style={{ height: `${height * (1 - passRatio)}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{stats.dailyStats.length > 0 ? stats.dailyStats[Math.max(0, stats.dailyStats.length - 20)].date : ''}</span>
            <span>{stats.dailyStats.length > 0 ? stats.dailyStats[stats.dailyStats.length - 1].date : ''}</span>
          </div>
        </div>

        {/* Risk distribution */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Migration Risk Distribution
          </h3>
          {stats.migrationCount === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No migrations yet
            </div>
          ) : (
            <div className="space-y-3">
              {([
                { level: 'low' as const, label: 'Low', color: 'bg-emerald-500' },
                { level: 'medium' as const, label: 'Medium', color: 'bg-amber-500' },
                { level: 'high' as const, label: 'High', color: 'bg-orange-500' },
                { level: 'critical' as const, label: 'Critical', color: 'bg-red-500' },
              ] as const).map(({ level, label, color }) => {
                const count = stats.riskDistribution[level];
                const pct = stats.migrationCount > 0 ? (count / stats.migrationCount) * 100 : 0;
                return (
                  <div key={level}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{label}</span>
                      <span className="text-muted-foreground">{count} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent validations table */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-foreground">Recent Validations</h3>
        </div>
        {validations.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No validations yet. Run your first validation to see stats.
          </div>
        ) : (
          <div className="divide-y max-h-[300px] overflow-y-auto">
            {validations.slice(0, 20).map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                {v.status === 'pass' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className={`font-medium ${v.status === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {v.status.toUpperCase()}
                </span>
                {v.errorMessage && (
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {v.errorMessage.slice(0, 80)}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {formatDate(v.executedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

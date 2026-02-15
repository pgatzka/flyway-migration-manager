import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import * as api from '@/api/client';
import type { ProjectWithStats } from '@shared/types';
import {
  Sun,
  Moon,
  FolderOpen,
  Home,
} from 'lucide-react';

/**
 * Command palette (Ctrl+K) for quick navigation and actions.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load projects when palette opens
  useEffect(() => {
    if (!open) return;
    setSearch('');
    api.listProjects().then(setProjects).catch(() => {});
  }, [open]);

  const runAction = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          loop
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="h-11 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Navigation group */}
            <Command.Group heading="Navigation">
              <CommandItem
                icon={<Home className="h-4 w-4" />}
                label="Go to Dashboard"
                shortcut="Home"
                onSelect={() => runAction(() => navigate('/'))}
              />
            </Command.Group>

            {/* Projects group */}
            {projects.length > 0 && (
              <Command.Group heading="Projects">
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    icon={<FolderOpen className="h-4 w-4" />}
                    label={p.name}
                    description={`${p.migrationCount} migrations`}
                    onSelect={() => runAction(() => navigate(`/projects/${p.id}`))}
                  />
                ))}
              </Command.Group>
            )}

            {/* Actions group */}
            <Command.Group heading="Actions">
              <CommandItem
                icon={theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                onSelect={() => runAction(toggleTheme)}
              />
            </Command.Group>
          </Command.List>

          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>{' '}
            to close{' '}
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">&uarr;&darr;</kbd>{' '}
            to navigate{' '}
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
            to select
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({
  icon,
  label,
  description,
  shortcut,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">
        {label}
        {description && (
          <span className="ml-2 text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {shortcut && (
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}

import { Link, Outlet } from 'react-router-dom';
import { Database, Moon, Sun, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useTheme } from '@/hooks/use-theme';
import { CommandPalette } from '@/components/command-palette/CommandPalette';

/**
 * Root layout component with navigation header and toast notifications.
 * Wraps all pages via React Router's Outlet.
 */
export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
              <Database className="h-5 w-5 text-blue-600" />
              Flyway Migration Manager
            </Link>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-2 text-muted-foreground sm:flex"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              >
                <Command className="h-3.5 w-3.5" />
                <span className="text-xs">Ctrl+K</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <Toaster />
      <CommandPalette />
    </div>
  );
}

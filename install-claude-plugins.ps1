# ============================================================
# Claude Code Plugin Install Script (PowerShell)
# For: Flyway Migration Manager Project
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Installing Claude Code Plugins" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------
# 1. Add marketplaces
# ----------------------------------------------------------
Write-Host "[1/3] Adding plugin marketplaces..." -ForegroundColor Yellow

claude /plugin marketplace add anthropics/claude-code
claude /plugin marketplace add anthropics/claude-plugins-official

Write-Host ""

# ----------------------------------------------------------
# 2. Install plugins
# ----------------------------------------------------------
Write-Host "[2/3] Installing plugins..." -ForegroundColor Yellow

$plugins = @(
    @{ Name = "Context7 (live documentation lookup)";           Command = "@anthropics/claude-plugins-official/context7" },
    @{ Name = "Frontend Design (production-grade UI)";          Command = "@anthropics/claude-code-plugins/frontend-design" },
    @{ Name = "Feature Dev (multi-agent development workflow)"; Command = "@anthropics/claude-code-plugins/feature-dev" },
    @{ Name = "Code Review (multi-agent code review)";          Command = "@anthropics/claude-code-plugins/code-review" },
    @{ Name = "Security Guidance (security hooks)";             Command = "@anthropics/claude-code-plugins/security-guidance" },
    @{ Name = "Playwright (browser automation & testing)";      Command = "@anthropics/claude-code-plugins/playwright" }
)

foreach ($plugin in $plugins) {
    Write-Host "  -> $($plugin.Name)" -ForegroundColor Green
    npx claude-plugins install $plugin.Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "     FAILED to install $($plugin.Name)" -ForegroundColor Red
    }
}

Write-Host ""

# ----------------------------------------------------------
# 3. Verify
# ----------------------------------------------------------
Write-Host "[3/3] Verifying installation..." -ForegroundColor Yellow
claude /plugin marketplace list

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Done! Restart Claude Code to load all plugins." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
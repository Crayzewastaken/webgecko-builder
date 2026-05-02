# gp.ps1 - git commit + push with automatic stale lock cleanup
# Usage:  .\gp.ps1 "your commit message"
# Install: . .\gp.ps1  then  Install-GpAlias

param(
    [Parameter(Position=0)]
    [string]$Message = ""
)

$repo = $PSScriptRoot

function Remove-GitLocks {
    $locks = @(
        (Join-Path $repo ".git\index.lock"),
        (Join-Path $repo ".git\HEAD.lock"),
        (Join-Path $repo ".git\MERGE_HEAD.lock")
    )
    foreach ($lock in $locks) {
        if (Test-Path $lock) {
            try {
                Remove-Item $lock -Force -ErrorAction Stop
                Write-Host "  Removed: $lock" -ForegroundColor Yellow
            } catch {
                Write-Host "  Could not remove $lock" -ForegroundColor Red
            }
        }
    }
}

Write-Host "Checking for stale git locks..." -ForegroundColor Cyan
Remove-GitLocks

Write-Host "Staging all changes..." -ForegroundColor Cyan
& git -C $repo add -A
if ($LASTEXITCODE -ne 0) { Write-Host "git add failed" -ForegroundColor Red; exit 1 }

if ($Message -eq "") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "chore: update $timestamp"
}

& git -C $repo commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing new to commit - pushing existing commits." -ForegroundColor Yellow
}

Write-Host "Pushing to origin/main..." -ForegroundColor Cyan
& git -C $repo push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done! Pushed to GitHub." -ForegroundColor Green
} else {
    Write-Host "Push failed." -ForegroundColor Red
    exit 1
}

function Install-GpAlias {
    $profilePath = $PROFILE.CurrentUserAllHosts
    $scriptPath = Join-Path $PSScriptRoot "gp.ps1"
    if (-not (Test-Path $profilePath)) {
        New-Item -ItemType File -Path $profilePath -Force | Out-Null
    }
    $existing = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $existing -or -not $existing.Contains("gp.ps1")) {
        $aliasLine = 'function gp { param([string]$msg = "") & "' + $scriptPath + '" $msg }'
        Add-Content -Path $profilePath -Value ""
        Add-Content -Path $profilePath -Value "# WebGecko: gp = git commit + push with auto lock cleanup"
        Add-Content -Path $profilePath -Value $aliasLine
        Write-Host "Installed gp alias into $profilePath" -ForegroundColor Green
        Write-Host "Run: . $PROFILE  to activate now" -ForegroundColor Yellow
    } else {
        Write-Host "'gp' alias already in profile." -ForegroundColor Cyan
    }
}

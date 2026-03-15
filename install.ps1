param(
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

$Repo = "phillipphoenix/otto-agent"
$InstallDir = "$env:LOCALAPPDATA\otto"

# Resolve version
if ($Version -eq "latest") {
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $Release.tag_name
    if (-not $Version) {
        Write-Error "Failed to fetch latest version"
        exit 1
    }
}

$Artifact = "otto-windows-x64.exe"
$Url = "https://github.com/$Repo/releases/download/$Version/$Artifact"

Write-Host "Installing otto $Version (windows/x64)..."

# Download
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$OutFile = Join-Path $InstallDir "otto.exe"
Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing

# PATH setup
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$UserPath", "User")
    Write-Host "Added $InstallDir to user PATH."
    Write-Host "Restart your terminal for PATH changes to take effect."
}

Write-Host "Installed otto $Version to $OutFile"

Write-Host ""
Write-Host " ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓"
Write-Host " ▓▓  ▓▓    ▓▓      ▓▓    ▓▓  ▓▓"
Write-Host " ▓▓  ▓▓    ▓▓      ▓▓    ▓▓  ▓▓"
Write-Host " ▓▓  ▓▓    ▓▓      ▓▓    ▓▓  ▓▓"
Write-Host " ▓▓▓▓▓▓    ▓▓      ▓▓    ▓▓▓▓▓▓"
Write-Host ""
Write-Host "Otto -- your autonomous coding agent."
Write-Host "So happy to have you on board -- let's build something amazing together!"
Write-Host ""
Write-Host "  otto --help               Show all available commands"
Write-Host "  otto run                  Run the default workflow"
Write-Host "  otto run <workflow>       Run a specific workflow"
Write-Host ""
Write-Host "Learn more: https://github.com/phillipphoenix/otto-agent"

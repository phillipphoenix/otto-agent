# Plan: Update install scripts to include an introduction/help section (#15)

## Summary
Add a friendly getting-started introduction block at the end of both install scripts, voiced as Otto the Octopus — super friendly, happy, and overly positive.

## Architecture
- Append intro block after the final "Installed..." line in each script
- No ANSI color in `install.sh` (plain `echo`) for broad `sh` compatibility
- `install.ps1` may use `Write-Host` with optional `-ForegroundColor` for friendliness
- Include a small ASCII octopus (≤5 lines), welcome message, key commands, and repo URL
- Keep total output ≤20 lines and fits 80 columns without wrapping

## Files to modify
- `install.sh` — append Otto intro block after line 58
- `install.ps1` — append Otto intro block after line 41

## Notes
- Repo URL: https://github.com/phillipphoenix/otto-agent
- Key commands to mention: `otto --help`, `otto run`, `otto run <workflow>`
- ASCII art must be ≤5 lines and ≤80 columns
- Avoid ANSI escape codes in install.sh

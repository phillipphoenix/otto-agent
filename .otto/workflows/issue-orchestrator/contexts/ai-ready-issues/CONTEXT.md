---
description: GitHub issues labeled ai-ready
command: gh issue list --label ai-ready --state open --json number,title,body,labels,assignees | jq -c '.[] | select(.assignees | length == 0)' | while IFS= read -r issue; do num=$(printf '%s' "$issue" | jq -r '.number'); [ "$(gh pr list --search "#$num" --state open --json number --jq 'length')" = "0" ] && printf '%s\n' "$issue" && break; done
---

---
description: GitHub issues labeled ai-ready
command: gh issue list --label ai-ready --state open --no-assignee --json number,title,body,labels | jq -c '.[]' | while IFS= read -r issue; do num=$(printf '%s' "$issue" | jq -r '.number'); [ "$(gh pr list --search "#$num" --state open --json number --jq 'length')" = "0" ] && printf '%s\n' "$issue" && break; done
---

---
description: Open issues without ai-enriched label and unassigned
command: gh issue list --state open --no-assignee --json number,title,body,labels --jq '[.[] | select(all(.labels[]; .name != "ai-enriched")) | {number, title, body}] | first'
---

import type { PrimitiveFrontmatter, WorkflowFrontmatter } from "./types";

export function parseFrontmatter(content: string): {
  frontmatter: PrimitiveFrontmatter;
  body: string;
} {
  const defaults: PrimitiveFrontmatter = {
    enabled: true,
    command: null,
    timeout: null,
    description: null,
    completable: false,
  };

  const trimmed = content.trimStart();

  if (!trimmed.startsWith("---")) {
    return { frontmatter: defaults, body: stripComments(content) };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: defaults, body: stripComments(content) };
  }

  const frontmatterBlock = trimmed.slice(4, endIndex); // skip opening "---\n"
  const body = trimmed.slice(endIndex + 4); // skip closing "\n---"

  const frontmatter = { ...defaults };

  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case "enabled":
        frontmatter.enabled = value !== "false";
        break;
      case "command":
        frontmatter.command = value || null;
        break;
      case "timeout":
        frontmatter.timeout = value ? Number(value) : null;
        break;
      case "description":
        frontmatter.description = value || null;
        break;
      case "completable":
        frontmatter.completable = value !== "false";
        break;
    }
  }

  return { frontmatter, body: stripComments(body) };
}

export function parseWorkflowFrontmatter(content: string): {
  frontmatter: WorkflowFrontmatter;
  body: string;
} {
  const { frontmatter: base, body } = parseFrontmatter(content);
  const workflowDefaults: WorkflowFrontmatter = { ...base, model: null, deny: [] };

  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: workflowDefaults, body };
  }
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: workflowDefaults, body };
  }

  const frontmatterBlock = trimmed.slice(4, endIndex);
  const frontmatter = { ...workflowDefaults };

  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === "model") {
      frontmatter.model = value || null;
    } else if (key === "deny" && value) {
      // Support repeated `deny:` lines — each adds one entry to the array
      frontmatter.deny.push(value);
    }
  }

  return { frontmatter, body };
}

function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "").trim();
}

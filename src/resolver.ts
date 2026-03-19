export function resolveTemplate(
  template: string,
  contexts: Map<string, string>,
  instructions: Map<string, string>,
  checkFailures?: string,
): string {
  let result = template;

  // Track which entries have been individually referenced
  const usedContexts = new Set<string>();
  const usedInstructions = new Set<string>();

  // Replace named placeholders: {{ contexts.name }}
  result = result.replace(
    /\{\{\s*contexts\.([a-zA-Z0-9_-]+)\s*\}\}/g,
    (_match, name) => {
      usedContexts.add(name);
      const content = contexts.get(name);
      if (content == null) return "";
      return `## Context: ${name}\n\n${content}`;
    },
  );

  // Replace named placeholders: {{ instructions.name }}
  result = result.replace(
    /\{\{\s*instructions\.([a-zA-Z0-9_-]+)\s*\}\}/g,
    (_match, name) => {
      usedInstructions.add(name);
      const content = instructions.get(name);
      if (content == null) return "";
      return `## Instruction: ${name}\n\n${content}`;
    },
  );

  // Check if bulk or any placeholders exist
  const hasBulkContexts = /\{\{\s*contexts\s*\}\}/.test(result);
  const hasBulkInstructions = /\{\{\s*instructions\s*\}\}/.test(result);
  const hadAnyPlaceholders =
    hasBulkContexts ||
    hasBulkInstructions ||
    usedContexts.size > 0 ||
    usedInstructions.size > 0;

  // Replace bulk placeholder: {{ contexts }}
  if (hasBulkContexts) {
    const remaining = buildBulk(contexts, usedContexts, "Context");
    result = result.replace(/\{\{\s*contexts\s*\}\}/g, remaining);
  }

  // Replace bulk placeholder: {{ instructions }}
  if (hasBulkInstructions) {
    const remaining = buildBulk(instructions, usedInstructions, "Instruction");
    result = result.replace(/\{\{\s*instructions\s*\}\}/g, remaining);
  }

  // If no placeholders at all, append everything at the end
  if (!hadAnyPlaceholders) {
    const allContexts = buildBulk(contexts, new Set(), "Context");
    const allInstructions = buildBulk(instructions, new Set(), "Instruction");
    const append = [allContexts, allInstructions].filter(Boolean).join("\n\n");
    if (append) {
      result = result + "\n\n" + append;
    }
  }

  // Replace {{ checks }} placeholder if present, otherwise append check failures at end
  if (checkFailures) {
    const checksPlaceholder = /\{\{\s*checks\s*\}\}/;
    if (checksPlaceholder.test(result)) {
      result = result.replace(checksPlaceholder, checkFailures);
    } else {
      result = result + "\n\n## Check Failures\n\n" + checkFailures;
    }
  } else {
    // Remove the {{ checks }} placeholder if no failures to inject
    result = result.replace(/\{\{\s*checks\s*\}\}/g, "");
  }

  return result;
}

function buildBulk(
  entries: Map<string, string>,
  used: Set<string>,
  label: string,
): string {
  const remaining = Array.from(entries.entries())
    .filter(([name]) => !used.has(name))
    .sort(([a], [b]) => a.localeCompare(b));

  return remaining
    .map(([name, content]) => `## ${label}: ${name}\n\n${content}`)
    .join("\n\n");
}

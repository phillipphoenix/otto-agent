import { PrimitiveType, type PrimitiveEntry, type CompletionCheckEntry } from "./types";
import { parseFrontmatter, parseCompletionCheckFrontmatter } from "./frontmatter";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MARKER_FILES: Record<string, string> = {
  contexts: "CONTEXT.md",
  instructions: "INSTRUCTION.md",
  checks: "CHECK.md",
};

const KIND_TO_TYPE: Record<string, PrimitiveType> = {
  contexts: PrimitiveType.CONTEXT,
  instructions: PrimitiveType.INSTRUCTION,
  checks: PrimitiveType.CHECK,
};

export async function discoverPrimitives(
  projectDir: string,
  workflowName: string,
  kind: "contexts" | "instructions" | "checks",
): Promise<PrimitiveEntry[]> {
  const markerFile = MARKER_FILES[kind]!;
  const primitiveType = KIND_TO_TYPE[kind]!

  const globalDir = join(projectDir, ".otto", kind);
  const workflowDir = join(
    projectDir,
    ".otto",
    "workflows",
    workflowName,
    kind,
  );

  const globalEntries = await scanDir(globalDir, markerFile, primitiveType, "global");
  const workflowEntries = await scanDir(workflowDir, markerFile, primitiveType, "workflow");

  // Merge: workflow overrides global on name collision
  const merged = new Map<string, PrimitiveEntry>();
  for (const entry of globalEntries) {
    merged.set(entry.name, entry);
  }
  for (const entry of workflowEntries) {
    merged.set(entry.name, entry);
  }

  // Filter disabled, sort alphabetically
  return Array.from(merged.values())
    .filter((e) => e.frontmatter.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function discoverCompletionCheck(
  projectDir: string,
  workflowName: string,
): Promise<CompletionCheckEntry | null> {
  const filePath = join(projectDir, ".otto", "workflows", workflowName, "COMPLETION_CHECK.md");
  const file = Bun.file(filePath);

  if (!(await file.exists())) return null;

  const content = await file.text();
  const { frontmatter, body } = parseCompletionCheckFrontmatter(content);

  if (!frontmatter.enabled) return null;

  return { frontmatter, body, filePath };
}

async function scanDir(
  dir: string,
  markerFile: string,
  type: PrimitiveType,
  scope: "global" | "workflow",
): Promise<PrimitiveEntry[]> {
  let subdirs: string[];
  try {
    subdirs = await readdir(dir);
  } catch {
    return [];
  }

  const entries: PrimitiveEntry[] = [];

  for (const name of subdirs) {
    const filePath = join(dir, name, markerFile);
    const file = Bun.file(filePath);

    if (!(await file.exists())) continue;

    const content = await file.text();
    const { frontmatter, body } = parseFrontmatter(content);

    entries.push({
      name,
      type,
      frontmatter,
      body,
      filePath,
      scope,
    });
  }

  return entries;
}

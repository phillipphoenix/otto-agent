import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "../primitives/frontmatter";

export async function listCommand(projectDir: string): Promise<void> {
  const workflowsDir = join(projectDir, ".otto", "workflows");

  let entries: string[];
  try {
    entries = await readdir(workflowsDir);
  } catch {
    console.log("No .otto/ directory found. Run `otto init` to get started.");
    return;
  }

  const workflows: Array<{ name: string; description: string | null }> = [];

  for (const name of entries) {
    const filePath = join(workflowsDir, name, "WORKFLOW.md");
    const file = Bun.file(filePath);

    if (!(await file.exists())) continue;

    const content = await file.text();
    const { frontmatter } = parseFrontmatter(content);
    workflows.push({ name, description: frontmatter.description });
  }

  if (workflows.length === 0) {
    console.log("No workflows found in .otto/workflows/.");
    return;
  }

  console.log("Workflows:\n");
  for (const { name, description } of workflows) {
    const desc = description ? ` — ${description}` : "";
    console.log(`  ${name}${desc}`);
  }
}

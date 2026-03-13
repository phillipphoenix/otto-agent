import type { PrimitiveEntry } from "./types";

export function loadInstructions(
  entries: PrimitiveEntry[],
): Map<string, string> {
  const results = new Map<string, string>();

  for (const entry of entries) {
    results.set(entry.name, entry.body);
  }

  return results;
}

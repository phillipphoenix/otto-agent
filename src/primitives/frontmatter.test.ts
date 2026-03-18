import { test, expect, describe } from "bun:test";
import { parseFrontmatter, parseWorkflowFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  test("parses valid frontmatter with all fields populated", () => {
    const content = `---
enabled: true
command: check
timeout: 30
description: Run checks
completable: true
---
# Body content
`;
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.enabled).toBe(true);
    expect(frontmatter.command).toBe("check");
    expect(frontmatter.timeout).toBe(30);
    expect(frontmatter.description).toBe("Run checks");
    expect(frontmatter.completable).toBe(true);
    expect(body).toContain("# Body content");
  });

  test("uses defaults for missing fields", () => {
    const content = `---
command: lint
---
Body here
`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.enabled).toBe(true);
    expect(frontmatter.command).toBe("lint");
    expect(frontmatter.timeout).toBeNull();
    expect(frontmatter.description).toBeNull();
    expect(frontmatter.completable).toBe(false);
  });

  test("returns defaults when there is no frontmatter block", () => {
    const content = "Just plain content with no frontmatter.";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.enabled).toBe(true);
    expect(frontmatter.command).toBeNull();
    expect(frontmatter.timeout).toBeNull();
    expect(frontmatter.description).toBeNull();
    expect(frontmatter.completable).toBe(false);
    expect(body).toBe("Just plain content with no frontmatter.");
  });

  test("does not have a model field", () => {
    const content = `---
model: opus
---
Body here
`;
    const { frontmatter } = parseFrontmatter(content);
    expect((frontmatter as any).model).toBeUndefined();
  });
});

describe("parseWorkflowFrontmatter", () => {
  test("parses model field from frontmatter", () => {
    const content = `---
model: opus
completable: true
---
# Workflow body
`;
    const { frontmatter, body } = parseWorkflowFrontmatter(content);
    expect(frontmatter.model).toBe("opus");
    expect(frontmatter.completable).toBe(true);
    expect(body).toContain("# Workflow body");
  });

  test("returns null model when model is not specified", () => {
    const content = `---
completable: true
---
# Workflow body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.model).toBeNull();
  });

  test("returns null model when there is no frontmatter block", () => {
    const content = "Just plain workflow content.";
    const { frontmatter, body } = parseWorkflowFrontmatter(content);
    expect(frontmatter.model).toBeNull();
    expect(body).toBe("Just plain workflow content.");
  });

  test("inherits base frontmatter fields alongside model", () => {
    const content = `---
enabled: false
model: haiku
timeout: 60
---
Body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.enabled).toBe(false);
    expect(frontmatter.model).toBe("haiku");
    expect(frontmatter.timeout).toBe(60);
  });

  test("parses a single deny entry", () => {
    const content = `---
deny: .env
---
# Workflow body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.deny).toEqual([".env"]);
  });

  test("parses multiple deny entries from repeated lines", () => {
    const content = `---
deny: .env
deny: **/.env
deny: secrets.json
---
# Workflow body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.deny).toEqual([".env", "**/.env", "secrets.json"]);
  });

  test("returns empty deny array when no deny key is present", () => {
    const content = `---
model: opus
---
# Workflow body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.deny).toEqual([]);
  });

  test("returns empty deny array when there is no frontmatter block", () => {
    const content = "Just plain workflow content.";
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.deny).toEqual([]);
  });

  test("ignores deny line with empty value", () => {
    const content = `---
deny:
deny: .env
---
# Workflow body
`;
    const { frontmatter } = parseWorkflowFrontmatter(content);
    expect(frontmatter.deny).toEqual([".env"]);
  });
});

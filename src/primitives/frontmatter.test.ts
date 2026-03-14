import { test, expect, describe } from "bun:test";
import { parseFrontmatter } from "./frontmatter";

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
});

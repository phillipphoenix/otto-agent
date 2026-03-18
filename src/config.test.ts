import { test, expect, describe } from "bun:test";
import { OttoConfigSchema } from "./config";

describe("OttoConfigSchema", () => {
  describe("agent.denyList", () => {
    test("defaults to empty array when not specified", () => {
      const config = OttoConfigSchema.parse({});
      expect(config.agent.denyList).toEqual([]);
    });

    test("accepts an array of strings", () => {
      const config = OttoConfigSchema.parse({
        agent: { denyList: [".env", "**/.env", "secrets.json"] },
      });
      expect(config.agent.denyList).toEqual([".env", "**/.env", "secrets.json"]);
    });

    test("accepts an empty array", () => {
      const config = OttoConfigSchema.parse({ agent: { denyList: [] } });
      expect(config.agent.denyList).toEqual([]);
    });

    test("preserves other agent defaults when only denyList is set", () => {
      const config = OttoConfigSchema.parse({
        agent: { denyList: [".env"] },
      });
      expect(config.agent.command).toBe("claude");
      expect(config.agent.model).toBe("sonnet");
      expect(config.agent.args).toEqual(["-p", "--dangerously-skip-permissions"]);
    });

    test("rejects non-string entries in denyList", () => {
      expect(() =>
        OttoConfigSchema.parse({ agent: { denyList: [123] } })
      ).toThrow();
    });
  });
});

import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { createEmitter, EventType, type Event } from "./events";

// Mock all heavy dependencies before importing engine.ts.
// Bun hoists mock.module calls so they run before top-level imports.

const mockRunAgent = mock(() =>
  Promise.resolve({
    resultText: "%%OTTO_STOP%%",
    exitCode: 0,
    timedOut: false,
    durationMs: 100,
  }),
);

mock.module("./agent", () => ({ runAgent: mockRunAgent }));
mock.module("./primitives/discovery", () => ({
  discoverPrimitives: mock(() => Promise.resolve([])),
}));
mock.module("./primitives/contexts", () => ({
  runContexts: mock(() => Promise.resolve([])),
}));
mock.module("./primitives/instructions", () => ({
  loadInstructions: mock(() => []),
}));
mock.module("./primitives/checks", () => ({
  runChecks: mock(() => Promise.resolve({ passed: [], failed: [] })),
}));
mock.module("./resolver", () => ({
  resolveTemplate: mock(() => "test prompt"),
}));
mock.module("./primitives/frontmatter", () => ({
  parseWorkflowFrontmatter: mock(() => ({
    frontmatter: { completable: false, model: null },
    body: "test template",
  })),
}));

import { runLoop } from "./engine";

const WORKFLOW_NAME = "test-workflow";

const MINIMAL_CONFIG = {
  agent: { command: "echo", args: [], model: "sonnet" },
  defaults: {
    workflow: WORKFLOW_NAME,
    maxIterations: 0,
    delay: 0,
    timeout: null,
    stopOnError: false,
    logDir: null,
  },
} as any;

function makeRunConfig(overrides: Record<string, unknown> = {}) {
  return {
    workflow: WORKFLOW_NAME,
    maxIterations: 1,
    delay: 0,
    timeout: null,
    stopOnError: false,
    logDir: null,
    ...overrides,
  };
}

let projectDir: string;

beforeEach(async () => {
  projectDir = join(tmpdir(), `otto-test-${crypto.randomUUID()}`);
  const workflowDir = join(projectDir, ".otto", "workflows", WORKFLOW_NAME);
  await Bun.write(join(workflowDir, "WORKFLOW.md"), "# Test\nDo something.");
  mockRunAgent.mockClear();
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("runLoop nested events via parentEmitter", () => {
  test("emits NESTED_WORKFLOW_START, NESTED_ITERATION_COMPLETE, NESTED_WORKFLOW_COMPLETE to parentEmitter when reportBack is true", async () => {
    const emitter = createEmitter();
    const parentEmitter = createEmitter();
    const parentEvents: Event[] = [];
    parentEmitter.subscribe((e) => parentEvents.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter, parentEmitter);

    const types = parentEvents.map((e) => e.type);
    expect(types).toContain(EventType.NESTED_WORKFLOW_START);
    expect(types).toContain(EventType.NESTED_ITERATION_COMPLETE);
    expect(types).toContain(EventType.NESTED_WORKFLOW_COMPLETE);
  });

  test("does not emit any nested events to parentEmitter when reportBack is false", async () => {
    const emitter = createEmitter();
    const parentEmitter = createEmitter();
    const parentEvents: Event[] = [];
    parentEmitter.subscribe((e) => parentEvents.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: false }), emitter, parentEmitter);

    const types = parentEvents.map((e) => e.type);
    expect(types).not.toContain(EventType.NESTED_WORKFLOW_START);
    expect(types).not.toContain(EventType.NESTED_ITERATION_COMPLETE);
    expect(types).not.toContain(EventType.NESTED_WORKFLOW_COMPLETE);
  });

  test("does not emit nested events to parentEmitter when reportBack is absent", async () => {
    const emitter = createEmitter();
    const parentEmitter = createEmitter();
    const parentEvents: Event[] = [];
    parentEmitter.subscribe((e) => parentEvents.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig(), emitter, parentEmitter);

    const types = parentEvents.map((e) => e.type);
    expect(types).not.toContain(EventType.NESTED_WORKFLOW_START);
    expect(types).not.toContain(EventType.NESTED_ITERATION_COMPLETE);
    expect(types).not.toContain(EventType.NESTED_WORKFLOW_COMPLETE);
  });

  test("NESTED_WORKFLOW_START event carries the workflow name", async () => {
    const emitter = createEmitter();
    const parentEmitter = createEmitter();
    const parentEvents: Event[] = [];
    parentEmitter.subscribe((e) => parentEvents.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter, parentEmitter);

    const startEvent = parentEvents.find((e) => e.type === EventType.NESTED_WORKFLOW_START);
    expect(startEvent?.data.workflow).toBe(WORKFLOW_NAME);
  });

  test("NESTED_WORKFLOW_COMPLETE event carries iteration counts", async () => {
    const emitter = createEmitter();
    const parentEmitter = createEmitter();
    const parentEvents: Event[] = [];
    parentEmitter.subscribe((e) => parentEvents.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter, parentEmitter);

    const completeEvent = parentEvents.find((e) => e.type === EventType.NESTED_WORKFLOW_COMPLETE);
    expect(completeEvent?.data.workflow).toBe(WORKFLOW_NAME);
    expect(typeof completeEvent?.data.iterations).toBe("number");
    expect(typeof completeEvent?.data.succeeded).toBe("number");
    expect(typeof completeEvent?.data.failed).toBe("number");
  });

  test("own emitter receives standard events regardless of reportBack setting", async () => {
    const emitter = createEmitter();
    const events: Event[] = [];
    emitter.subscribe((e) => events.push(e));
    const parentEmitter = createEmitter();

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter, parentEmitter);

    const types = events.map((e) => e.type);
    expect(types).toContain(EventType.ITERATION_START);
    expect(types).toContain(EventType.ITERATION_COMPLETE);
    expect(types).toContain(EventType.RUN_COMPLETE);
  });
});

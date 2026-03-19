import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm, mkdtemp, readdir } from "node:fs/promises";
import { createEmitter, EventType, type Event } from "./events";

// Mock all heavy dependencies before importing engine.ts.
// Bun hoists mock.module calls so they run before top-level imports.

const mockRunAgent = mock((_config: any, _prompt: string, _emitter?: any) =>
  Promise.resolve({
    resultText: "Done.",
    exitCode: 0,
    timedOut: false,
    durationMs: 100,
  }),
);

const mockRunCompletionCheck = mock(() => Promise.resolve({ completed: false }));
const mockDiscoverCompletionCheck = mock(() => Promise.resolve(null));

mock.module("./agent", () => ({ runAgent: mockRunAgent }));
mock.module("./primitives/discovery", () => ({
  discoverPrimitives: mock(() => Promise.resolve([])),
  discoverCompletionCheck: mockDiscoverCompletionCheck,
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
mock.module("./primitives/completionCheck", () => ({
  runCompletionCheck: mockRunCompletionCheck,
}));
mock.module("./resolver", () => ({
  resolveTemplate: mock(() => "test prompt"),
}));

import { runLoop, processRelayFiles, CHILD_EVENTS_ENV_VAR, DEPTH_ENV_VAR } from "./engine";

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
let relayDir: string;
let savedEnv: { childEvents?: string; depth?: string };

beforeEach(async () => {
  projectDir = join(tmpdir(), `otto-test-${crypto.randomUUID()}`);
  const workflowDir = join(projectDir, ".otto", "workflows", WORKFLOW_NAME);
  await Bun.write(join(workflowDir, "WORKFLOW.md"), "# Test\nDo something.");

  relayDir = await mkdtemp(join(tmpdir(), "otto-relay-test-"));

  // Save current env
  savedEnv = {
    childEvents: process.env[CHILD_EVENTS_ENV_VAR],
    depth: process.env[DEPTH_ENV_VAR],
  };

  mockRunAgent.mockClear();
  mockRunCompletionCheck.mockClear();
  mockDiscoverCompletionCheck.mockClear();
});

afterEach(async () => {
  // Restore env
  if (savedEnv.childEvents !== undefined) {
    process.env[CHILD_EVENTS_ENV_VAR] = savedEnv.childEvents;
  } else {
    delete process.env[CHILD_EVENTS_ENV_VAR];
  }
  if (savedEnv.depth !== undefined) {
    process.env[DEPTH_ENV_VAR] = savedEnv.depth;
  } else {
    delete process.env[DEPTH_ENV_VAR];
  }

  await rm(projectDir, { recursive: true, force: true });
  await rm(relayDir, { recursive: true, force: true });
});

/** Read all JSONL events from all files in the relay dir. */
async function readRelayEvents(dir: string): Promise<Event[]> {
  const events: Event[] = [];
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const content = await Bun.file(join(dir, file)).text();
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line));
        } catch {}
      }
    }
  } catch {}
  return events;
}

describe("runLoop nested events via relay directory", () => {
  test("writes NESTED_WORKFLOW_START, NESTED_ITERATION_COMPLETE, NESTED_WORKFLOW_COMPLETE to relay dir when reportBack is true", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter);

    const events = await readRelayEvents(relayDir);
    const types = events.map((e) => e.type);
    expect(types).toContain(EventType.NESTED_WORKFLOW_START);
    expect(types).toContain(EventType.NESTED_ITERATION_COMPLETE);
    expect(types).toContain(EventType.NESTED_WORKFLOW_COMPLETE);
  });

  test("does not write any events to relay dir when reportBack is false", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: false }), emitter);

    const events = await readRelayEvents(relayDir);
    // Only the top-level relay dir itself may have files from the child's own relay,
    // but no nested events should be written since reportBack is false
    const nestedTypes = events.filter((e) =>
      [EventType.NESTED_WORKFLOW_START, EventType.NESTED_ITERATION_COMPLETE, EventType.NESTED_WORKFLOW_COMPLETE].includes(e.type),
    );
    expect(nestedTypes).toHaveLength(0);
  });

  test("does not write nested events when reportBack is absent", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig(), emitter);

    const events = await readRelayEvents(relayDir);
    const nestedTypes = events.filter((e) =>
      [EventType.NESTED_WORKFLOW_START, EventType.NESTED_ITERATION_COMPLETE, EventType.NESTED_WORKFLOW_COMPLETE].includes(e.type),
    );
    expect(nestedTypes).toHaveLength(0);
  });

  test("events include depth and instanceId", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "2";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter);

    const events = await readRelayEvents(relayDir);

    const startEvent = events.find((e) => e.type === EventType.NESTED_WORKFLOW_START);
    expect(startEvent?.data.depth).toBe(3); // parent depth 2 + 1
    expect(typeof startEvent?.data.instanceId).toBe("string");
    expect((startEvent?.data.instanceId as string).length).toBe(5);

    const iterEvent = events.find((e) => e.type === EventType.NESTED_ITERATION_COMPLETE);
    expect(iterEvent?.data.depth).toBe(3);
    expect(iterEvent?.data.instanceId).toBe(startEvent?.data.instanceId);

    const completeEvent = events.find((e) => e.type === EventType.NESTED_WORKFLOW_COMPLETE);
    expect(completeEvent?.data.depth).toBe(3);
    expect(completeEvent?.data.instanceId).toBe(startEvent?.data.instanceId);
  });

  test("each child creates a unique file in the relay dir", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter1 = createEmitter();
    const emitter2 = createEmitter();
    await Promise.all([
      runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter1),
      runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter2),
    ]);

    const files = (await readdir(relayDir)).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBe(2);
    // Each file should have a different name
    expect(files[0]).not.toBe(files[1]);
  });

  test("NESTED_WORKFLOW_START event carries the workflow name", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter);

    const events = await readRelayEvents(relayDir);
    const startEvent = events.find((e) => e.type === EventType.NESTED_WORKFLOW_START);
    expect(startEvent?.data.workflow).toBe(WORKFLOW_NAME);
  });

  test("NESTED_WORKFLOW_COMPLETE event carries iteration counts", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter);

    const events = await readRelayEvents(relayDir);
    const completeEvent = events.find((e) => e.type === EventType.NESTED_WORKFLOW_COMPLETE);
    expect(completeEvent?.data.workflow).toBe(WORKFLOW_NAME);
    expect(typeof completeEvent?.data.iterations).toBe("number");
    expect(typeof completeEvent?.data.succeeded).toBe("number");
    expect(typeof completeEvent?.data.failed).toBe("number");
  });

  test("own emitter receives standard events regardless of reportBack setting", async () => {
    process.env[CHILD_EVENTS_ENV_VAR] = relayDir;
    process.env[DEPTH_ENV_VAR] = "0";

    const emitter = createEmitter();
    const events: Event[] = [];
    emitter.subscribe((e) => events.push(e));

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ reportBack: true }), emitter);

    const types = events.map((e) => e.type);
    expect(types).toContain(EventType.ITERATION_START);
    expect(types).toContain(EventType.ITERATION_COMPLETE);
    expect(types).toContain(EventType.RUN_COMPLETE);
  });

  test("top-level process cleans up its relay directory", async () => {
    // Don't set CHILD_EVENTS_ENV_VAR — this makes it top-level
    delete process.env[CHILD_EVENTS_ENV_VAR];
    delete process.env[DEPTH_ENV_VAR];

    const emitter = createEmitter();

    // Capture the relay dir passed to runAgent
    let capturedRelayDir: string | undefined;
    mockRunAgent.mockImplementation((agentConfig: any) => {
      capturedRelayDir = agentConfig.extraEnv?.[CHILD_EVENTS_ENV_VAR];
      return Promise.resolve({
        resultText: "Done.",
        exitCode: 0,
        timedOut: false,
        durationMs: 100,
      });
    });

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig(), emitter);

    expect(capturedRelayDir).toBeDefined();
    // The relay dir should be cleaned up after runLoop completes
    const exists = await Bun.file(join(capturedRelayDir!, ".")).exists().catch(() => false);
    // readdir should fail since dir is removed
    let dirExists = true;
    try {
      await readdir(capturedRelayDir!);
    } catch {
      dirExists = false;
    }
    expect(dirExists).toBe(false);
  });

  test("passes relay dir and depth to child agent via extraEnv", async () => {
    delete process.env[CHILD_EVENTS_ENV_VAR];
    delete process.env[DEPTH_ENV_VAR];

    const emitter = createEmitter();

    let capturedEnv: Record<string, string> | undefined;
    mockRunAgent.mockImplementation((agentConfig: any) => {
      capturedEnv = agentConfig.extraEnv;
      return Promise.resolve({
        resultText: "Done.",
        exitCode: 0,
        timedOut: false,
        durationMs: 100,
      });
    });

    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig(), emitter);

    expect(capturedEnv).toBeDefined();
    expect(capturedEnv![CHILD_EVENTS_ENV_VAR]).toBeDefined();
    expect(capturedEnv![DEPTH_ENV_VAR]).toBe("0"); // top-level depth
  });

  test("stops loop early when completion check returns YES", async () => {
    delete process.env[CHILD_EVENTS_ENV_VAR];
    delete process.env[DEPTH_ENV_VAR];

    const fakeEntry = { frontmatter: { enabled: true }, content: "Is work done?", filePath: "/fake/COMPLETION_CHECK.md" };
    mockDiscoverCompletionCheck.mockImplementation(() => Promise.resolve(fakeEntry));
    mockRunCompletionCheck.mockImplementation(() => Promise.resolve({ completed: true }));

    const emitter = createEmitter();
    const events: import("./events").Event[] = [];
    emitter.subscribe((e) => events.push(e));

    // maxIterations=5 but completion check should stop it after 1
    await runLoop(projectDir, MINIMAL_CONFIG, makeRunConfig({ maxIterations: 5 }), emitter);

    const iterations = events.filter((e) => e.type === EventType.ITERATION_COMPLETE);
    expect(iterations).toHaveLength(1);

    // Restore mocks
    mockDiscoverCompletionCheck.mockImplementation(() => Promise.resolve(null));
    mockRunCompletionCheck.mockImplementation(() => Promise.resolve({ completed: false }));
  });
});

describe("processRelayFiles", () => {
  test("reads .jsonl files and emits parsed events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "otto-relay-prf-"));
    try {
      const event1 = { type: EventType.NESTED_WORKFLOW_START, timestamp: 1, data: { workflow: "w1" } };
      const event2 = { type: EventType.NESTED_ITERATION_COMPLETE, timestamp: 2, data: { iteration: 1 } };
      await Bun.write(join(dir, "child.jsonl"), JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n");

      const emitter = createEmitter();
      const events: Event[] = [];
      emitter.subscribe((e) => events.push(e));

      const positions = new Map<string, number>();
      await processRelayFiles(dir, positions, emitter);

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe(EventType.NESTED_WORKFLOW_START);
      expect(events[1]!.type).toBe(EventType.NESTED_ITERATION_COMPLETE);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("tracks file positions and only reads new content on subsequent calls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "otto-relay-prf-"));
    try {
      const event1 = { type: EventType.NESTED_WORKFLOW_START, timestamp: 1, data: { workflow: "w1" } };
      await Bun.write(join(dir, "child.jsonl"), JSON.stringify(event1) + "\n");

      const emitter = createEmitter();
      const events: Event[] = [];
      emitter.subscribe((e) => events.push(e));

      const positions = new Map<string, number>();

      // First call reads event1
      await processRelayFiles(dir, positions, emitter);
      expect(events).toHaveLength(1);

      // Append a second event
      const event2 = { type: EventType.NESTED_WORKFLOW_COMPLETE, timestamp: 2, data: { workflow: "w1" } };
      const filePath = join(dir, "child.jsonl");
      const existing = await Bun.file(filePath).text();
      await Bun.write(filePath, existing + JSON.stringify(event2) + "\n");

      // Second call only reads event2, not event1 again
      await processRelayFiles(dir, positions, emitter);
      expect(events).toHaveLength(2);
      expect(events[1]!.type).toBe(EventType.NESTED_WORKFLOW_COMPLETE);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

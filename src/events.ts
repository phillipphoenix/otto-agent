export enum EventType {
  ITERATION_START = "iteration_start",
  ITERATION_COMPLETE = "iteration_complete",
  AGENT_ACTIVITY = "agent_activity",
  AGENT_COMPLETE = "agent_complete",
  CHECK_PASSED = "check_passed",
  CHECK_FAILED = "check_failed",
  LOG_MESSAGE = "log_message",
  RUN_COMPLETE = "run_complete",
  NESTED_WORKFLOW_START = "nested_workflow_start",
  NESTED_ITERATION_COMPLETE = "nested_iteration_complete",
  NESTED_WORKFLOW_COMPLETE = "nested_workflow_complete",
}

export interface Event {
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface EventEmitter {
  emit(event: Event): void;
  subscribe(fn: (event: Event) => void): () => void;
}

export function createEmitter(): EventEmitter {
  const listeners = new Set<(event: Event) => void>();

  return {
    emit(event: Event): void {
      for (const fn of listeners) {
        fn(event);
      }
    },

    subscribe(fn: (event: Event) => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

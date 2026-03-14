import { type EventEmitter, EventType } from "./events";

export enum RunStatus {
  IDLE = "idle",
  RUNNING = "running",
  STOPPING = "stopping",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface RunConfig {
  workflow: string;
  maxIterations: number;
  delay: number;
  timeout: number | null;
  stopOnError: boolean;
  logDir: string | null;
  reportBack?: boolean;
}

export class RunState {
  status: RunStatus = RunStatus.IDLE;
  iteration: number = 0;
  succeeded: number = 0;
  failed: number = 0;
  checkFailures: string[] = [];
  startTime: number = Date.now();
  depth: number = 0;
  parentIteration?: number;

  private stopRequested: boolean = false;
  private emitter: EventEmitter | null;

  constructor(emitter?: EventEmitter) {
    this.emitter = emitter ?? null;
  }

  requestStop(): void {
    this.stopRequested = true;
    this.setStatus(RunStatus.STOPPING);
  }

  isStopRequested(): boolean {
    return this.stopRequested;
  }

  incrementIteration(): void {
    this.iteration++;
    this.emitter?.emit({
      type: EventType.ITERATION_START,
      timestamp: Date.now(),
      data: { iteration: this.iteration },
    });
  }

  recordSuccess(): void {
    this.succeeded++;
  }

  recordFailure(failure?: string): void {
    this.failed++;
    if (failure) {
      this.checkFailures.push(failure);
    }
  }

  setStatus(status: RunStatus): void {
    this.status = status;
    this.emitter?.emit({
      type: EventType.LOG_MESSAGE,
      timestamp: Date.now(),
      data: { status },
    });
  }
}

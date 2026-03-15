import React, { useState, useEffect } from "react";
import { Box, useApp } from "ink";
import { EventType } from "../events.ts";
import type { Event, EventEmitter } from "../events.ts";
import type { RunConfig } from "../run-types.ts";
import type { AgentLine } from "./AgentOutput.tsx";
import Banner from "./Banner.tsx";
import Header from "./Header.tsx";
import IterationView from "./IterationView.tsx";
import SummaryView from "./SummaryView.tsx";

interface AppProps {
  emitter: EventEmitter;
  config: RunConfig;
}

interface Summary {
  iterations: number;
  succeeded: number;
  failed: number;
  duration: string;
}

export interface NestedIterationData {
  workflow: string;
  iteration: number;
  status: "success" | "failed";
  resultText?: string;
  depth: number;
  instanceId: string;
}

export interface IterationData {
  iteration: number;
  status: "running" | "success" | "failed" | "timed_out";
  agentLines: AgentLine[];
  checks: Array<{ name: string; passed: boolean }>;
  resultText?: string;
  nestedIterations: NestedIterationData[];
}

function updateLast(
  prev: IterationData[],
  updater: (item: IterationData) => IterationData,
): IterationData[] {
  if (prev.length === 0) return prev;
  const updated = [...prev];
  updated[updated.length - 1] = updater(updated[updated.length - 1]!);
  return updated;
}

export default function App({ emitter, config }: AppProps) {
  const { exit } = useApp();

  const [iterations, setIterations] = useState<IterationData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const unsubscribe = emitter.subscribe((event: Event) => {
      switch (event.type) {
        case EventType.ITERATION_START:
          setIterations((prev) => [
            ...prev,
            {
              iteration: (event.data.iteration as number) ?? 1,
              status: "running",
              agentLines: [],
              checks: [],
              nestedIterations: [],
            },
          ]);
          break;

        case EventType.AGENT_ACTIVITY: {
          const text = (event.data.text as string) ?? "";
          const kind = (event.data.kind as string) === "tool" ? "tool" as const : "text" as const;
          if (text) {
            const line: AgentLine = { kind, text };
            setIterations((prev) =>
              updateLast(prev, (cur) => ({
                ...cur,
                agentLines: [...cur.agentLines, line],
              })),
            );
          }
          break;
        }

        case EventType.ITERATION_COMPLETE: {
          const newStatus = ((event.data.status as string) ?? "success") as IterationData["status"];
          const resultText = (event.data.resultText as string) || undefined;
          setIterations((prev) =>
            updateLast(prev, (cur) => ({ ...cur, status: newStatus, resultText })),
          );
          break;
        }

        case EventType.CHECK_PASSED:
          setIterations((prev) =>
            updateLast(prev, (cur) => ({
              ...cur,
              checks: [...cur.checks, { name: (event.data.name as string) ?? "check", passed: true }],
            })),
          );
          break;

        case EventType.CHECK_FAILED:
          setIterations((prev) =>
            updateLast(prev, (cur) => ({
              ...cur,
              checks: [...cur.checks, { name: (event.data.name as string) ?? "check", passed: false }],
            })),
          );
          break;

        case EventType.NESTED_ITERATION_COMPLETE: {
          const nestedIter: NestedIterationData = {
            workflow: (event.data.workflow as string) ?? "",
            iteration: (event.data.iteration as number) ?? 1,
            status: ((event.data.status as string) ?? "success") as NestedIterationData["status"],
            resultText: (event.data.resultText as string) || undefined,
            depth: (event.data.depth as number) ?? 1,
            instanceId: (event.data.instanceId as string) ?? "",
          };
          setIterations((prev) =>
            updateLast(prev, (cur) => ({
              ...cur,
              nestedIterations: [...cur.nestedIterations, nestedIter],
            })),
          );
          break;
        }

        // NESTED_WORKFLOW_START and NESTED_WORKFLOW_COMPLETE are informational only;
        // the UI derives state from NESTED_ITERATION_COMPLETE events.
        case EventType.NESTED_WORKFLOW_START:
        case EventType.NESTED_WORKFLOW_COMPLETE:
          break;

        case EventType.RUN_COMPLETE:
          setSummary({
            iterations: (event.data.iterations as number) ?? 0,
            succeeded: (event.data.succeeded as number) ?? 0,
            failed: (event.data.failed as number) ?? 0,
            duration: (event.data.duration as string) ?? "0s",
          });
          setTimeout(() => exit(), 100);
          break;
      }
    });

    return unsubscribe;
  }, [emitter, exit]);

  return (
    <Box flexDirection="column">
      <Banner />
      <Header workflow={config.workflow} config={config} />
      {iterations.map((iter, i) => (
        <IterationView
          key={iter.iteration}
          data={iter}
          isLast={i === iterations.length - 1}
        />
      ))}
      {summary && (
        <SummaryView
          iterations={summary.iterations}
          succeeded={summary.succeeded}
          failed={summary.failed}
          duration={summary.duration}
        />
      )}
    </Box>
  );
}

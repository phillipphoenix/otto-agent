import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { IterationData } from "./App.tsx";
import AgentOutput from "./AgentOutput.tsx";
import ChecksView from "./ChecksView.tsx";

interface IterationViewProps {
  data: IterationData;
  isLast: boolean;
}

const DIVIDER = "─".repeat(60);

function StatusBadge({ status }: { status: IterationData["status"] }) {
  if (status === "success") return <Text color="green"> ✓ passed</Text>;
  if (status === "failed") return <Text color="red"> ✗ failed</Text>;
  if (status === "timed_out") return <Text color="red"> ✗ timed out</Text>;
  return null;
}

export default function IterationView({ data, isLast }: IterationViewProps) {
  const isRunning = data.status === "running";

  return (
    <Box flexDirection="column">
      {/* Top divider + header */}
      <Text dimColor>{DIVIDER}</Text>
      <Box>
        <Text bold> Iteration {data.iteration}</Text>
        <StatusBadge status={data.status} />
      </Box>
      <Text dimColor>{DIVIDER}</Text>

      {/* Agent output */}
      <AgentOutput lines={data.agentLines} />

      {/* Checks */}
      <ChecksView checks={data.checks} />

      {/* Spinner at bottom while running */}
      {isRunning && (
        <Box marginTop={0} marginLeft={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text dimColor> working...</Text>
        </Box>
      )}

      {/* Bottom spacing after completed iteration */}
      {!isRunning && <Text> </Text>}
    </Box>
  );
}

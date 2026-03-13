import React from "react";
import { Box, Text } from "ink";
import type { RunConfig } from "../run-types.ts";

interface HeaderProps {
  workflow: string;
  config: RunConfig;
}

export default function Header({ workflow, config }: HeaderProps) {
  const parts: string[] = [];
  if (config.maxIterations > 0) parts.push(`max ${config.maxIterations} iterations`);
  if (config.delay > 0) parts.push(`${config.delay}s delay`);
  if (config.timeout) parts.push(`${config.timeout}s timeout`);
  if (config.stopOnError) parts.push("stop on error");

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text bold>otto</Text> {workflow}
      </Text>
      {parts.length > 0 && <Text dimColor>{parts.join(" · ")}</Text>}
    </Box>
  );
}

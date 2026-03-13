import React from "react";
import { Box, Text } from "ink";

interface SummaryViewProps {
  iterations: number;
  succeeded: number;
  failed: number;
  duration: string;
}

export default function SummaryView({ iterations, succeeded, failed, duration }: SummaryViewProps) {
  return (
    <Box marginTop={1}>
      <Text>
        Done: {iterations} iteration{iterations !== 1 ? "s" : ""} — {" "}
        <Text color="green">{succeeded} succeeded</Text>, {" "}
        <Text color="red">{failed} failed</Text> {" "}
        <Text dimColor>({duration})</Text>
      </Text>
    </Box>
  );
}

import React from "react";
import { Box, Text } from "ink";

interface ChecksViewProps {
  checks: Array<{ name: string; passed: boolean }>;
}

export default function ChecksView({ checks }: ChecksViewProps) {
  if (checks.length === 0) return null;

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={0}>
      {checks.map((check, i) => (
        <Text key={i}>
          {check.passed ? (
            <Text color="green">✓ </Text>
          ) : (
            <Text color="red">✗ </Text>
          )}
          {check.name}
        </Text>
      ))}
    </Box>
  );
}

import React from "react";
import { Box, Text } from "ink";

export interface AgentLine {
  kind: "text" | "tool";
  text: string;
}

interface AgentOutputProps {
  lines: AgentLine[];
  maxLines?: number;
}

/** Truncate a text block to a single summary line. */
function summarizeText(text: string, maxLen = 120): string {
  const oneLine = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + "...";
}

export default function AgentOutput({ lines, maxLines = 20 }: AgentOutputProps) {
  const visible = lines.slice(-maxLines);

  if (visible.length === 0) return null;

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={0}>
      {visible.map((line, i) =>
        line.kind === "tool" ? (
          <Text key={i} color="yellow">
            {`▸ ${line.text}`}
          </Text>
        ) : (
          <Text key={i} dimColor>
            {summarizeText(line.text)}
          </Text>
        ),
      )}
    </Box>
  );
}

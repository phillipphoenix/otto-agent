import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import type { UpdateResult } from "../updater";

interface UpdateNoticeProps {
  result: UpdateResult;
}

export default function UpdateNotice({ result }: UpdateNoticeProps) {
  const { exit } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => exit(), 10_000);
    return () => clearTimeout(timer);
  }, [exit]);

  if (result.status === "up-to-date" || result.status === "error") {
    return null;
  }

  const { from, to, windowsDeferred } = result;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#D4956A"
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Text bold color="#D4956A">
        Otto updated
      </Text>
      <Text>
        <Text color="gray">{from}</Text>
        <Text> → </Text>
        <Text color="green">{to}</Text>
      </Text>
      {windowsDeferred && (
        <Text color="gray" dimColor>
          (will apply on next run)
        </Text>
      )}
    </Box>
  );
}

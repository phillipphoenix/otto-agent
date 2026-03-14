import { render } from "ink";
import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { runUpdate, type UpdateResult } from "../updater";

function UpdateCommand() {
  const { exit } = useApp();
  const [result, setResult] = useState<UpdateResult | null>(null);

  useEffect(() => {
    runUpdate().then((r) => {
      setResult(r);
      // Give the user a moment to read the output before exiting.
      setTimeout(() => exit(), 1500);
    });
  }, [exit]);

  if (!result) {
    return <Text color="gray">Checking for updates…</Text>;
  }

  if (result.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          Update failed
        </Text>
        <Text color="gray">{result.message}</Text>
      </Box>
    );
  }

  if (result.status === "up-to-date") {
    return (
      <Text>
        Already on the latest version{" "}
        <Text color="green">{result.version}</Text>
        .
      </Text>
    );
  }

  // status === "updated"
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#D4956A" paddingX={2} paddingY={1}>
      <Text bold color="#D4956A">
        Otto updated
      </Text>
      <Text>
        <Text color="gray">{result.from}</Text>
        <Text> → </Text>
        <Text color="green">{result.to}</Text>
      </Text>
      {result.windowsDeferred && (
        <Text color="gray" dimColor>
          (will apply on next run)
        </Text>
      )}
    </Box>
  );
}

export async function updateCommand(): Promise<void> {
  const app = render(React.createElement(UpdateCommand));
  await app.waitUntilExit();
}

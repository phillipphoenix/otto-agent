import { z } from "zod";
import { join } from "node:path";

export const OttoConfigSchema = z.object({
  agent: z
    .object({
      command: z.string().default("claude"),
      args: z.array(z.string()).default(["-p", "--dangerously-skip-permissions"]),
      model: z.string().default("sonnet"),
      denyList: z.array(z.string()).default([]),
    })
    .default({
      command: "claude",
      args: ["-p", "--dangerously-skip-permissions"],
      model: "sonnet",
      denyList: [],
    }),
  defaults: z
    .object({
      workflow: z.string().default("default"),
      maxIterations: z.number().default(0),
      delay: z.number().default(0),
      timeout: z.number().nullable().default(null),
      stopOnError: z.boolean().default(false),
      logDir: z.string().nullable().default(null),
    })
    .default({
      workflow: "default",
      maxIterations: 0,
      delay: 0,
      timeout: null,
      stopOnError: false,
      logDir: null,
    }),
});

export type OttoConfig = z.infer<typeof OttoConfigSchema>;

export async function loadConfig(projectDir: string): Promise<OttoConfig> {
  const configPath = join(projectDir, ".otto", "otto.json");
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return OttoConfigSchema.parse({});
  }

  const raw = await file.json();
  return OttoConfigSchema.parse(raw);
}

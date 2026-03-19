export enum PrimitiveType {
  CONTEXT = "context",
  INSTRUCTION = "instruction",
  CHECK = "check",
}

export interface PrimitiveFrontmatter {
  enabled: boolean;
  command: string | null;
  timeout: number | null;
  description: string | null;
}

export interface WorkflowFrontmatter extends PrimitiveFrontmatter {
  model: string | null;
  deny: string[];
}

export interface PrimitiveEntry {
  name: string;
  type: PrimitiveType;
  frontmatter: PrimitiveFrontmatter;
  body: string;
  filePath: string;
  scope: "global" | "workflow";
}

export interface CompletionCheckFrontmatter {
  enabled: boolean;
}

export interface CompletionCheckEntry {
  frontmatter: CompletionCheckFrontmatter;
  body: string;
  filePath: string;
}

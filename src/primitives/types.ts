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

export interface PrimitiveEntry {
  name: string;
  type: PrimitiveType;
  frontmatter: PrimitiveFrontmatter;
  body: string;
  filePath: string;
  scope: "global" | "workflow";
}

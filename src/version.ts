// CURRENT_VERSION is injected at build time via `--define CURRENT_VERSION='"x.y.z"'`.
// Falls back to package.json version in development.
import pkg from "../package.json" with { type: "json" };
declare const CURRENT_VERSION: string;
export const currentVersion: string =
  typeof CURRENT_VERSION !== "undefined" ? CURRENT_VERSION : pkg.version;

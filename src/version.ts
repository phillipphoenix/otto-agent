// CURRENT_VERSION is injected at build time via `--define CURRENT_VERSION='"x.y.z"'`.
// Falls back to "0.0.0" in development.
declare const CURRENT_VERSION: string;
export const currentVersion: string =
  typeof CURRENT_VERSION !== "undefined" ? CURRENT_VERSION : "0.0.0";

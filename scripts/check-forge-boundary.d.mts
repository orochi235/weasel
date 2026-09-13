export function findViolations(input: {
  labkitExports: readonly string[];
  files: readonly { path: string; source: string }[];
}): string[];

export const repoRoot: string;
export function publishableWorkspaces(
  root?: string,
): { dir: string; manifest: Record<string, unknown> & { name: string; version: string } }[];
export function publishablePackageNames(root?: string): string[];

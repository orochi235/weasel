export interface PackageEntry {
  key: string;
  specifier: string;
  source: string | null;
  types: string | null;
}
export const TESTING: string;
export function packageEntries(packageDir: string): PackageEntry[];
export function workspaceEntries(
  repoRoot: string,
): { dir: string; name: string; private: boolean; entries: PackageEntry[] }[];

export const TIERS: string[];
export const SCOPE: string;
export interface TieredPackage {
  dir: string;
  tier: string | undefined;
  deps: string[];
}
export function readPackages(root?: string): Map<string, TieredPackage>;
export function closureOf(packages: Map<string, TieredPackage>): (name: string) => Set<string>;
export function tierProblems(packages: Map<string, TieredPackage>): string[];

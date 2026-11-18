export function narrowerDeps(
  uses: Map<string, Set<string>>,
  reexports: Map<string, Map<string, Set<string>>>,
): { dep: string; instead: string[] }[];

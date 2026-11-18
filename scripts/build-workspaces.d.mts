export const BUILD_AFTER: Record<string, string[]>;
export function buildGraph(
  manifests: {
    name: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }[],
  after?: Record<string, string[]>,
): Map<string, string[]>;
export function buildAll(
  graph: Map<string, string[]>,
  build: (name: string) => number | Promise<number>,
  jobs: number,
): Promise<{ name: string; code: number } | null>;

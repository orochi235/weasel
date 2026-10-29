export function sweepStaleTrees(
  dir: string,
  git: (...args: string[]) => string,
  options?: { host?: string; isAlive?: (pid: number) => boolean; now?: number },
): string[];
export function openCommitTree(
  root: string,
  ref: string,
  prefix: string,
): { commit: string; branch: string; tree: string; drop: () => void; git: (...args: string[]) => string };
export function ontoWhenFree(
  args: string[],
  options: { cwd: string; say: (message: string) => void },
): Promise<number>;

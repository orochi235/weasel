import { isAbsolute, relative, resolve, sep } from 'node:path';

export type OutDirPolicy = { ok: false; reason: string } | { ok: true; outDir: string; emptyOutDir: boolean };

function isStrictlyInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Decide whether `--out` may be built into, and whether vite may empty it first. */
export function outDirPolicy(out: string, cwd: string, root: string): OutDirPolicy {
  const outDir = resolve(cwd, out);
  if (outDir === resolve(cwd) || isStrictlyInside(resolve(cwd), outDir)) {
    return { ok: false, reason: `refusing to build into ${outDir}: it contains the current directory` };
  }
  return { ok: true, outDir, emptyOutDir: isStrictlyInside(outDir, resolve(cwd, root)) };
}

export function formatError(error: unknown, env: Record<string, string | undefined>): string {
  if (!(error instanceof Error)) return `weaselforge: ${String(error)}`;
  const line = `weaselforge: ${error.message}`;
  return env.WEASELFORGE_DEBUG && error.stack ? `${line}\n${error.stack}` : line;
}

import { globSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { prebundleWorkspace } from './vite-prebundle.ts';

/** Whether vitest will watch, read the way it decides: `run` says no, `--watch` yes, a terminal yes outside CI. */
function watches(argv: readonly string[], env: Record<string, string | undefined>, tty: boolean): boolean {
  if (argv.includes('run') || argv.includes('--run') || argv.includes('--watch=false') || argv.includes('--no-watch')) return false;
  if (argv.includes('--watch') || argv.includes('-w')) return true;
  return !env.CI && tty;
}

/** The projects named on the command line, or none when every project runs. */
function projectsNamed(argv: readonly string[]): string[] {
  return argv.flatMap((arg, i) =>
    arg.startsWith('--project=') ? [arg.slice('--project='.length)] : arg === '--project' && argv[i + 1] ? [argv[i + 1]!] : [],
  );
}

export interface BrowserPrebundleOptions {
  /** The project's name, as `--project` names it. */
  readonly name: string;
  /** Globs of the test files, relative to `repoRoot`: the project's `include`. */
  readonly tests: readonly string[];
  /** The project's setup files, relative to `repoRoot`. */
  readonly setupFiles?: readonly string[];
}

/**
 * The plugins and cache directory that serve a browser project the workspace packages pre-bundled
 * (`prebundleWorkspace`), all but what its tests import by path: a test file then loads a few bundles
 * instead of a request per module.
 *
 * Off under `WEASEL_DEV_SOURCE=1`, in watch mode, whose server cannot re-bundle a package edited mid-session, and
 * in a run naming only other projects, which would otherwise read every test's imports to configure a server it
 * never starts.
 */
export function browserPrebundle(
  repoRoot: string,
  { name, tests, setupFiles = [] }: BrowserPrebundleOptions,
  argv: readonly string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  tty = Boolean(process.stdin.isTTY),
): { plugins: Plugin[]; cacheDir?: string } {
  const named = projectsNamed(argv);
  if (env.WEASEL_DEV_SOURCE === '1' || watches(argv, env, tty) || (named.length > 0 && !named.includes(name))) return { plugins: [] };
  // A failed browser test leaves a directory of screenshots named for its file.
  const servedFiles = globSync([...tests, ...setupFiles], { cwd: repoRoot, exclude: (dir) => dir === 'node_modules' })
    .map((file) => resolve(repoRoot, file))
    .filter((file) => statSync(file).isFile());
  return {
    plugins: [prebundleWorkspace(repoRoot, [], { servedFiles, watch: false })],
    // Its own: the stamp and bundles would otherwise be thrown out by every source-served run between.
    cacheDir: `node_modules/.vite-${name}`,
  };
}

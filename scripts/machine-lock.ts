import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A lock every process on the machine sees: a directory, which `mkdir` creates
// atomically, holding its owner's pid. For a resource one machine has one of,
// where two test files, or two test runs, would otherwise use it at once.

export interface MachineLockOptions {
  /** How often a waiter looks again, in ms. */
  pollMs?: number;
  /** A lock held this long is taken over, whether or not its holder still runs. */
  staleMs?: number;
}

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists and belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function abandoned(dir: string, staleMs: number): boolean {
  try {
    if (Date.now() - statSync(dir).mtimeMs > staleMs) return true;
    const pid = Number(readFileSync(join(dir, 'pid'), 'utf8'));
    return Number.isInteger(pid) && !running(pid);
  } catch {
    // Gone, or made and not yet signed: either way not ours to take.
    return false;
  }
}

function tryTake(dir: string, token: string): boolean {
  try {
    mkdirSync(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  }
  writeFileSync(join(dir, 'pid'), String(process.pid));
  writeFileSync(join(dir, 'token'), token);
  return true;
}

/** Move an abandoned lock aside before deleting it: of two waiters that both
 *  see it abandoned, only one rename succeeds, so neither deletes the other's fresh lock. */
function clearAbandoned(dir: string, token: string): void {
  const aside = `${dir}.${token}.stale`;
  try {
    renameSync(dir, aside);
  } catch {
    return;
  }
  rmSync(aside, { recursive: true, force: true });
}

/**
 * Wait for the lock at `dir` and take it. Resolves to its release, which
 * removes the directory unless another holder has since taken the lock over.
 */
export async function holdMachineLock(dir: string, options: MachineLockOptions = {}): Promise<() => void> {
  const { pollMs = 50, staleMs = 120_000 } = options;
  const token = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  while (!tryTake(dir, token)) {
    if (abandoned(dir, staleMs)) clearAbandoned(dir, token);
    else await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return () => {
    try {
      if (readFileSync(join(dir, 'token'), 'utf8') === token) rmSync(dir, { recursive: true, force: true });
    } catch {
      // Already gone.
    }
  };
}

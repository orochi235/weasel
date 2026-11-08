import type { WatchOptions } from 'vite';

/** chokidar's wait for a write to finish: a change is reported once the file has held still this long. */
export const WRITE_SETTLE = { stabilityThreshold: 50, pollInterval: 10 } as const;

/**
 * The watch options that make a server report a change only once its write has settled, or undefined where none are
 * needed or the config already says. Off macOS chokidar drops a `change` within 50 ms of the last one it reported,
 * so a second quick save would leave the first text served; fsevents reports a path's changes ~100 ms apart.
 */
export function settledWatch(
  watch: WatchOptions | null | undefined,
  platform: NodeJS.Platform = process.platform,
): { awaitWriteFinish: typeof WRITE_SETTLE } | undefined {
  if (platform === 'darwin' || watch === null || watch?.awaitWriteFinish !== undefined) return undefined;
  return { awaitWriteFinish: WRITE_SETTLE };
}

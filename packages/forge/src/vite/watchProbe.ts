import { mkdtempSync, rmSync, watch as fsWatch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { messageOf } from '../messageOf.ts';
import { LONGEST_TIMER_MS, WATCH_RECOVERY } from './watchRecovery.ts';

/** Starts a watch on a directory and returns what stops it. */
export type WatchDir = (dir: string, onEvent: () => void) => () => void;

export interface FileEventsOptions {
  /** How long to wait for the report, in milliseconds; past `2 ** 31 - 1`, and at `Infinity`, it waits until the report. Default 5000. */
  waitMs?: number;
  /** Default: `fs.watch`. */
  watch?: WatchDir;
}

const WAIT_MS = 5000;
const REWRITE_MS = 250;

const watchDir: WatchDir = (dir, onEvent) => {
  const watcher = fsWatch(dir, onEvent);
  watcher.on('error', () => {});
  watcher.unref();
  return () => watcher.close();
};

/**
 * Writes a file in a temp directory of its own and answers whether the OS reported the write within the wait. Rejects
 * when it cannot write the file, which says nothing about the watcher.
 */
export function fileEventsArrive({ waitMs = WAIT_MS, watch = watchDir }: FileEventsOptions = {}): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let dir: string;
    try {
      dir = mkdtempSync(join(tmpdir(), 'forge-watch-'));
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    let writes = 0;
    let stop: (() => void) | undefined;
    let rewrite: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const settle = (end: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(rewrite);
      clearTimeout(deadline);
      stop?.();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // A temp directory left behind is the OS's to clear.
      }
      end();
    };
    const write = () => {
      try {
        writeFileSync(join(dir, 'probe'), String(writes++));
      } catch (err) {
        settle(() => reject(err));
      }
    };
    try {
      stop = watch(dir, () => settle(() => resolve(true)));
    } catch {
      settle(() => resolve(false));
      return;
    }
    write();
    if (settled) return;
    rewrite = setInterval(write, REWRITE_MS);
    rewrite.unref();
    if (waitMs <= LONGEST_TIMER_MS) {
      deadline = setTimeout(() => settle(() => resolve(false)), waitMs);
      deadline.unref();
    }
  });
}

const UNREPORTED = `[watch] a file written ${WAIT_MS / 1000} s ago has not been reported by the OS file watcher, `;
const PROBED = '[watch] the watch probe found the OS file watcher reporting no changes, ';
const FSEVENTSD = 'On macOS, look for `fseventsd` held at 100% CPU.';

const SILENT =
  'so an edit will not reach the page until file events arrive again. `server.watch: { usePolling: true }` serves edits ' +
  'without them, and so does the `watchRecovery()` plugin beside `watchProbe()`. ' +
  FSEVENTSD;

const RECOVERING =
  'so edits are found by their modification times instead: on the next request for the module, or within seconds ' +
  'once the watcher is quiet, each logged as it is served. ' +
  FSEVENTSD;

/** The plugin's name; forge leaves the probe to it when a server has one. */
export const WATCH_PROBE = 'weasel-watch-probe';

const probed = new WeakSet<ViteDevServer>();

/** Logs a warning when a dev server that relies on file events is getting none. Probes each server once. */
export async function warnWhenWatchIsSilent(server: ViteDevServer, probe: () => Promise<boolean> = fileEventsArrive): Promise<void> {
  const { watch } = server.config.server;
  if (watch === null || watch?.usePolling || probed.has(server)) return;
  probed.add(server);
  let arrived: boolean;
  try {
    arrived = await probe();
  } catch (err) {
    server.config.logger.warn(`[watch] could not check whether the OS file watcher reports changes: ${messageOf(err)}`);
    return;
  }
  if (arrived) return;
  const recovering = server.config.plugins.some((p) => p.name === WATCH_RECOVERY);
  const lead = probe === fileEventsArrive ? UNREPORTED : PROBED;
  server.config.logger.warn(lead + (recovering ? RECOVERING : SILENT));
}

/** Options for the `watchProbe` vite plugin. */
export interface WatchProbeOptions {
  /**
   * Answers whether the OS is reporting file changes: false makes the plugin log its warning. Called once, as the
   * dev server starts, and not at all where the server polls or does not watch. Default: `fileEventsArrive`,
   * which writes a temp file and waits five seconds for the report.
   */
  probe?: () => Promise<boolean>;
}

/** A plugin giving any dev server the warning forge's own gives when the OS reports no file changes. */
export function watchProbe({ probe }: WatchProbeOptions = {}): Plugin {
  return {
    name: WATCH_PROBE,
    apply: 'serve',
    configureServer(server) {
      void warnWhenWatchIsSilent(server, probe);
    },
  };
}

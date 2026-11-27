import { statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { normalizePath, type Plugin, type ViteDevServer } from 'vite';

/** The plugin's name; a server with two copies runs only the first. */
export const WATCH_RECOVERY = 'weasel-watch-recovery';

/** Options for the `watchRecovery` vite plugin. */
export interface WatchRecoveryOptions {
  /**
   * How long the watcher must have reported nothing before the served files are checked for changes it missed,
   * and how often they are checked while it stays quiet, in milliseconds. Default 2000. Past what one timer holds,
   * `Infinity` among them, the files are checked only as they are served. A change a check finds is pushed once it
   * has gone unreported for half a second, so the watcher's own event is not replayed twice. Throws a `RangeError` for a value that
   * is not above 0.
   */
  quietMs?: number;
}

const QUIET_MS = 2000;
// `@weasel-js/registry`'s LONGEST_TIMER_MS: vitest's config loads this file before any package is built.
export const LONGEST_TIMER_MS = 2 ** 31 - 1;
const STALE_READ_MS = 60_000;
// Longer than a healthy watcher takes to report a write: fsevents runs ~100 ms late, `settledWatch` holds one 50 ms.
const WATCH_LATENCY_MS = 500;

const mtimeOf = (file: string): number | undefined => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
};

const withoutQuery = (url: string) => url.replace(/[?#].*$/s, '');

/** Each module read but not yet transformed, in the order read: its file's modification time, and when. */
function pendingReads() {
  const read = new Map<string, { mtime: number; at: number }>();
  return {
    set(id: string, mtime: number | undefined) {
      const at = Date.now();
      // A load another plugin fails never reaches transform, so its entry goes once it is a minute old.
      for (const [old, entry] of read) {
        if (at - entry.at < STALE_READ_MS) break;
        read.delete(old);
      }
      read.delete(id);
      if (mtime !== undefined) read.set(id, { mtime, at });
    },
    take(id: string): number | undefined {
      const mtime = read.get(id)?.mtime;
      read.delete(id);
      return mtime;
    },
  };
}

type MissedEvent = 'change' | 'unlink';

/** The files vite has served, each module stamped with its file's modification time when vite read it. */
function servedFiles() {
  const stamps = new Map<string, Map<string, number>>();
  const fileOfUrl = new Map<string, string>();
  /** Each file a quiet check found changed, and when it first did; it is replayed once the watcher is past due. */
  const suspects = new Map<string, number>();

  /** The event the watcher owes for a served file: `change` when it was modified since read, `unlink` when gone. */
  const missed = (file: string): MissedEvent | undefined => {
    const modules = stamps.get(file);
    if (!modules) return undefined;
    const now = mtimeOf(file);
    if (now === undefined) return 'unlink';
    for (const stamp of modules.values()) if (stamp !== now) return 'change';
    return undefined;
  };

  return {
    missed,
    fileAt: (url: string) => fileOfUrl.get(url),
    stamp(file: string, id: string, mtime: number, url: string) {
      let modules = stamps.get(file);
      if (!modules) stamps.set(file, (modules = new Map()));
      modules.set(id, mtime);
      fileOfUrl.set(url, file);
    },
    restamp(file: string) {
      suspects.delete(file);
      const modules = stamps.get(file);
      const now = mtimeOf(file);
      if (!modules || now === undefined) return;
      for (const id of modules.keys()) modules.set(id, now);
    },
    forget(file: string) {
      suspects.delete(file);
      stamps.delete(file);
      for (const [url, served] of fileOfUrl) if (served === file) fileOfUrl.delete(url);
    },
    /** Notes each file whose event is missing, and returns those still missing `WATCH_LATENCY_MS` after a check first found them. */
    sweep(now: number): [string, MissedEvent][] {
      const due: [string, MissedEvent][] = [];
      for (const file of stamps.keys()) {
        const event = missed(file);
        const since = suspects.get(file);
        if (!event) suspects.delete(file);
        else if (since === undefined) suspects.set(file, now);
        else if (now - since >= WATCH_LATENCY_MS) due.push([file, event]);
      }
      return due;
    },
    clear() {
      stamps.clear();
      fileOfUrl.clear();
      suspects.clear();
    },
  };
}

/**
 * A plugin that serves an edit the OS never reported. Each module vite serves from a file is stamped with the file's
 * modification time when vite reads it. A request for a module whose file has changed since, and a check of every
 * served file once the watcher has been quiet for `quietMs`, replays the missed change through vite's watcher: the
 * module is transformed again and the open page gets the update, or a reload, as it would have from the event.
 * Each recovery logs one line naming the file.
 */
export function watchRecovery({ quietMs = QUIET_MS }: WatchRecoveryOptions = {}): Plugin {
  if (!(quietMs > 0)) throw new RangeError(`watchRecovery: quietMs must be above 0, got ${quietMs}`);
  const read = pendingReads();
  const served = servedFiles();
  let server: ViteDevServer | undefined;
  let active = false;
  let skipped: (file: string) => boolean = () => true;
  let lastEvent = 0;
  let replaying = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const recover = (file: string, event: MissedEvent, outcome: string) => {
    if (!server) return;
    const name = relative(server.config.root, file);
    if (event === 'unlink') {
      served.forget(file);
      server.config.logger.warn(`[watch] ${name} was deleted with no file event; dropping it from the page`, { timestamp: true });
    } else {
      served.restamp(file);
      for (const environment of Object.values(server.environments)) environment.moduleGraph.onFileChange(file);
      server.config.logger.warn(`[watch] ${name} changed with no file event; ${outcome}`, { timestamp: true });
    }
    replaying = true;
    try {
      server.watcher.emit(event, file);
    } finally {
      replaying = false;
    }
  };

  const sweep = () => {
    const now = Date.now();
    if (now - lastEvent < quietMs) return;
    for (const [file, event] of served.sweep(now)) recover(file, event, 'pushing it to the page');
  };

  const self: Plugin = {
    name: WATCH_RECOVERY,
    apply: 'serve',
    configResolved(config) {
      active = config.server.watch !== null && config.plugins.find((p) => p.name === WATCH_RECOVERY) === self;
      const cacheDir = normalizePath(config.cacheDir) + '/';
      skipped = (file) => !isAbsolute(file) || file.includes('/node_modules/') || file.startsWith(cacheDir);
    },
    configureServer(s) {
      if (!active) return;
      // A restart builds the new server from these same plugin objects before it closes the old one.
      clearInterval(timer);
      timer = undefined;
      served.clear();
      lastEvent = 0;
      server = s;
      for (const event of ['add', 'change', 'unlink'] as const) {
        s.watcher.on(event, (path: string) => {
          if (replaying) return;
          lastEvent = Date.now();
          const file = normalizePath(path);
          if (event === 'unlink') served.forget(file);
          else served.restamp(file);
        });
      }
      const base = s.config.base;
      s.middlewares.use(function weaselWatchRecovery(req, _res, next) {
        let url = withoutQuery(req.url ?? '');
        if (base !== '/' && url.startsWith(base)) url = url.slice(base.length - 1);
        let file: string | undefined;
        try {
          file = served.fileAt(decodeURI(url));
        } catch {
          // A malformed URL is vite's to answer.
        }
        const event = file === undefined ? undefined : served.missed(file);
        if (file && event) recover(file, event, 'serving the new text');
        next();
      });
      if (quietMs <= LONGEST_TIMER_MS) {
        timer = setInterval(sweep, quietMs);
        timer.unref();
      }
    },
    load: {
      order: 'pre',
      handler(id) {
        if (!active || this.environment.name !== 'client') return;
        const file = withoutQuery(id);
        if (skipped(file)) return;
        read.set(id, mtimeOf(file));
      },
    },
    transform: {
      order: 'pre',
      handler(_code, id) {
        if (this.environment.name !== 'client') return;
        const mtime = read.take(id);
        if (mtime === undefined) return;
        if (this.environment.mode !== 'dev') return;
        const mod = this.environment.moduleGraph.getModuleById(id);
        if (!mod?.file) return;
        served.stamp(mod.file, id, mtime, withoutQuery(mod.url));
      },
    },
    buildEnd() {
      if (server && server.environments[this.environment.name] !== this.environment) return;
      clearInterval(timer);
    },
  };
  return self;
}

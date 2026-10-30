import { statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { normalizePath, type Plugin, type ViteDevServer } from 'vite';

/** The plugin's name; a server with two copies runs only the first. */
export const WATCH_RECOVERY = 'weasel-watch-recovery';

/** Options for the `watchRecovery` vite plugin. */
export interface WatchRecoveryOptions {
  /**
   * How long the watcher must have reported nothing before the served files are checked for changes it missed,
   * and how often they are checked while it stays quiet, in milliseconds. Default 2000.
   */
  quietMs?: number;
}

const QUIET_MS = 2000;

const mtimeOf = (file: string): number | undefined => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
};

const withoutQuery = (url: string) => url.replace(/[?#].*$/s, '');

/**
 * A plugin that serves an edit the OS never reported. Each module vite serves from a file is stamped with the file's
 * modification time when vite reads it. A request for a module whose file has changed since, and a check of every
 * served file once the watcher has been quiet for `quietMs`, replays the missed change through vite's watcher: the
 * module is transformed again and the open page gets the update, or a reload, as it would have from the event.
 * Each recovery logs one line naming the file.
 */
export function watchRecovery({ quietMs = QUIET_MS }: WatchRecoveryOptions = {}): Plugin {
  /** Each served file's modules, with the file's modification time when vite read it for that module. */
  const stamps = new Map<string, Map<string, number>>();
  const read = new Map<string, number>();
  const fileOfUrl = new Map<string, string>();
  let server: ViteDevServer | undefined;
  let active = false;
  let skipped: (file: string) => boolean = () => true;
  let lastEvent = 0;
  let replaying = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const restamp = (file: string) => {
    const modules = stamps.get(file);
    const now = mtimeOf(file);
    if (!modules || now === undefined) return;
    for (const id of modules.keys()) modules.set(id, now);
  };

  const missed = (file: string) => {
    const modules = stamps.get(file);
    const now = mtimeOf(file);
    if (!modules || now === undefined) return false;
    for (const stamp of modules.values()) if (stamp !== now) return true;
    return false;
  };

  const recover = (file: string, outcome: string) => {
    if (!server) return;
    restamp(file);
    for (const environment of Object.values(server.environments)) environment.moduleGraph.onFileChange(file);
    server.config.logger.warn(`[watch] ${relative(server.config.root, file)} changed with no file event; ${outcome}`, {
      timestamp: true,
    });
    replaying = true;
    try {
      server.watcher.emit('change', file);
    } finally {
      replaying = false;
    }
  };

  const sweep = () => {
    if (Date.now() - lastEvent < quietMs) return;
    for (const file of stamps.keys()) if (missed(file)) recover(file, 'pushing it to the page');
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
      server = s;
      for (const event of ['add', 'change', 'unlink'] as const) {
        s.watcher.on(event, (path: string) => {
          if (replaying) return;
          lastEvent = Date.now();
          const file = normalizePath(path);
          if (event === 'unlink') stamps.delete(file);
          else restamp(file);
        });
      }
      const base = s.config.base;
      s.middlewares.use(function weaselWatchRecovery(req, _res, next) {
        let url = withoutQuery(req.url ?? '');
        if (base !== '/' && url.startsWith(base)) url = url.slice(base.length - 1);
        let file: string | undefined;
        try {
          file = fileOfUrl.get(decodeURI(url));
        } catch {
          // A malformed URL is vite's to answer.
        }
        if (file && missed(file)) recover(file, 'serving the new text');
        next();
      });
      timer = setInterval(sweep, quietMs);
      timer.unref();
    },
    load: {
      order: 'pre',
      handler(id) {
        if (!active || this.environment.name !== 'client') return;
        const file = withoutQuery(id);
        if (skipped(file)) return;
        const mtime = mtimeOf(file);
        if (mtime !== undefined) read.set(id, mtime);
      },
    },
    transform: {
      order: 'pre',
      handler(_code, id) {
        const mtime = read.get(id);
        if (mtime === undefined) return;
        read.delete(id);
        if (this.environment.mode !== 'dev') return;
        const mod = this.environment.moduleGraph.getModuleById(id);
        if (!mod?.file) return;
        let modules = stamps.get(mod.file);
        if (!modules) stamps.set(mod.file, (modules = new Map()));
        modules.set(id, mtime);
        fileOfUrl.set(withoutQuery(mod.url), mod.file);
      },
    },
    buildEnd() {
      clearInterval(timer);
    },
  };
  return self;
}

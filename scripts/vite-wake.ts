import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { IndexHtmlTransformHook, Plugin } from 'vite';

/** Options for `localWake`. */
export interface LocalWakeOptions {
  fallback?: readonly number[];
  /** Pages, by request path, that get none of wake's markup: its client and its badge. */
  skip?: (path: string) => boolean;
}

/**
 * vite-plugin-wake from this machine's checkout of it, or no plugin where there is none. It is not
 * published, so CI and a fresh clone must build without it.
 */
export function localWake({ skip, ...options }: LocalWakeOptions = {}): Plugin | null {
  const entry = process.env.WAKE_PATH ?? join(homedir(), 'src/wake/dist/index.js');
  if (!existsSync(entry)) {
    if (!process.env.CI) console.warn(`wake: ${entry} not found; serving without one-copy-per-app`);
    return null;
  }
  // Not `import()`: a config reloaded through vite's module runner can no longer load lazily (docs/traps/build-dev.md).
  const { wake } = createRequire(import.meta.url)(resolve(entry)) as {
    wake: (o: { fallback?: readonly number[] }) => Plugin;
  };
  const plugin = wake(options);
  const hook = plugin.transformIndexHtml;
  if (!skip || !hook) return plugin;
  const handler = (typeof hook === 'function' ? hook : hook.handler) as IndexHtmlTransformHook;
  const skipping: IndexHtmlTransformHook = function (html, ctx) {
    return skip(ctx.path) ? undefined : handler.call(this, html, ctx);
  };
  return { ...plugin, transformIndexHtml: typeof hook === 'function' ? skipping : { ...hook, handler: skipping } };
}

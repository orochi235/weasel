/**
 * Namespaced, opt-in console tracing. Off by default; production builds
 * may strip the calls entirely depending on the bundler.
 *
 * Enable in the browser:
 *
 *   localStorage.setItem('weasel.debug', '*')               // all namespaces
 *   localStorage.setItem('weasel.debug', 'curve-editor')    // just curve editor
 *   localStorage.setItem('weasel.debug', 'curve-editor,layer-stack')
 *
 * Each component picks a stable namespace and calls `dlog(namespace, ...)`.
 * Useful for tracing pointer/event flows that are hard to capture
 * post-hoc (drag handlers, gesture sequences, selection mutations).
 *
 * The flag is read once and cached for the page session — reload to
 * pick up changes. Cheap hot-path checks (one nullish-coalesce + Set
 * lookup) so leaving calls in place is fine.
 */

const KEYS = ['weasel.debug', 'weaseldraw.debug'] as const;

interface Cached {
  all: boolean;
  set: Set<string>;
}

let cached: Cached | null = null;

function read(): Cached {
  const empty: Cached = { all: false, set: new Set() };
  if (typeof localStorage === 'undefined') return empty;
  try {
    for (const k of KEYS) {
      const v = localStorage.getItem(k);
      if (v == null || v === '') continue;
      if (v === '1' || v === 'true' || v === '*') return { all: true, set: new Set() };
      return { all: false, set: new Set(v.split(/[\s,]+/).filter(Boolean)) };
    }
    return empty;
  } catch {
    return empty;
  }
}

function get(): Cached {
  if (cached === null) cached = read();
  return cached;
}

/** True when `namespace` (or `*`) is enabled. */
export function isDebugEnabled(namespace: string): boolean {
  const c = get();
  return c.all || c.set.has(namespace);
}

/** Conditional `console.debug` — no-op unless `namespace` (or `*`) is enabled.
 *  Each call is prefixed with `[namespace]` so the source is searchable. */
export function dlog(namespace: string, ...args: unknown[]): void {
  if (!isDebugEnabled(namespace)) return;
  // eslint-disable-next-line no-console
  console.debug(`[${namespace}]`, ...args);
}

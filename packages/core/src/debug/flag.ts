/**
 * Namespaced, opt-in console tracing for the kit.
 *
 * Enable in the browser:
 *
 *   localStorage.setItem('weasel.debug', '*')                 // all namespaces
 *   localStorage.setItem('weasel.debug', 'tools,dispatch')    // specific ones
 *   localStorage.setItem('weasel.debug', '1')                 // legacy "all"
 *
 * Each call site picks a stable namespace string. Off by default; the flag
 * is read once and cached per page session — reload to pick up a change.
 *
 * Mirrors `packages/ui/src/dlog.ts`. The two impls live in separate
 * packages because weasel-ui doesn't depend on the kit, but both read the
 * same localStorage keys so behavior is uniform from a debugger's POV.
 *
 * Known kit namespaces:
 *   - tools           — active-tool + hotkey transitions (useTools)
 *   - dispatch        — gesture start / end / cancel (dispatcher)
 *   - drag-rect       — useDragRect lifecycle
 *   - drag-radial     — useDragRadial lifecycle
 *   - scene           — restored-op replay gaps (history persistence)
 *   - scene-canvas    — SceneCanvas mount / unmount; adapter paste-translation warnings
 *   - history         — applyOps push, no-op suppression, serialize/restore
 *   - clipboard       — OS clipboard write/read failures, malformed payloads
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

/** True when `namespace` (or `*`) is enabled. Pass no argument to test
 *  whether *any* namespace is on (legacy global-flag semantics). */
export function isDebugEnabled(namespace?: string): boolean {
  const c = get();
  if (c.all) return true;
  if (namespace === undefined) return c.set.size > 0;
  return c.set.has(namespace);
}

/** Conditional `console.debug` — no-op unless `namespace` (or `*`) is enabled.
 *  Each call is prefixed with `[namespace]` so the source is searchable. */
export function dlog(namespace: string, ...args: unknown[]): void {
  if (!isDebugEnabled(namespace)) return;
  // eslint-disable-next-line no-console
  console.debug(`[${namespace}]`, ...args);
}

/** Conditional `console.warn` — like `dlog` but at warn level. Use for
 *  diagnostics that indicate something worth surfacing during debugging
 *  (e.g. no-op op batches suppressed). */
export function dwarn(namespace: string, ...args: unknown[]): void {
  if (!isDebugEnabled(namespace)) return;
  // eslint-disable-next-line no-console
  console.warn(`[${namespace}]`, ...args);
}

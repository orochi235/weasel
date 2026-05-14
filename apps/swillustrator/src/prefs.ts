// `swill.prefs.v2` — per-user preferences as a nested tree.
//
// Each leaf is a `SwillPref` with metadata (kind / name / description /
// default). Groups carry their own name/description so a future settings UI
// can render section headers without a side table. On disk the blob mirrors
// the tree's *value* shape under a single localStorage key.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type SwillPrefKind = 'number' | 'boolean' | 'string' | 'enum' | 'object';

interface SwillPrefBase<K extends SwillPrefKind, Value> {
  kind: K;
  /** Human-readable label, e.g. "Show grid". */
  name: string;
  /** Longer help text — shown in tooltips / a settings pane. */
  description: string;
  /** Fallback when nothing is persisted. */
  default: Value;
}

export interface SwillPrefNumber extends SwillPrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
}
export interface SwillPrefBoolean extends SwillPrefBase<'boolean', boolean> {}
export interface SwillPrefString extends SwillPrefBase<'string', string> {}
export interface SwillPrefEnum<T extends string = string>
  extends SwillPrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
}
/** Catch-all for non-primitive shapes (panels map, future color records). */
export interface SwillPrefObject<T = unknown> extends SwillPrefBase<'object', T> {}

export type SwillPref =
  | SwillPrefNumber
  | SwillPrefBoolean
  | SwillPrefString
  | SwillPrefEnum
  | SwillPrefObject;

/** Nestable group: branch nodes in the registry tree. */
export interface SwillPrefGroup {
  name: string;
  description?: string;
  children: Record<string, SwillPref | SwillPrefGroup>;
}

// ──────────────────────────────────────────────────────────────────────────
// Registry — single source of truth for available prefs + their defaults.
// `satisfies SwillPrefGroup` keeps the inferred shape narrow (literal `kind`
// discriminants and literal `default` types) while still type-checking the
// tree shape.
// ──────────────────────────────────────────────────────────────────────────

export const PREFS = {
  name: 'Swillustrator preferences',
  description: 'User-customizable settings persisted across sessions.',
  children: {
    ui: {
      name: 'Interface',
      description: 'Layout and chrome.',
      children: {
        rightSidebarWidth: {
          kind: 'number',
          name: 'Right sidebar width',
          description: 'Width of the properties sidebar (pixels).',
          default: 260,
          min: 200,
          max: 600,
        },
        leftSidebarWidth: {
          kind: 'number',
          name: 'Left sidebar width',
          description: 'Reserved — the tool palette is fixed-width today.',
          default: 56,
          min: 40,
          max: 200,
        },
        panels: {
          kind: 'object',
          name: 'Panel visibility',
          description: 'Hidden/collapsed state per properties-panel section.',
          default: {} as Record<string, { hidden?: boolean; collapsed?: boolean }>,
        },
      },
    },
    view: {
      name: 'View',
      description: 'Canvas overlays and zoom.',
      children: {
        gridVisible: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Display the grid overlay on the canvas.',
          default: true,
        },
        gridDensity: {
          kind: 'number',
          name: 'Grid density',
          description: 'Spacing between grid lines, in document units (one inch = 72 at the default unit).',
          default: 72,
          min: 4,
          max: 288,
          step: 4,
        },
        snapToGrid: {
          kind: 'boolean',
          name: 'Snap to grid',
          description: 'Constrain move/resize gestures to grid intersections.',
          default: false,
        },
      },
    },
    tools: {
      name: 'Tools',
      description: 'Tool memory.',
      children: {
        lastTool: {
          kind: 'string',
          name: 'Last used tool',
          description: 'Restored on app start.',
          default: 'select',
        },
        penAutoCommitOnClose: {
          kind: 'boolean',
          name: 'Auto-commit pen on close',
          description: 'When you click the pen tool\'s first anchor to close a region, commit immediately so it renders with its fill. Off: keep the path in preview until you press Enter (lets you build a compound path from multiple closed subpaths).',
          default: true,
        },
      },
    },
  },
} satisfies SwillPrefGroup;

export type PrefsRegistry = typeof PREFS;

// ──────────────────────────────────────────────────────────────────────────
// Type-level path inference
// ──────────────────────────────────────────────────────────────────────────

type PrefValue<P> =
  P extends SwillPrefBoolean ? boolean :
  P extends SwillPrefNumber  ? number  :
  P extends SwillPrefString  ? string  :
  P extends SwillPrefEnum<infer T>   ? T :
  P extends SwillPrefObject<infer T> ? T :
  never;

type PrefPaths<G, Prefix extends string = ''> =
  G extends { children: infer C }
    ? {
        [K in keyof C & string]:
          C[K] extends { kind: SwillPrefKind }
            ? Prefix extends '' ? K : `${Prefix}.${K}`
            : C[K] extends { children: Record<string, unknown> }
              ? PrefPaths<C[K], Prefix extends '' ? K : `${Prefix}.${K}`>
              : never;
      }[keyof C & string]
    : never;

type PrefAtPath<G, P extends string> =
  G extends { children: infer C }
    ? P extends `${infer H}.${infer Rest}`
      ? H extends keyof C
        ? PrefAtPath<C[H], Rest>
        : never
      : P extends keyof C
        ? C[P] extends { kind: SwillPrefKind }
          ? C[P]
          : never
        : never
    : never;

export type SwillPrefPath = PrefPaths<PrefsRegistry>;
export type PrefValueAt<P extends SwillPrefPath> = PrefValue<PrefAtPath<PrefsRegistry, P>>;

// ──────────────────────────────────────────────────────────────────────────
// Storage — nested mirror under one localStorage key.
// ──────────────────────────────────────────────────────────────────────────

export const PREFS_KEY = 'swill.prefs.v2';

interface PersistedRoot {
  version: 2;
  [k: string]: unknown;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
      return (globalThis as { localStorage?: Storage }).localStorage!;
    }
  } catch {
    /* ignored */
  }
  return null;
}

function readRoot(): PersistedRoot | null {
  try {
    const s = getStorage();
    if (!s) return null;
    const raw = s.getItem(PREFS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as { version?: unknown } & Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object') return null;
    if (parsed.version !== 2) return null;
    return parsed as PersistedRoot;
  } catch {
    return null;
  }
}

function writeRoot(next: PersistedRoot): void {
  try {
    const s = getStorage();
    if (!s) return;
    s.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignored */
  }
}

/** Get the value at a dotted path inside any object tree. Returns
 *  `undefined` when a segment is missing or hits a non-object. */
function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Set the value at a dotted path. Creates intermediate objects as needed.
 *  Returns a new root (does not mutate the input). */
function setAtPath<T extends Record<string, unknown>>(
  root: T, path: string, value: unknown,
): T {
  const parts = path.split('.');
  const out: Record<string, unknown> = { ...root };
  let cursor: Record<string, unknown> = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    const next = cursor[seg];
    const branch: Record<string, unknown> =
      next && typeof next === 'object' ? { ...(next as Record<string, unknown>) } : {};
    cursor[seg] = branch;
    cursor = branch;
  }
  cursor[parts[parts.length - 1]] = value;
  return out as T;
}

/** Walk the registry to find the descriptor at a dotted path. */
function descriptorAt(path: string): SwillPref | null {
  const parts = path.split('.');
  let cur: SwillPref | SwillPrefGroup = PREFS;
  for (const p of parts) {
    if (!('children' in cur)) return null;
    const next: SwillPref | SwillPrefGroup | undefined = cur.children[p];
    if (!next) return null;
    cur = next;
  }
  return 'kind' in cur ? cur : null;
}

/** One-shot read for code paths that need a value before React mounts. */
export function readPref<P extends SwillPrefPath>(path: P): PrefValueAt<P> {
  const desc = descriptorAt(path);
  if (!desc) throw new Error(`readPref: unknown path ${path}`);
  const root = readRoot();
  const stored = root ? getAtPath(root, path) : undefined;
  if (stored !== undefined) return stored as PrefValueAt<P>;
  return desc.default as PrefValueAt<P>;
}

// Coalesce writes within a tick so slider drags don't hammer storage.
let pendingRoot: PersistedRoot | null = null;
let writeScheduled = false;
function schedulePrefsWrite(path: string, value: unknown): void {
  const base: PersistedRoot = pendingRoot ?? readRoot() ?? { version: 2 };
  pendingRoot = setAtPath(base, path, value);
  pendingRoot.version = 2;
  if (writeScheduled) return;
  writeScheduled = true;
  queueMicrotask(() => {
    writeScheduled = false;
    const toWrite = pendingRoot;
    pendingRoot = null;
    if (toWrite) writeRoot(toWrite);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

/**
 * Bind a single pref to React state. Default + metadata come from the
 * registry; the call site supplies only the path.
 */
export function usePref<P extends SwillPrefPath>(
  path: P,
): [
  PrefValueAt<P>,
  (v: PrefValueAt<P> | ((prev: PrefValueAt<P>) => PrefValueAt<P>)) => void,
] {
  const desc = useMemo(() => {
    const d = descriptorAt(path);
    if (!d) throw new Error(`usePref: unknown path ${path}`);
    return d;
  }, [path]);

  const [value, setValue] = useState<PrefValueAt<P>>(() => {
    const root = readRoot();
    const stored = root ? getAtPath(root, path) : undefined;
    return (stored !== undefined ? stored : desc.default) as PrefValueAt<P>;
  });

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    schedulePrefsWrite(path, value);
  }, [path, value]);

  const set = useCallback(
    (next: PrefValueAt<P> | ((prev: PrefValueAt<P>) => PrefValueAt<P>)) => {
      setValue((prev) => {
        return typeof next === 'function'
          ? (next as (p: PrefValueAt<P>) => PrefValueAt<P>)(prev)
          : next;
      });
    },
    [],
  );

  return [value, set];
}

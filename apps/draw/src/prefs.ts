// `weaseldraw.prefs.v2` — per-user preferences as a nested tree.
//
// Each leaf is a `WeaselDrawPref` with metadata (kind / name / description /
// default). Groups carry their own name/description so a future settings UI
// can render section headers without a side table. On disk the blob mirrors
// the tree's *value* shape under a single localStorage key.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  PrefBase,
  PrefBoolean,
  PrefEnum,
  PrefEnumControl,
  PrefGroup,
  PrefKind,
  PrefLeaf,
  PrefNumber,
  PrefString,
} from '@weasel-js/prefs';
import { usePenTool } from '@weasel-js/core';
import type { RegistryEnumFilter } from './registry/types';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type WeaselDrawPrefKind = PrefKind | 'registry-enum' | 'data';

export type WeaselDrawPrefNumber = PrefNumber;
export type WeaselDrawPrefBoolean = PrefBoolean;
export type WeaselDrawPrefString = PrefString;
export type WeaselDrawPrefEnum<T extends string = string> = PrefEnum<T>;

/** Enum whose options come from a runtime registry — `tools.lastTool` picks
 *  from whichever tools the app registered. `source` keys into the modal's
 *  `registryEnumSources`; the value is a string at rest. */
export interface WeaselDrawPrefRegistryEnum extends PrefBase<'registry-enum', string> {
  source: string;
  control?: PrefEnumControl;
  filter?: RegistryEnumFilter;
}

/** A value other code owns and the form only displays or hands to a bespoke
 *  editor (`ui.panels`). Unlike core's `object`, it has no `children`. */
export type WeaselDrawPrefData<T = unknown> = PrefBase<'data', T>;

export type WeaselDrawPref = PrefLeaf;
export type WeaselDrawPrefGroup = PrefGroup;

/**
 * Compose tool-contributed pref groups into a `Record<string, PrefGroup>`
 * keyed by tool id. The function is the identity at runtime — its only job
 * is to capture each contribution's literal type so `typeof PREFS` still
 * drives `WeaselDrawPrefPath` after composition.
 */
function composeToolPrefs<T extends Record<string, PrefGroup>>(t: T): T {
  return t;
}

// Declared apart: inline, core's open `kind: string` leaf widens the literal
// `kind` (dropping the path from `WeaselDrawPrefPath`) and rejects `source`.
const PANELS_PREF = {
  kind: 'data',
  name: 'Panel visibility',
  description: 'Hidden/collapsed state per right-sidebar panel.',
  block: true,
  default: {} as Record<string, { hidden?: boolean; collapsed?: boolean }>,
} as const satisfies WeaselDrawPrefData;

const LAST_TOOL = {
  kind: 'registry-enum',
  source: 'tools',
  name: 'Last used tool',
  description: 'Restored on app start.',
  default: 'select',
} as const satisfies WeaselDrawPrefRegistryEnum;

// ──────────────────────────────────────────────────────────────────────────
// Registry — single source of truth for available prefs + their defaults.
// `satisfies WeaselDrawPrefGroup` keeps the inferred shape narrow (literal `kind`
// discriminants and literal `default` types) while still type-checking the
// tree shape.
// ──────────────────────────────────────────────────────────────────────────

export const PREFS = {
  name: 'WeaselDraw preferences',
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
        panels: PANELS_PREF,
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
          control: 'slider',
        },
        snapToGrid: {
          kind: 'boolean',
          name: 'Snap to grid',
          description: 'Constrain move/resize gestures to grid intersections.',
          default: false,
        },
      },
    },
    text: {
      name: 'Text',
      description: 'How type is rendered.',
      children: {
        machineFontOutlines: {
          kind: 'boolean',
          name: 'Sharp text from installed fonts',
          description:
            'Read the outlines of your installed fonts so large text is drawn as exact geometry instead of a distance field sampled from a 48px raster — which ripples visibly once you zoom in. Needs your permission to list local fonts, and only Chromium-based browsers offer it; without it, large text keeps rendering the way it does today. The bundled default face is already sharp either way.',
          default: false,
        },
      },
    },
    drawing: {
      name: 'Drawing',
      description: 'Defaults applied to newly-created paths and shapes.',
      children: {
        pathFillRule: {
          kind: 'enum',
          name: 'Path fill rule',
          description: 'How self-intersecting paths fill. Nonzero (SVG default) leaves a hole anywhere two opposite-winding loops overlap; evenodd fills any region enclosed by an odd number of edges. Switch to evenodd if you draw lasso-style outlines that cross themselves.',
          default: 'nonzero',
          options: [
            { value: 'nonzero', label: 'Nonzero (SVG default)' },
            { value: 'evenodd', label: 'Even-odd' },
          ],
        },
      },
    },
    tools: {
      name: 'Tools',
      description: 'Tool memory and per-tool settings.',
      children: {
        lastTool: LAST_TOOL,
        ...composeToolPrefs({
          pen: usePenTool.prefs,
        }),
      },
    },
  },
} satisfies WeaselDrawPrefGroup;

export type PrefsRegistry = typeof PREFS;

// ──────────────────────────────────────────────────────────────────────────
// Type-level path inference
// ──────────────────────────────────────────────────────────────────────────

type PrefValue<P> =
  P extends WeaselDrawPrefBoolean ? boolean :
  P extends WeaselDrawPrefNumber  ? number  :
  P extends WeaselDrawPrefString  ? string  :
  P extends WeaselDrawPrefEnum<infer T>   ? T :
  P extends WeaselDrawPrefRegistryEnum    ? string :
  P extends WeaselDrawPrefData<infer T>   ? T :
  never;

type PrefPaths<G, Prefix extends string = ''> =
  G extends { children: infer C }
    ? {
        [K in keyof C & string]:
          C[K] extends { kind: WeaselDrawPrefKind }
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
        ? C[P] extends { kind: WeaselDrawPrefKind }
          ? C[P]
          : never
        : never
    : never;

export type WeaselDrawPrefPath = PrefPaths<PrefsRegistry>;
export type PrefValueAt<P extends WeaselDrawPrefPath> = PrefValue<PrefAtPath<PrefsRegistry, P>>;

// ──────────────────────────────────────────────────────────────────────────
// Storage — nested mirror under one localStorage key.
// ──────────────────────────────────────────────────────────────────────────

export const PREFS_KEY = 'weaseldraw.prefs.v2';

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
function descriptorAt(path: string): WeaselDrawPref | null {
  const parts = path.split('.');
  let cur: WeaselDrawPref | WeaselDrawPrefGroup = PREFS;
  for (const p of parts) {
    if (!('children' in cur)) return null;
    const next: WeaselDrawPref | WeaselDrawPrefGroup | undefined = cur.children[p];
    if (!next) return null;
    cur = next;
  }
  return 'kind' in cur ? cur : null;
}

/** One-shot read for code paths that need a value before React mounts. */
export function readPref<P extends WeaselDrawPrefPath>(path: P): PrefValueAt<P> {
  const desc = descriptorAt(path);
  if (!desc) throw new Error(`readPref: unknown path ${path}`);
  const stored = getAtPath(currentRoot(), path);
  if (stored !== undefined) return stored as PrefValueAt<P>;
  return desc.default as PrefValueAt<P>;
}

// Coalesce writes within a tick so slider drags don't hammer storage.
let pendingRoot: PersistedRoot | null = null;
let writeScheduled = false;

/** The persisted root including writes still waiting on the microtask. */
function currentRoot(): Record<string, unknown> {
  return pendingRoot ?? readRoot() ?? {};
}

// Every live binding hears every write, so the Preferences dialog and an
// inline control bound to the same path stay in step.
type PrefListener = (path: string, value: unknown, source: object) => void;
const listeners = new Set<PrefListener>();
function notify(path: string, value: unknown, source: object): void {
  for (const l of listeners) l(path, value, source);
}

const WRITE_PREF_SOURCE = {};

/** Write a pref outside React (migrations, startup code). Live bindings
 *  of the path update. */
export function writePref<P extends WeaselDrawPrefPath>(path: P, value: PrefValueAt<P>): void {
  schedulePrefsWrite(path, value);
  notify(path, value, WRITE_PREF_SOURCE);
}
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
export function usePref<P extends WeaselDrawPrefPath>(
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
    const stored = getAtPath(currentRoot(), path);
    return (stored !== undefined ? stored : desc.default) as PrefValueAt<P>;
  });

  // The last value this binding agrees with storage on — a change away
  // from it is a local edit to persist and broadcast; a broadcast sets it.
  const syncedRef = useRef<unknown>(value);
  const selfRef = useRef({});
  useEffect(() => {
    const listener: PrefListener = (p, v, source) => {
      if (p !== path || source === selfRef.current) return;
      syncedRef.current = v;
      setValue(v as PrefValueAt<P>);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [path]);
  useEffect(() => {
    if (Object.is(value, syncedRef.current)) return;
    syncedRef.current = value;
    schedulePrefsWrite(path, value);
    notify(path, value, selfRef.current);
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

/**
 * Whole-tree binding for the Preferences dialog (kit `PrefsForm` is
 * controlled: values tree + dotted-path onChange). Reads the persisted
 * root once per mount; writes ride the same coalesced
 * `schedulePrefsWrite` path as `usePref`, and hears writes from every
 * other live binding.
 */
export function usePrefsValues(): [unknown, (path: string, value: unknown) => void] {
  const [values, setValues] = useState<Record<string, unknown>>(currentRoot);
  const selfRef = useRef({});
  useEffect(() => {
    const listener: PrefListener = (path, value, source) => {
      if (source === selfRef.current) return;
      setValues((prev) => setAtPath(prev, path, value));
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const setAt = useCallback((path: string, value: unknown) => {
    setValues((prev) => setAtPath(prev, path, value));
    schedulePrefsWrite(path, value);
    notify(path, value, selfRef.current);
  }, []);
  return [values, setAt];
}

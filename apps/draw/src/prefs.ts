// WeaselDraw's per-user preferences: the schema, and the store over
// localStorage that holds them, one record per leaf.

import { usePenTool } from '@weasel-js/core';
import {
  flattenPrefValues,
  openPrefsSync,
  usePref as usePrefOf,
  type PrefBase,
  type PrefEnumControl,
  type PrefGroup,
  type PrefPath,
  type PrefsStore,
  type PrefValueAt,
} from '@weasel-js/prefs';
import { localStorageAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
import type { RegistryEnumFilter } from './registry/types';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/** Enum whose options come from a runtime registry — `tools.lastTool` picks
 *  from whichever tools the app registered. `source` keys into the modal's
 *  `registryEnumSources`; the value is a string at rest. */
export interface WeaselDrawPrefRegistryEnum extends PrefBase<'registry-enum', string> {
  source: string;
  control?: PrefEnumControl;
  filter?: RegistryEnumFilter;
}

/** A value other code owns and the form only displays or hands to a bespoke
 *  editor (`ui.panels`). Unlike the built-in `object`, it has no `children`. */
export type WeaselDrawPrefData<T = unknown> = PrefBase<'data', T>;

/**
 * Compose tool-contributed pref groups into a `Record<string, PrefGroup>`
 * keyed by tool id. The function is the identity at runtime — its only job
 * is to capture each contribution's literal type so `typeof PREFS` still
 * drives `DrawPrefPath` after composition.
 */
function composeToolPrefs<T extends Record<string, PrefGroup>>(t: T): T {
  return t;
}

// Declared apart: inline, the schema's open `kind: string` leaf widens the literal
// `kind` (dropping the path from `DrawPrefPath`) and rejects `source`.
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
  default: 'select' as string,
} as const satisfies WeaselDrawPrefRegistryEnum;

// ──────────────────────────────────────────────────────────────────────────
// Registry — single source of truth for available prefs + their defaults.
// `satisfies PrefGroup` keeps the inferred shape narrow (literal `kind`
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
} satisfies PrefGroup;

// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

/** Every pref is one localStorage record under this prefix. */
export const PREFS_PREFIX = 'weaseldraw.prefs.';

/** Where prefs lived before the store: one JSON blob of the whole tree. */
export const LEGACY_PREFS_KEY = 'weaseldraw.prefs.v2';

export type DrawPrefPath = PrefPath<typeof PREFS>;
export type DrawPrefValue<P extends DrawPrefPath> = PrefValueAt<typeof PREFS, P>;

/** The app's prefs over `storage`. Tests pass a memory adapter. */
export function openDrawPrefs(storage: SyncStorageAdapter): PrefsStore<typeof PREFS> {
  return openPrefsSync(PREFS, { storage, prefix: PREFS_PREFIX });
}

let store: PrefsStore<typeof PREFS> | null = null;

/** The app's prefs, opened on first use so a test's storage shim is in place
 *  before anything reads `localStorage`. */
export function drawPrefs(): PrefsStore<typeof PREFS> {
  return (store ??= openDrawPrefs(localStorageAdapter));
}

/** Fold the pre-store blob into the store once, then delete it. A leaf the
 *  store already holds wins. */
export function importLegacyPrefs(
  target: PrefsStore<typeof PREFS>,
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  let raw: string | null;
  try {
    raw = storage.getItem(LEGACY_PREFS_KEY);
  } catch {
    return;
  }
  if (raw === null) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    for (const [path, value] of flattenPrefValues(PREFS, parsed)) {
      if (!target.isSet(path as DrawPrefPath)) target.set(path as DrawPrefPath, value as never);
    }
  } catch {
    /* unparseable: nothing to keep */
  }
  storage.removeItem(LEGACY_PREFS_KEY);
}

/** One leaf of the app's prefs, as React state. */
export function usePref<P extends DrawPrefPath>(path: P) {
  return usePrefOf(drawPrefs(), path);
}

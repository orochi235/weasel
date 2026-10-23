// WeaselDraw's per-user preferences: the schema, and the store over
// localStorage that holds them, one record per leaf.

import { usePenTool } from '@weasel-js/core';
import {
  flattenPrefValues,
  openPrefsSync,
  type PrefBase,
  type PrefEnumControl,
  type PrefGroup,
  type PrefPath,
  type PrefsStore,
  type PrefValidator,
  type PrefValueAt,
} from '@weasel-js/prefs';
import { usePref as usePrefOf } from '@weasel-js/prefs/react';
import { localStorageAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
import type { ToolbarLayout } from '@weasel-js/ui/components/ToolbarDock';
import type { RegistryEnumFilter } from './registry/types';
import { panelsToSurfaces } from './surfaces/prefsMigration';
import type { SurfacesValue } from './surfaces/types';

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
 *  editor (`ui.surfaces`). Unlike the built-in `object`, it has no `children`. */
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
const SURFACES_PREF = {
  kind: 'data',
  name: 'Toolbars, panels, and menus',
  description: 'Where each one is shown, and whether its panel is hidden or collapsed.',
  block: true,
  default: {} as SurfacesValue,
} as const satisfies WeaselDrawPrefData;

const TOOLBARS_PREF = {
  kind: 'data',
  name: 'Toolbar layout',
  description: 'Which row each toolbar sits in, and in what order.',
  default: { docks: {}, floating: {} } as ToolbarLayout,
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
        surfaces: SURFACES_PREF,
        toolbars: TOOLBARS_PREF,
        showAnnotations: {
          kind: 'boolean',
          name: 'Show annotations in Layers',
          description: 'List the layers that are not printed — measurements, and anything else drawn as an aid — and their items in the Layers panel. The canvas draws them either way, and export leaves them out.',
          default: false,
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
          default: false,
        },
        gridDensity: {
          kind: 'number',
          name: 'Grid density',
          description: 'Spacing between grid lines, in document units (72 to the inch). Snap to grid uses the same spacing.',
          default: 20,
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
        pathDirection: {
          kind: 'boolean',
          name: 'Show path direction',
          description: 'While editing a path, draw an arrow on each segment the way the path runs, and a ring on its start.',
          default: false,
        },
        symmetry: {
          kind: 'boolean',
          name: 'Symmetry',
          description: 'Draw into a symmetry group, whose mirrored copies follow every edit to what is drawn in it, and the anchors you drag on a path that is already its own mirror image. Drag the handles on the axis to move or turn it. Turning it off stops drawing into the group; what is in it stays mirrored.',
          default: false,
        },
        symmetryAxis: {
          kind: 'enum',
          name: 'Symmetry axis',
          description: 'Which way the symmetry group mirrors: left and right, top and bottom, or into all four quarters.',
          default: 'vertical',
          options: [
            { value: 'vertical', label: 'Vertical (left and right)' },
            { value: 'horizontal', label: 'Horizontal (top and bottom)' },
            { value: 'both', label: 'Both' },
          ],
        },
        spacingHints: {
          kind: 'boolean',
          name: 'Spacing hints',
          description: 'While moving, snap to gaps that match the spacing between other shapes and mark them. Hold Alt (Option on a Mac) over a shape to measure its distance from the selection.',
          default: true,
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
          description: 'How a path fills where its outline crosses itself. A region the outline circles twice the same way is filled under nonzero (SVG default) and left empty under even-odd. Under both, a region circled once either way is filled, and one circled once each way is empty.',
          default: 'nonzero',
          options: [
            { value: 'nonzero', label: 'Nonzero (SVG default)' },
            { value: 'evenodd', label: 'Even-odd' },
          ],
        },
      },
    },
    modes: {
      name: 'Modes',
      description: 'Path edit, isolation, and the other modes you work inside.',
      children: {
        undo: {
          kind: 'enum',
          name: 'Undo inside a mode',
          description: "What Undo takes back while a mode such as path edit is open. The mode's own edits: Undo stops where the mode began, and leaving the mode puts its edits in the document's history as one step. The document's history: every edit is its own step there, and Undo can go on past where the mode began.",
          default: 'mode',
          options: [
            { value: 'mode', label: "The mode's own edits" },
            { value: 'document', label: "The document's history" },
          ],
        },
      },
    },
    recording: {
      name: 'Input recording',
      description: 'The recorder behind Record and Play in the command bar.',
      children: {
        profile: {
          kind: 'enum',
          name: 'Pointer movement kept',
          description: 'Which pointer moves a recording keeps. Presses, releases, wheel, and keys are always kept.',
          default: 'gesture-only',
          options: [
            { value: 'gesture-only', label: 'During a gesture' },
            { value: 'full', label: 'All of it' },
            { value: 'events-only', label: 'None' },
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

/** Every pref is one localStorage record under this prefix. Not a prefix of
 *  `LEGACY_PREFS_KEY`, so the old blob never loads as a record. */
export const PREFS_PREFIX = 'weaseldraw.prefs/';

/** Where prefs lived before the store: one JSON blob of the whole tree. */
export const LEGACY_PREFS_KEY = 'weaseldraw.prefs.v2';

export type DrawPrefPath = PrefPath<typeof PREFS>;
export type DrawPrefValue<P extends DrawPrefPath> = PrefValueAt<typeof PREFS, P>;

const shapeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

const VALIDATORS: Record<string, PrefValidator> = {
  'registry-enum': (v) => (typeof v === 'string' ? v : undefined),
  // The code that owns a `data` value reads it unchecked, so a stored value
  // must at least be the kind of thing its default is.
  data: (v, leaf) => (shapeOf(v) === shapeOf(leaf.default) ? v : undefined),
};

/** `MIGRATIONS[i]` takes stored records from version `i` to `i + 1`. */
const MIGRATIONS = [panelsToSurfaces];

/** The app's prefs over `storage`. Tests pass a memory adapter. */
export function openDrawPrefs(storage: SyncStorageAdapter): PrefsStore<typeof PREFS> {
  return openPrefsSync(PREFS, { storage, prefix: PREFS_PREFIX, validators: VALIDATORS, migrations: MIGRATIONS });
}

let store: PrefsStore<typeof PREFS> | null = null;

/** The app's prefs, opened on first use so a test's storage shim is in place
 *  before anything reads `localStorage`. */
export function drawPrefs(): PrefsStore<typeof PREFS> {
  return (store ??= openDrawPrefs(localStorageAdapter));
}

/** Fold the pre-store blob into the store once, and delete it once the new
 *  records are on disk. A leaf the store already holds wins. A store that
 *  cannot persist, or a blob of another version, leaves the blob alone; one
 *  still waiting on its first read imports when that read lands. */
export function importLegacyPrefs(
  target: PrefsStore<typeof PREFS>,
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  whenWritable(target, () => foldLegacyPrefs(target, storage));
}

/** Run `fold` once `target` can persist: now, or when a first read that
 *  failed lands. Never, for a store that stays read-only. */
export function whenWritable(target: PrefsStore<typeof PREFS>, fold: () => void): void {
  if (target.writable) return fold();
  void target.whenRead().then(() => {
    if (target.writable) fold();
  });
}

/** Run `remove`, which deletes a legacy copy, once everything `target` has
 *  queued is in storage. A write that does not land leaves the copy for the
 *  next open to import again. */
export function removeOnceStored(target: PrefsStore<typeof PREFS>, remove: () => void): void {
  void target.flush().then((landed) => {
    if (!landed) return;
    try {
      remove();
    } catch {
      /* storage gone: the next open imports it again, and every leaf is already set */
    }
  });
}

function foldLegacyPrefs(
  target: PrefsStore<typeof PREFS>,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
): void {
  let raw: string | null;
  try {
    raw = storage.getItem(LEGACY_PREFS_KEY);
  } catch {
    return;
  }
  if (raw === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (parsed !== undefined && (parsed as { version?: unknown } | null)?.version !== 2) return;
  const ui = (parsed as { ui?: { panels?: unknown; surfaces?: unknown } } | undefined)?.ui;
  if (ui && typeof ui === 'object' && ui.panels !== undefined) ui.surfaces ??= ui.panels;
  for (const [path, value] of flattenPrefValues(PREFS, parsed)) {
    if (!target.isSet(path as DrawPrefPath)) target.set(path as DrawPrefPath, value as never);
  }
  removeOnceStored(target, () => storage.removeItem(LEGACY_PREFS_KEY));
}

/** One leaf of the app's prefs, as React state. */
export function usePref<P extends DrawPrefPath>(path: P) {
  return usePrefOf(drawPrefs(), path);
}

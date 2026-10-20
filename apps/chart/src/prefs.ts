// WeaselChart's per-user preferences: the schema, and the store over
// localStorage that holds them, one record per leaf.

import { openPrefsSync, type PrefGroup, type PrefPath, type PrefsStore, type PrefValueAt } from '@weasel-js/prefs';
import { usePref as usePrefOf } from '@weasel-js/prefs/react';
import { localStorageAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
import type { EditorLook } from '@weasel-js/diagram/effect';

const LOOK_OPTIONS = [
  { value: 'nodeGraph', label: 'Node graph' },
  { value: 'rack', label: 'Rack' },
  { value: 'lanes', label: 'Lanes' },
] as const satisfies readonly { value: EditorLook; label: string }[];

// Fails to typecheck when `EditorLook` gains a look the options leave out.
const everyLookOffered: [Exclude<EditorLook, (typeof LOOK_OPTIONS)[number]['value']>] extends [never] ? true : false = true;
void everyLookOffered;

export const CHART_PREFS = {
  name: 'WeaselChart preferences',
  description: 'Settings kept across sessions.',
  children: {
    view: {
      name: 'View',
      description: 'The grid and snapping in chart mode.',
      children: {
        gridVisible: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Draw a grid on the page.',
          default: false,
        },
        gridSpacing: {
          kind: 'number',
          name: 'Grid spacing',
          description: 'Distance between grid lines, in chart units (96 to the inch). Snap to grid uses the same spacing.',
          default: 12,
          min: 4,
          max: 96,
          step: 4,
          control: 'slider',
        },
        snapToGrid: {
          kind: 'boolean',
          name: 'Snap to grid',
          description: 'Snap to the grid when moving, resizing or inserting shapes, dropping stencils, and dragging connector route handles.',
          default: false,
        },
        alignmentSnap: {
          kind: 'boolean',
          name: 'Snap to other shapes',
          description: 'While moving, snap to the edges and centers of other shapes.',
          default: true,
        },
        spacingSnap: {
          kind: 'boolean',
          name: 'Snap to equal gaps',
          description: 'While moving, snap to gaps that match the spacing between other shapes. Hold Alt (Option on a Mac) over a shape to measure its distance from the selection.',
          default: true,
        },
      },
    },
    pipeline: {
      name: 'Pipeline',
      description: 'Pipeline mode.',
      children: {
        look: {
          kind: 'enum',
          name: 'Look',
          description: 'How the pipeline editor draws stages and wires.',
          default: 'nodeGraph',
          options: LOOK_OPTIONS,
        },
      },
    },
  },
} satisfies PrefGroup;

/** Every pref is one localStorage record under this prefix. */
export const CHART_PREFS_PREFIX = 'weaselchart.prefs/';

export type ChartPrefPath = PrefPath<typeof CHART_PREFS>;
export type ChartPrefValue<P extends ChartPrefPath> = PrefValueAt<typeof CHART_PREFS, P>;

/** The app's prefs over `storage`. Tests pass a memory adapter. */
export function openChartPrefs(storage: SyncStorageAdapter): PrefsStore<typeof CHART_PREFS> {
  return openPrefsSync(CHART_PREFS, { storage, prefix: CHART_PREFS_PREFIX });
}

let store: PrefsStore<typeof CHART_PREFS> | null = null;

/** The app's prefs, opened on first use so a test's storage shim is in place
 *  before anything reads `localStorage`. */
export function chartPrefs(): PrefsStore<typeof CHART_PREFS> {
  return (store ??= openChartPrefs(localStorageAdapter));
}

/** One leaf of the app's prefs, as React state. */
export function useChartPref<P extends ChartPrefPath>(path: P) {
  return usePrefOf(chartPrefs(), path);
}

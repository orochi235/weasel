import { DEFAULT_CONSTRAINTS, type Anchor, type Constraints } from '@weasel-js/theme/engine';
import { readStored, writeSession } from '@weasel-js/editor';
import { readLocal, writeLocal } from '@weasel-js/storage';
import { type LabHistoryStore, localHistoryStore } from './historyStorage';
import { isFiniteNumber } from '@weasel-js/registry';

export type SurfaceKey = 'dark' | 'light';

/** Everything a preset restores, and everything one undo step covers. */
export interface LabState {
  readonly c: Constraints;
  readonly surfaceKey: SurfaceKey;
  readonly anchors: readonly Anchor[];
}

export interface Preset {
  readonly name: string;
  readonly state: LabState;
  /** Built-ins ship with the app and cannot be deleted. */
  readonly builtin?: boolean;
}

export const INITIAL: LabState = { c: DEFAULT_CONSTRAINTS, surfaceKey: 'dark', anchors: [] };

export const BUILTIN_PRESETS: readonly Preset[] = [
  { name: 'Default', state: INITIAL, builtin: true },
  {
    name: 'Vivid, dark only',
    state: {
      ...INITIAL,
      c: { ...DEFAULT_CONSTRAINTS, chromaFraction: 1, lightnessPull: 0.25, minContrast: 4 },
    },
    builtin: true,
  },
  {
    name: 'Readable on both surfaces',
    state: {
      ...INITIAL,
      // Lower lightness and a distance floor against paper is what a set needs
      // to survive being drawn on white as well as on ink.
      c: {
        ...DEFAULT_CONSTRAINTS,
        lightnessTarget: 0.62,
        lightnessPull: 0.85,
        minContrast: 3,
        minSurfaceDistance: 0.3,
      },
      surfaceKey: 'light',
    },
    builtin: true,
  },
  {
    name: 'Eight, well separated',
    state: {
      ...INITIAL,
      c: { ...DEFAULT_CONSTRAINTS, count: 8, hueFloor: 1, minDistance: 0.3 },
    },
    builtin: true,
  },
];

const KEY = 'weasel.theme-editor.presets';
const LIVE_KEY = 'weasel.theme-editor.live';

/** The live state a stored one, as `JSON.parse` reads it, holds. Throws on a value that is not one. */
export function liveOf(stored: unknown): LabState {
  if (typeof stored !== 'object' || stored === null) throw new Error('not a palette lab state');
  return stateOf(stored);
}

/** Each stored constraint whose kind matches its default's, the default for the rest. `NaN` is stored as `null`. */
function constraintsOf(stored: unknown): Constraints {
  const from = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>;
  const out: Record<keyof Constraints, unknown> = { ...INITIAL.c };
  for (const key of Object.keys(INITIAL.c) as (keyof Constraints)[]) {
    if (!Object.hasOwn(from, key)) continue;
    const fallback = INITIAL.c[key];
    const value = from[key];
    const fits = Array.isArray(fallback)
      ? Array.isArray(value)
      : typeof value === typeof fallback && (typeof value !== 'number' || isFiniteNumber(value));
    if (fits) out[key] = value;
  }
  return out as unknown as Constraints;
}

/** Each stored anchor with a name, a finite hue and lightness, and a chroma that is finite or absent. */
function anchorsOf(stored: unknown): Anchor[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((a: unknown): Anchor[] => {
    if (typeof a !== 'object' || a === null) return [];
    const { name, hue, lightness, chroma } = a as Record<string, unknown>;
    if (typeof name !== 'string' || !isFiniteNumber(hue) || !isFiniteNumber(lightness)) return [];
    if (chroma === undefined) return [{ name, hue, lightness }];
    return isFiniteNumber(chroma) ? [{ name, hue, lightness, chroma }] : [];
  });
}

/** A stored state with every field filled from the current defaults rather than trusted: one stored before a
 *  constraint existed would leave that field undefined, and the generator would read NaN out of it. */
function stateOf(stored: unknown): LabState {
  const state = (typeof stored === 'object' && stored !== null ? stored : {}) as Partial<LabState>;
  return {
    c: constraintsOf(state.c),
    surfaceKey: state.surfaceKey === 'light' ? 'light' : 'dark',
    anchors: anchorsOf(state.anchors),
  };
}

/**
 * The state last on screen, restored on load, or null for none. One that cannot be read is kept aside
 * (`readStored`), since the next edit saves over it.
 *
 * Separate from presets on purpose: a preset is something you named, this is
 * whatever you were in the middle of. Without it every dev-server reload — and
 * every HMR bounce while someone edits the app — silently discards an
 * exploration that took real work to reach.
 */
export const loadLive = (): LabState | null => readStored<LabState | null>(LIVE_KEY, liveOf, () => null);

// Not starting with LIVE_KEY: reading or writing the live state lists and parses every key that does.
const LIVE_HISTORY_KEY = 'weasel.theme-editor.palette-history';
const liveHistoryStore = localHistoryStore<LabState>(LIVE_HISTORY_KEY);

/** Where the palette lab keeps its undo history, beside the state it ends on. */
export const liveHistory: LabHistoryStore<LabState> = {
  ...liveHistoryStore,
  load: () => {
    // A history kept under LIVE_KEY before moves out from under it.
    const moved = readLocal(`${LIVE_KEY}.history`);
    if (moved !== undefined) {
      writeLocal(`${LIVE_KEY}.history`, undefined);
      if (readLocal(LIVE_HISTORY_KEY) === undefined) writeLocal(LIVE_HISTORY_KEY, moved);
    }
    return liveHistoryStore.load();
  },
};

/** Store the lab's state; resolves whether the browser took it, which a private window or a full quota refuses, as it
 *  refuses to write over a state `loadLive` could not read until that one is kept aside. */
export const persistLive = (state: LabState): Promise<boolean> => writeSession([LIVE_KEY, state]);

/** The presets a stored list, as `JSON.parse` reads it, holds, dropping entries that are not presets. Throws on a
 *  value that is not a list. */
export function savedOf(stored: unknown): Preset[] {
  if (!Array.isArray(stored)) throw new Error('not a list of palette presets');
  return stored
    .filter((p): p is Preset => typeof p === 'object' && p !== null && typeof (p as Preset).name === 'string')
    .map((p) => ({ name: p.name, state: stateOf(p.state) }));
}

/** The saved presets, or none. A list that cannot be read is kept aside, as {@link loadLive} keeps a state. */
export const loadSaved = (): Preset[] => readStored(KEY, savedOf, () => []);

/** What gets stored of a set of presets — built-ins are the app's, not yours. */
export const storedPresets = (presets: readonly Preset[]): Preset[] => presets.filter((p) => !p.builtin);

/** Store `presets`; resolves whether the browser took them, under the same refusals as {@link persistLive}. */
export const persist = (presets: readonly Preset[]): Promise<boolean> => writeSession([KEY, storedPresets(presets)]);

/** A preset as the TS literal that would make it a built-in. */
export function toSource(preset: Preset): string {
  return `{\n  name: ${JSON.stringify(preset.name)},\n  state: ${JSON.stringify(preset.state, null, 2)
    .split('\n')
    .join('\n  ')},\n},`;
}

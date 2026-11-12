import { DEFAULT_CONSTRAINTS, type Anchor, type Constraints } from '@weasel-js/theme/engine';
import { type LabHistoryStore, localHistoryStore } from './historyStorage';

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

/**
 * The state currently on screen, restored on load.
 *
 * Separate from presets on purpose: a preset is something you named, this is
 * whatever you were in the middle of. Without it every dev-server reload — and
 * every HMR bounce while someone edits the app — silently discards an
 * exploration that took real work to reach.
 */
export function parseLive(raw: string | null): LabState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  return stateOf(parsed);
}

/** Each stored constraint whose kind matches its default's, the default for the rest. `NaN` is stored as `null`. */
function constraintsOf(stored: unknown): Constraints {
  const from = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...INITIAL.c };
  for (const [key, fallback] of Object.entries(INITIAL.c)) {
    if (!Object.hasOwn(from, key)) continue;
    const value = from[key];
    const fits = Array.isArray(fallback)
      ? Array.isArray(value)
      : typeof value === typeof fallback && (typeof value !== 'number' || finite(value));
    if (fits) out[key] = value;
  }
  return out as unknown as Constraints;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Each stored anchor with a name, a finite hue and lightness, and a chroma that is finite or absent. */
function anchorsOf(stored: unknown): Anchor[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((a: unknown): Anchor[] => {
    if (typeof a !== 'object' || a === null) return [];
    const { name, hue, lightness, chroma } = a as Record<string, unknown>;
    if (typeof name !== 'string' || !finite(hue) || !finite(lightness)) return [];
    if (chroma === undefined) return [{ name, hue, lightness }];
    return finite(chroma) ? [{ name, hue, lightness, chroma }] : [];
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

export function loadLive(): LabState | null {
  try {
    return parseLive(localStorage.getItem(LIVE_KEY));
  } catch {
    // No storage at all — a private window, or a runtime without it.
    return null;
  }
}

/** Where the palette lab keeps its undo history, beside the state it ends on. */
export const liveHistory: LabHistoryStore<LabState> = localHistoryStore(`${LIVE_KEY}.history`);

/** Store the lab's state; answers whether the browser took it, which a private window or a full quota refuses. */
export function persistLive(state: LabState): boolean {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Saved presets survive the tab; a snapshot that does not is not one. */
export function parseSaved(raw: string | null): Preset[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p): p is Preset => typeof p === 'object' && p !== null && typeof (p as Preset).name === 'string')
    .map((p) => ({ name: p.name, state: stateOf(p.state) }));
}

export function loadSaved(): Preset[] {
  try {
    return parseSaved(localStorage.getItem(KEY));
  } catch {
    // A corrupt or unavailable store should cost the presets, not the app.
    return [];
  }
}

/** What gets written for a set of presets — built-ins are the app's, not yours. */
export function serializeSaved(presets: readonly Preset[]): string {
  return JSON.stringify(presets.filter((p) => !p.builtin));
}

/** Store `presets`; answers whether the browser took them, which a private window or a full quota refuses. */
export function persist(presets: readonly Preset[]): boolean {
  try {
    localStorage.setItem(KEY, serializeSaved(presets));
    return true;
  } catch {
    return false;
  }
}

/** A preset as the TS literal that would make it a built-in. */
export function toSource(preset: Preset): string {
  return `{\n  name: ${JSON.stringify(preset.name)},\n  state: ${JSON.stringify(preset.state, null, 2)
    .split('\n')
    .join('\n  ')},\n},`;
}

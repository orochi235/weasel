import { DEFAULT_CONSTRAINTS, type Anchor, type Constraints } from './palette/generate';

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
  const state = parsed as Partial<LabState>;
  // A state stored before a constraint existed would leave that field
  // undefined and the generator would read NaN out of it, so every field is
  // filled from the current defaults rather than trusted.
  return {
    c: { ...INITIAL.c, ...state.c },
    surfaceKey: state.surfaceKey === 'light' ? 'light' : 'dark',
    anchors: Array.isArray(state.anchors) ? state.anchors : [],
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

export function persistLive(state: LabState): void {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(state));
  } catch {
    // Private windows and full quotas both land here.
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
  return parsed.filter(
    (p): p is Preset =>
      typeof p === 'object' && p !== null && typeof (p as Preset).name === 'string',
  );
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

export function persist(presets: readonly Preset[]): void {
  try {
    localStorage.setItem(KEY, serializeSaved(presets));
  } catch {
    // Private windows and full quotas both land here; nothing else to do.
  }
}

/** A preset as the TS literal that would make it a built-in. */
export function toSource(preset: Preset): string {
  return `{\n  name: ${JSON.stringify(preset.name)},\n  state: ${JSON.stringify(preset.state, null, 2)
    .split('\n')
    .join('\n  ')},\n},`;
}

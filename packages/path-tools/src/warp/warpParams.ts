/**
 * The warp settings as form fields, defined once: `configureWarp`'s settings
 * form lays them out by kind, and the last-operation panel shows the ones a
 * warp drag or a `configureWarp` run used.
 */
import { pref, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import type { HeldPathWarp } from './pathWarp';
import { DEFAULT_ENVELOPE_SIZE, DEFAULT_WARP_TOLERANCE, WARP_LABELS, type WarpKind, type WarpSettings } from './warpTargets';

const count = (name: string, description: string) =>
  pref.number(name, DEFAULT_ENVELOPE_SIZE, { description, min: 1, max: 16, step: 1, control: 'input' });

/** One field per {@link WarpSettings} key. */
export const WARP_SETTING_FIELDS = {
  mode: pref.enum('Mode', 'free', [{ value: 'free', label: 'Free' }, { value: 'perspective', label: 'Perspective' }], {
    description: 'Free bends the box bilinearly; Perspective keeps every line straight.', control: 'toggle',
  }),
  rows: count('Rows', 'Patches down the mesh.'),
  cols: count('Columns', 'Patches across the mesh.'),
  mapping: pref.enum('Mapping', 'bicubic', [{ value: 'bicubic', label: 'Bicubic' }, { value: 'coons', label: 'Coons' }], {
    description: 'How the mesh interpolates between its points.', control: 'toggle',
  }),
  tolerance: pref.number('Tolerance', DEFAULT_WARP_TOLERANCE, {
    description: 'How far, in world units, the refitted paths may stray from the exact warp.',
    min: 0.05, max: 5, step: 0.05, control: 'slider',
  }),
} satisfies Record<keyof WarpSettings, PrefLeaf>;

type Field = keyof typeof WARP_SETTING_FIELDS;

/** The settings each kind of warp holds. */
const KIND_FIELDS: Record<WarpKind, readonly Field[]> = {
  distort: ['mode', 'tolerance'],
  envelope: ['rows', 'cols', 'mapping', 'tolerance'],
  puppet: ['tolerance'],
};

function groupOf(name: string, fields: readonly Field[]): PrefGroup {
  return { name, children: Object.fromEntries(fields.map((f) => [f, WARP_SETTING_FIELDS[f]])) };
}

/** A `<kind>.drag`'s form for the last-operation panel: every setting a warp of `kind` holds. */
export function warpDragParams(kind: WarpKind): PrefGroup {
  return groupOf(WARP_LABELS[kind], KIND_FIELDS[kind]);
}

/** A `configureWarp` run's form: the settings it changed, and nothing it left alone. */
export function configureWarpParams(params: Readonly<Record<string, unknown>>): PrefGroup | null {
  const fields = (Object.keys(WARP_SETTING_FIELDS) as Field[]).filter((f) => params[f] !== undefined);
  return fields.length > 0 ? groupOf('Warp Settings', fields) : null;
}

/** The settings `held` was made with, as its kind holds them. */
export function settingsOfWarp(held: HeldPathWarp): WarpSettings {
  const { warp, tolerance } = held;
  if (warp.kind === 'distort') return { mode: warp.mode, tolerance };
  if (warp.kind === 'envelope') return { rows: warp.mesh.rows, cols: warp.mesh.cols, mapping: warp.mapping, tolerance };
  return { tolerance };
}

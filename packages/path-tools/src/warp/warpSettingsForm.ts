/**
 * `configureWarp`'s settings form: the selection's warps by kind, the values
 * they hold, and the params a change to one of them makes.
 */
import type { ActionDeps, ActionSettings, ActionSettingsState } from '@weasel-js/routing';
import type { PrefGroup } from '@weasel-js/prefs';
import { selectedWarpLeaves } from './warpSelection';
import { resolvePathWarp } from './pathWarp';
import { SettingsFields } from '../settingsFields';

/** The warp settings as a prefs schema: a section per kind the selection
 *  holds, and the tolerance every kind refits at. */
export const WARP_SETTINGS_SCHEMA: PrefGroup = {
  name: 'Warp Settings',
  children: {
    distorts: { kind: 'number', name: 'Selected distorts', description: '', default: 0, hidden: true },
    envelopes: { kind: 'number', name: 'Selected envelopes', description: '', default: 0, hidden: true },
    distort: {
      name: 'Distort',
      as: 'section',
      showIf: { path: 'distorts', above: 0 },
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: 'Free bends the box bilinearly; Perspective keeps every line straight.',
          default: 'free', control: 'toggle',
          options: [{ value: 'free', label: 'Free' }, { value: 'perspective', label: 'Perspective' }],
        },
      },
    },
    envelope: {
      name: 'Envelope',
      as: 'section',
      showIf: { path: 'envelopes', above: 0 },
      children: {
        rows: { kind: 'number', name: 'Rows', description: 'Patches down the mesh.', default: 3, min: 1, max: 16, step: 1, control: 'input' },
        cols: { kind: 'number', name: 'Columns', description: 'Patches across the mesh.', default: 3, min: 1, max: 16, step: 1, control: 'input' },
        mapping: {
          kind: 'enum', name: 'Mapping', description: 'How the mesh interpolates between its points.',
          default: 'bicubic', control: 'toggle',
          options: [{ value: 'bicubic', label: 'Bicubic' }, { value: 'coons', label: 'Coons' }],
        },
      },
    },
    tolerance: {
      kind: 'number', name: 'Tolerance', description: 'How far, in world units, the refitted paths may stray from the exact warp.',
      default: 0.5, min: 0.05, max: 5, step: 0.05, control: 'slider',
    },
  },
};

/** What the form shows for the selected paths' warps. */
export function readWarpSettings(deps: ActionDeps): ActionSettingsState {
  const fields = new SettingsFields();
  let distorts = 0;
  let envelopes = 0;
  for (const { node } of selectedWarpLeaves(deps).paths) {
    const resolved = resolvePathWarp(node);
    if (!resolved) continue;
    const { warp, tolerance } = resolved.held;
    if (warp.kind === 'distort') {
      distorts++;
      fields.add('distort.mode', warp.mode);
    } else if (warp.kind === 'envelope') {
      envelopes++;
      fields.add('envelope.rows', warp.mesh.rows);
      fields.add('envelope.cols', warp.mesh.cols);
      fields.add('envelope.mapping', warp.mapping);
    }
    fields.add('tolerance', tolerance);
  }
  return fields.state({ distorts, envelopes });
}

/** A field's change as `configureWarp` params: a kind's own field reaches
 *  only warps of that kind. */
export function warpSettingsParams(path: string, value: unknown): Record<string, unknown> | null {
  const [section, field] = path.split('.');
  if (field === undefined) return section === 'tolerance' ? { tolerance: value } : null;
  return section === 'distort' || section === 'envelope' ? { kind: section, [field]: value } : null;
}

/** `configureWarp`'s form. */
export const warpSettingsForm: ActionSettings = {
  schema: WARP_SETTINGS_SCHEMA,
  read: readWarpSettings,
  params: warpSettingsParams,
};

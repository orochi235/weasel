/**
 * `configureWarp`'s settings form: the selection's warps by kind, the values
 * they hold, and the params a change to one of them makes.
 */
import type { ActionDeps, ActionSettings, ActionSettingsState } from '@weasel-js/routing';
import type { PrefGroup } from '@weasel-js/prefs';
import { selectedWarpPaths } from './warpSelection';
import { resolvePathWarp } from './pathWarp';
import { SettingsFields } from '../settingsFields';
import { WARP_SETTING_FIELDS } from './warpParams';

/** The warp settings as a prefs schema: a section per kind the selection
 *  holds, and the tolerance every kind refits at. */
export const WARP_SETTINGS_SCHEMA: PrefGroup = {
  name: 'Warp Settings',
  children: {
    planes: { kind: 'number', name: 'Selected plane warps', description: '', default: 0, hidden: true },
    cloths: { kind: 'number', name: 'Selected cloth warps', description: '', default: 0, hidden: true },
    plane: {
      name: 'Plane Warp',
      as: 'section',
      showIf: { path: 'planes', above: 0 },
      children: { mode: WARP_SETTING_FIELDS.mode },
    },
    cloth: {
      name: 'Cloth Warp',
      as: 'section',
      showIf: { path: 'cloths', above: 0 },
      children: { rows: WARP_SETTING_FIELDS.rows, cols: WARP_SETTING_FIELDS.cols, mapping: WARP_SETTING_FIELDS.mapping },
    },
    tolerance: WARP_SETTING_FIELDS.tolerance,
  },
};

/** What the form shows for the selected paths' warps. */
export function readWarpSettings(deps: ActionDeps): ActionSettingsState {
  const fields = new SettingsFields();
  let planes = 0;
  let cloths = 0;
  for (const { shown } of selectedWarpPaths(deps)) {
    const resolved = resolvePathWarp(shown);
    if (!resolved) continue;
    const { warp, tolerance } = resolved.held;
    if (warp.kind === 'plane') {
      planes++;
      fields.add('plane.mode', warp.mode);
    } else if (warp.kind === 'cloth') {
      cloths++;
      fields.add('cloth.rows', warp.mesh.rows);
      fields.add('cloth.cols', warp.mesh.cols);
      fields.add('cloth.mapping', warp.mapping);
    }
    fields.add('tolerance', tolerance);
  }
  return fields.state({ planes, cloths });
}

/** A field's change as `configureWarp` params: a kind's own field reaches
 *  only warps of that kind. */
export function warpSettingsParams(path: string, value: unknown): Record<string, unknown> | null {
  const [section, field] = path.split('.');
  if (field === undefined) return section === 'tolerance' ? { tolerance: value } : null;
  return section === 'plane' || section === 'cloth' ? { kind: section, [field]: value } : null;
}

/** `configureWarp`'s form. */
export const warpSettingsForm: ActionSettings = {
  schema: WARP_SETTINGS_SCHEMA,
  read: readWarpSettings,
  params: warpSettingsParams,
};

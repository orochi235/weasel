import type { PrefsMigration } from '@weasel-js/prefs';
import { isPlainObject } from '@weasel-js/registry';

/** Version 0 to 1: the right sidebar's `ui.panels` map became `ui.surfaces`, whose entries also say which surface
 *  each asset is drawn on. An old entry's hidden and collapsed flags carry over as they are. */
export const panelsToSurfaces: PrefsMigration = (records) => {
  if (!records.has('ui.panels')) return;
  if (!records.has('ui.surfaces')) records.set('ui.surfaces', records.get('ui.panels'));
  records.delete('ui.panels');
};

/** Version 1 to 2: the path tools' palette folded into the tools palette, so the hidden flag it kept in
 *  `ui.surfaces.pathTools` is dropped. */
export const dropPathToolsChrome: PrefsMigration = (records) => {
  const surfaces = records.get('ui.surfaces');
  if (!surfaces || typeof surfaces !== 'object' || !('pathTools' in surfaces)) return;
  const { pathTools: _dropped, ...rest } = surfaces as Record<string, unknown>;
  records.set('ui.surfaces', rest);
};

const PATH_AIDS = ['pathDirection', 'pathComb', 'pathBalance', 'pathCorners'];

/** Version 2 to 3: the path editing aids moved into the view's Path editing group, and the left sidebar width, which
 *  nothing read, was dropped. */
export const pathAidsToGroup: PrefsMigration = (records) => {
  for (const key of PATH_AIDS) {
    const from = `view.${key}`;
    if (!records.has(from)) continue;
    const to = `view.pathEditing.${key}`;
    if (!records.has(to)) records.set(to, records.get(from));
    records.delete(from);
  }
  records.delete('ui.leftSidebarWidth');
};

/** Version 3 to 4: the path fill rule became the shape tools' shared `fillRule` option, and the drawing group
 *  that held it went away. */
export const fillRuleToToolOptions: PrefsMigration = (records) => {
  const from = 'drawing.pathFillRule';
  if (!records.has(from)) return;
  const to = 'tools.shared.fillRule';
  if (!records.has(to)) records.set(to, records.get(from));
  records.delete(from);
};

const RENAMED_AIDS: readonly (readonly [string, string])[] = [
  ['pathBalance', 'pathPoise'],
  ['pathCorners', 'pathFillets'],
];

/** Version 4 to 5: Balance handles became Poise and Corner shape became Fillet, and their view toggles with them. */
export const renamePathAids: PrefsMigration = (records) => {
  for (const [old, now] of RENAMED_AIDS) {
    const from = `view.pathEditing.${old}`;
    if (!records.has(from)) continue;
    const to = `view.pathEditing.${now}`;
    if (!records.has(to)) records.set(to, records.get(from));
    records.delete(from);
  }
};

/** Path tool ids saved before the renames of 2026-11-14, by the id each goes by now. */
const RENAMED_TOOLS: Readonly<Record<string, string>> = {
  smudgeBrush: 'knead', simplifyBrush: 'sand', trim: 'snip', extend: 'reach', lengthen: 'tug',
  envelope: 'cloth', puppet: 'pin', distort: 'plane',
};

/** Version 5 to 6: the path tools renamed beside Poise and Fillet keep their options and the last-used tool, and
 *  Fillet's command-row asset keeps the surface and toolbar place Corner shape's had. */
export const renamePathTools: PrefsMigration = (records) => {
  for (const key of [...records.keys()]) {
    const [group, owner, ...rest] = key.split('.');
    if (group !== 'tools' || owner === undefined || rest.length === 0 || !Object.hasOwn(RENAMED_TOOLS, owner)) continue;
    const to = ['tools', RENAMED_TOOLS[owner], ...rest].join('.');
    if (!records.has(to)) records.set(to, records.get(key));
    records.delete(key);
  }
  const last = records.get('tools.lastTool');
  if (typeof last === 'string' && Object.hasOwn(RENAMED_TOOLS, last)) records.set('tools.lastTool', RENAMED_TOOLS[last]);
  const surfaces = records.get('ui.surfaces');
  if (isPlainObject(surfaces)) {
    const moved = renameEntry(surfaces, 'corners', 'fillets');
    if (moved !== surfaces) records.set('ui.surfaces', moved);
  }
  const toolbars = records.get('ui.toolbars');
  if (isPlainObject(toolbars) && isPlainObject(toolbars.docks) && isPlainObject(toolbars.floating)) {
    const docks = Object.fromEntries(Object.entries(toolbars.docks).map(([id, rows]) => [id, Array.isArray(rows)
      ? rows.map((row: unknown) => (Array.isArray(row) ? renameBar(row, 'corners', 'fillets') : row))
      : rows]));
    const atEnd = Array.isArray(toolbars.atEnd) ? { atEnd: renameBar(toolbars.atEnd, 'corners', 'fillets') } : {};
    records.set('ui.toolbars', { ...toolbars, docks, floating: renameEntry(toolbars.floating, 'corners', 'fillets'), ...atEnd });
  }
};

/** `bars` with `from` under `to`, or dropped where `to` is already there. */
function renameBar(bars: readonly unknown[], from: string, to: string): unknown[] {
  if (!bars.includes(from)) return [...bars];
  return bars.includes(to) ? bars.filter((bar) => bar !== from) : bars.map((bar) => (bar === from ? to : bar));
}

/** `map` with its own `from` entry under `to`, or `map` itself where it holds none to move. */
function renameEntry(map: Record<string, unknown>, from: string, to: string): Record<string, unknown> {
  if (!Object.hasOwn(map, from)) return map;
  const { [from]: moved, ...rest } = map;
  return Object.hasOwn(rest, to) ? rest : { ...rest, [to]: moved };
}

const GRID_LEAVES: readonly (readonly [string, string])[] = [
  ['view.gridVisible', 'view.grid.visible'],
  ['view.gridDensity', 'view.grid.spacing'],
  ['view.snapToGrid', 'view.grid.snap'],
];

const FEATURE_LEAVES: readonly (readonly [string, string])[] = [
  ['view.rulersVisible', 'view.rulers.visible'],
  ['view.symmetryAxis', 'view.symmetry.axis'],
  ['view.pathEditing.pathDirection', 'view.pathEditing.direction'],
  ['view.pathEditing.pathComb', 'view.pathEditing.comb'],
  ['view.pathEditing.pathPoise', 'view.pathEditing.poise'],
  ['view.pathEditing.pathFillets', 'view.pathEditing.fillets'],
];

/** Version 7 to 8: the rulers, symmetry and path edit aids took the settings groups their packages declare, so
 *  `view.symmetry` became a group whose switch is `on`. */
export const featureSettingsToGroups: PrefsMigration = (records) => {
  if (records.has('view.symmetry')) {
    if (!records.has('view.symmetry.on')) records.set('view.symmetry.on', records.get('view.symmetry'));
    records.delete('view.symmetry');
  }
  for (const [from, to] of FEATURE_LEAVES) {
    if (!records.has(from)) continue;
    if (!records.has(to)) records.set(to, records.get(from));
    records.delete(from);
  }
};

/** Version 6 to 7: the grid's leaves moved into the view's Grid group, which is `@weasel-js/editor`'s `pageGridSchema`. */
export const gridToGroup: PrefsMigration = (records) => {
  for (const [from, to] of GRID_LEAVES) {
    if (!records.has(from)) continue;
    if (!records.has(to)) records.set(to, records.get(from));
    records.delete(from);
  }
};

/** Version 8 to 9: Symmetry's switch became session state, so the `view.symmetry.on` it was stored at is dropped. */
export const dropSymmetrySwitch: PrefsMigration = (records) => {
  records.delete('view.symmetry.on');
};

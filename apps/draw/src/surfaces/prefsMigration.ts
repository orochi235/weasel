import type { PrefsMigration } from '@weasel-js/prefs';

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

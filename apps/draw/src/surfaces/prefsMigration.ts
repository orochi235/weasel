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

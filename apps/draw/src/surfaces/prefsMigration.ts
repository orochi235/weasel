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

const RENAMED_AIDS: readonly (readonly [string, string])[] = [
  ['pathBalance', 'pathPoise'],
  ['pathCorners', 'pathFillets'],
];

/** Tool ids the path tool renames changed, for `tools.lastTool`. */
const RENAMED_TOOLS: ReadonlyMap<string, string> = new Map([
  ['smudgeBrush', 'knead'],
  ['simplifyBrush', 'sand'],
  ['lengthen', 'tug'],
  ['extend', 'reach'],
  ['trim', 'snip'],
]);

/** The tools whose options draw keeps, under `tools.<id>.`. */
const RENAMED_OPTIONED_TOOLS = ['smudgeBrush', 'simplifyBrush'];

const OLD_FILLETS = 'corners';
const FILLETS = 'fillets';

function moveKey(records: Map<string, unknown>, from: string, to: string): void {
  if (!records.has(from)) return;
  if (!records.has(to)) records.set(to, records.get(from));
  records.delete(from);
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** `map` with its own `from` entry under `to`, or `map` itself where it holds none to move. */
function renameEntry(map: Record<string, unknown>, from: string, to: string): Record<string, unknown> {
  if (!Object.hasOwn(map, from)) return map;
  const { [from]: moved, ...rest } = map;
  return Object.hasOwn(rest, to) ? rest : { ...rest, [to]: moved };
}

/** Version 4 to 5: the path tools were renamed. Balance handles became Poise and Corner shape became Fillet, and
 *  their view toggles with them; the Corner shape asset's surface and toolbar place moved to Fillet's; and the
 *  options and last use of Smudge brush, Simplify brush, Lengthen, Extend to next path, and Trim segment moved to
 *  Knead, Sand, Tug, Reach, and Snip. */
export const renamePathTools: PrefsMigration = (records) => {
  for (const [old, now] of RENAMED_AIDS) moveKey(records, `view.pathEditing.${old}`, `view.pathEditing.${now}`);
  for (const old of RENAMED_OPTIONED_TOOLS) {
    const from = `tools.${old}.`;
    const to = `tools.${RENAMED_TOOLS.get(old)}.`;
    for (const key of [...records.keys()]) if (key.startsWith(from)) moveKey(records, key, to + key.slice(from.length));
  }
  const last = records.get('tools.lastTool');
  if (typeof last === 'string' && RENAMED_TOOLS.has(last)) records.set('tools.lastTool', RENAMED_TOOLS.get(last));
  const surfaces = records.get('ui.surfaces');
  if (isRecord(surfaces)) {
    const moved = renameEntry(surfaces, OLD_FILLETS, FILLETS);
    if (moved !== surfaces) records.set('ui.surfaces', moved);
  }
  const toolbars = records.get('ui.toolbars');
  if (isRecord(toolbars) && isRecord(toolbars.docks) && isRecord(toolbars.floating)) {
    const docks = Object.fromEntries(Object.entries(toolbars.docks).map(([id, rows]) => [id, Array.isArray(rows)
      ? rows.map((row: unknown) => (Array.isArray(row) && row.includes(OLD_FILLETS) && !row.includes(FILLETS)
        ? row.map((bar: unknown) => (bar === OLD_FILLETS ? FILLETS : bar))
        : row))
      : rows]));
    records.set('ui.toolbars', { ...toolbars, docks, floating: renameEntry(toolbars.floating, OLD_FILLETS, FILLETS) });
  }
};

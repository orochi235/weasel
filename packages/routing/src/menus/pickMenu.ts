import type { MenuDef, MenuHit, MenuWhen, OwnedMenuDef } from './types';

const oneOf = <T>(want: T | readonly T[] | undefined, got: T | undefined) =>
  want === undefined || (Array.isArray(want) ? (want as readonly T[]).includes(got as T) : want === got);

function matches(when: MenuWhen, hit: MenuHit): boolean {
  return oneOf(when.bodyTarget, hit.bodyTarget) && oneOf(when.bodyKind, hit.bodyKind);
}

/** The menus live now: ambient defs, then the active tool's, with defs that
 *  share an id joined section by section. The first def of an id supplies
 *  its `when`. */
export function mergeMenuDefs(defs: readonly OwnedMenuDef[], activeTool: string | null): MenuDef[] {
  const live = [
    ...defs.filter((d) => d.owner === null),
    ...defs.filter((d) => d.owner !== null && d.owner === activeTool),
  ];
  const byId = new Map<string, MenuDef>();
  for (const { def } of live) {
    const prev = byId.get(def.id);
    if (!prev) {
      byId.set(def.id, { ...def, sections: def.sections.map((s) => [...s]) });
      continue;
    }
    def.sections.forEach((s, i) => {
      prev.sections[i] = [...(prev.sections[i] ?? []), ...s];
    });
    if (!prev.when && def.when) prev.when = def.when;
  }
  return [...byId.values()];
}

/** The first def whose `when` matches `hit`. */
export function pickMenu(defs: readonly MenuDef[], hit: MenuHit): MenuDef | undefined {
  return defs.find((d) => d.when !== undefined && matches(d.when, hit));
}

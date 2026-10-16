import type { MenuDef, MenuHit, MenuWhen, OwnedMenuDef } from './types';

const oneOf = <T>(want: T | readonly T[] | undefined, got: T | undefined) =>
  want === undefined || (Array.isArray(want) ? (want as readonly T[]).includes(got as T) : want === got);

function matches(when: MenuWhen, hit: MenuHit): boolean {
  return oneOf(when.bodyTarget, hit.bodyTarget) && oneOf(when.bodyKind, hit.bodyKind);
}

/** The menus live now: ambient defs, then the active tool's. Defs that share
 *  an id become one menu: each contribution's children in turn, with a
 *  separator between contributions. Children stay at their own keys, so the
 *  paths their values are read at do not move; a key a previous contribution
 *  took gets `~n` appended. The first def of an id supplies the schema's
 *  name and the def's `when`. */
export function mergeMenuDefs(defs: readonly OwnedMenuDef[], activeTool: string | null): MenuDef[] {
  const live = [
    ...defs.filter((d) => d.owner === null),
    ...defs.filter((d) => d.owner !== null && d.owner === activeTool),
  ];
  const byId = new Map<string, { def: MenuDef; parts: number }>();
  for (const { def } of live) {
    const prev = byId.get(def.id);
    if (!prev) {
      byId.set(def.id, { def: { ...def, menu: { ...def.menu, children: { ...def.menu.children } } }, parts: 1 });
      continue;
    }
    const n = prev.parts++;
    const children = prev.def.menu.children;
    children[`~sep${n}`] = { kind: 'separator', name: '', description: '', default: undefined };
    for (const [k, node] of Object.entries(def.menu.children)) {
      children[Object.hasOwn(children, k) ? `${k}~${n}` : k] = node;
    }
    if (!prev.def.when && def.when) prev.def.when = def.when;
  }
  return [...byId.values()].map((m) => m.def);
}

/** The first def whose `when` matches `hit`. */
export function pickMenu(defs: readonly MenuDef[], hit: MenuHit): MenuDef | undefined {
  return defs.find((d) => d.when !== undefined && matches(d.when, hit));
}

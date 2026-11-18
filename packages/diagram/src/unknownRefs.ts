/** Development warnings for the ids a diagram's data names but never declares. */
import { isDev } from '@weasel-js/registry';
import type { DiagramData } from './dataTypes';
import { firstSight } from './firstSight';

const unwarned = firstSight();

/** In dev, warns once per id that an edge end, a group member or a container or lane member names an id that
 *  is not in `ids`, the diagram's node, group, container and lane ids. */
export function warnUnknownRefs(data: DiagramData, ids: ReadonlySet<string>): void {
  if (!isDev()) return;
  const check = (id: string, where: string): void => {
    if (ids.has(id) || !unwarned(id)) return;
    console.warn(`@weasel-js/diagram: ${where} names "${id}", which is no node, group, or container; it is left out`);
  };
  for (const e of data.edges) {
    check(e.from, `an edge from "${e.from}" to "${e.to}"`);
    check(e.to, `an edge from "${e.from}" to "${e.to}"`);
  }
  for (const g of data.clusters ?? []) for (const m of g.members) check(m, `group "${g.id}"`);
  for (const c of data.containers ?? []) {
    if (c.role === 'container') for (const m of c.members ?? []) check(m, `container "${c.id}"`);
    else for (const l of c.lanes ?? []) for (const m of l.members ?? []) check(m, `lane "${l.id}"`);
  }
}

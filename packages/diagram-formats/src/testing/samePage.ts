/** Comparing pages a reader made, where only what is on the page counts and not the order it was listed in. */
import type { DiagramDocument, GraphPage } from '../document';

const byId = <T extends { id?: string }>(items: readonly T[] | undefined): T[] | undefined =>
  items === undefined ? undefined : [...items].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

/** `page` with its nodes, edges, containers, lanes, and members each sorted by id. */
export function sortedPage(page: GraphPage): GraphPage {
  const { data } = page;
  const containers = byId(data.containers)?.map((c) => ({
    ...c,
    ...(c.members !== undefined ? { members: [...c.members].sort() } : {}),
    ...(c.lanes !== undefined ? { lanes: byId(c.lanes)!.map((l) => ({ ...l, ...(l.members ? { members: [...l.members].sort() } : {}) })) } : {}),
  }));
  return {
    ...page,
    data: { ...data, nodes: byId(data.nodes)!, edges: byId(data.edges)!, ...(containers !== undefined ? { containers } : {}) },
  };
}

/** The one graph page a one-page reader made. */
export const onlyPage = (doc: DiagramDocument): GraphPage => {
  if (doc.pages.length !== 1 || doc.pages[0]!.kind !== 'graph') throw new Error('expected one graph page');
  return doc.pages[0]!;
};

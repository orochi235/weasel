/** Comparing pages a reader made, where only what is on the page counts and not the order it was listed in. */
import type { DiagramDocument, GraphPage } from '../document';

const byId = <T extends { id?: string }>(items: readonly T[] | undefined): T[] | undefined =>
  items === undefined ? undefined : [...items].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

/** `page` with its nodes, edges, containers, clusters, and every member list sorted by id. A pool's lanes keep their
 *  order, which is the order they are drawn in; only their members are sorted. */
export function sortedPage(page: GraphPage): GraphPage {
  const { data } = page;
  const containers = byId(data.containers)?.map((c) => ({
    ...c,
    ...(c.members !== undefined ? { members: [...c.members].sort() } : {}),
    ...(c.lanes !== undefined ? { lanes: c.lanes.map((l) => ({ ...l, ...(l.members ? { members: [...l.members].sort() } : {}) })) } : {}),
  }));
  const clusters = byId(data.clusters)?.map((c) => ({ ...c, members: [...c.members].sort() }));
  return {
    ...page,
    data: {
      ...data, nodes: byId(data.nodes)!, edges: byId(data.edges)!,
      ...(containers !== undefined ? { containers } : {}), ...(clusters !== undefined ? { clusters } : {}),
    },
  };
}

/** The one graph page a one-page reader made. */
export const onlyPage = (doc: DiagramDocument): GraphPage => {
  if (doc.pages.length !== 1 || doc.pages[0]!.kind !== 'graph') throw new Error('expected one graph page');
  return doc.pages[0]!;
};

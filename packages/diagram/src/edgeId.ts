import type { DataEdge } from './fromData';

/** A part of an edge id with its separators, and the `/` sub-specs append
 *  after one, escaped by a backslash. */
const idPart = (s: string) => s.replace(/[\\.>:/]/g, '\\$&');

/** The scene node id `diagramScene` gives an edge: its `id` when set, else one
 *  built from its ends, ports, and label. Two edges differing in any of those
 *  get different ids, an empty port or label included: a `.`, `>`, `:`, `/` or
 *  `\` in one of them is escaped with a backslash. */
export const edgeIdOf = (e: DataEdge) => {
  if (e.id !== undefined) return e.id;
  const part = (mark: string, p: string | undefined) => (p === undefined ? '' : `${mark}${idPart(p)}`);
  return `edge:${idPart(e.from)}${part('.', e.fromPort)}->${idPart(e.to)}${part('.', e.toPort)}${part(':', e.label)}`;
};

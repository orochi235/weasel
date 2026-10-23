import { diagramContainerOf } from './containers/trait';
import { diagramGroupOf } from './group';
import { dataKeyReader } from './trait';

type Like = { id?: string; kind?: string; data: unknown };

/** A built shape body: a participant that is neither a region nor a diagram group. */
export const isDiagramBody = (node: Like): boolean =>
  diagramContainerOf(node) === null && diagramGroupOf(node) === null
  && dataKeyReader({ id: node.id ?? '', kind: node.kind === 'group' ? 'group' : 'mark', data: node.data }) !== null;

/** A body or a region: what a diagram's own box is made of. */
export const isBodyOrRegion = (node: Like): boolean =>
  diagramContainerOf(node) !== null || isDiagramBody(node);

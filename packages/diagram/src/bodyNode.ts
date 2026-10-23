import { diagramContainerOf } from './containers/trait';
import { diagramGroupOf } from './group';
import { dataKeyReader, type DiagramNodeLike } from './trait';

type Like = { data: unknown };

/** A built shape body: a participant that is neither a region nor a diagram group. */
export const isDiagramBody = (node: Like): boolean =>
  diagramContainerOf(node) === null && diagramGroupOf(node) === null
  && dataKeyReader(node as DiagramNodeLike) !== null;

/** A body or a region: what a diagram's own box is made of. */
export const isBodyOrRegion = (node: Like): boolean =>
  diagramContainerOf(node) !== null || isDiagramBody(node);

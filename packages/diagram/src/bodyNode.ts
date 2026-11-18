import { diagramContainerOf } from './containers/trait';
import { diagramClusterOf } from './clusterBox';
import { dataKeyReader, type DiagramNodeLike } from './trait';

/** A built shape body: a participant that is neither a region nor a diagram cluster. */
export const isDiagramBody = (node: { data: unknown }): boolean =>
  diagramContainerOf(node) === null && diagramClusterOf(node) === null
  && dataKeyReader(node as DiagramNodeLike) !== null;

/** A body or a region: what a diagram's own box is made of. */
export const isBodyOrRegion = (node: { data: unknown }): boolean =>
  diagramContainerOf(node) !== null || isDiagramBody(node);

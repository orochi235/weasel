import { diagramContainerOf } from './containers/trait';
import { diagramEdgeOf } from './edgeTrait';
import { diagramGroupOf } from './group';
import { diagramLabelOf } from './labelTrait';

/**
 * `<SceneCanvas selectTool={{ resize: { resizable } }}>` for a diagram scene:
 * edges and edge labels take their geometry from what they are attached to,
 * so their own pose is a placeholder, and a resize handle on it sits at the
 * origin and resizes nothing. A group's box is its members' union, and a
 * pool's lane is sized by its pool's stack and resized by dragging its
 * boundary.
 */
export function diagramResizable(scene: { get(id: never): { data: unknown } | undefined }): (id: string) => boolean {
  return (id) => {
    const node = scene.get(id as never);
    return node === undefined
      || (diagramEdgeOf(node) === null && diagramLabelOf(node) === null && diagramGroupOf(node) === null
        && diagramContainerOf(node)?.role !== 'lane');
  };
}

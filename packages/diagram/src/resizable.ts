import { diagramEdgeOf } from './edgeTrait';
import { diagramLabelOf } from './labelTrait';

/**
 * `<SceneCanvas selectTool={{ resize: { resizable } }}>` for a diagram scene:
 * edges and edge labels take their geometry from what they are attached to,
 * so their own pose is a placeholder, and a resize handle on it sits at the
 * origin and resizes nothing.
 */
export function diagramResizable(scene: { get(id: never): { data: unknown } | undefined }): (id: string) => boolean {
  return (id) => {
    const node = scene.get(id as never);
    return node === undefined || (diagramEdgeOf(node) === null && diagramLabelOf(node) === null);
  };
}

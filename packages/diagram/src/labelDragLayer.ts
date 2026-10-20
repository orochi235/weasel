/**
 * What makes an edge label grabbable, so a drag can move it along and beside
 * its edge (`labelDragAction`).
 *
 * Built the way the route handles are: rect regions with a `null` `targetId`
 * and no paint, composed into a layer whose id is the kind a press reports.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  composeAffordanceLayer,
  documentDepOf,
  documentPose,
  type Affordance,
  type AffordanceRegion,
  type CursorSpec,
  type NodeId,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import type { Path, Vec2 } from '@weasel-js/core/math';
import { diagramLabelOf, type DiagramLabel } from './labelTrait';
import type { Bounds } from './outline';

/** The layer id the label regions are composed into. */
export const LABEL_DRAG_LAYER_ID = 'diagram-edge-labels';

/** The affordance kind a press on an edge label reports. */
export const LABEL_DRAG_AFFORDANCE_KIND = `layer:${LABEL_DRAG_LAYER_ID}` as const;

/** What a press on an edge label hands the label actions, as the hit's `payload`. */
export interface LabelScratch {
  targetId: string;
  labelId: string;
  edgeId: string;
}

/** Read a label press's scratch back off the hit an action was handed. */
export function labelScratchOf(hit: { payload?: unknown } | null | undefined): LabelScratch | null {
  const payload = hit?.payload as LabelScratch | undefined;
  return payload !== undefined && typeof payload.labelId === 'string' && typeof payload.edgeId === 'string'
    ? payload : null;
}

/** A label a press can pick up: its box as the document places it, and its edge's route. */
export interface DraggableLabel {
  labelId: string;
  edgeId: string;
  box: Bounds;
  path: Path;
}

/** Whether an edit may touch a label: neither it nor its edge is locked, and it is not hidden. */
export const labelEditable = (scene: Scene<unknown, string, unknown>, labelId: NodeId, edgeId: NodeId): boolean =>
  !scene.isLocked(labelId) && !scene.isLocked(edgeId) && !scene.isHidden(labelId);

/** A label an edit may touch, and the one edge it stands on. */
export interface EditableLabel {
  labelId: NodeId;
  edgeId: NodeId;
  label: DiagramLabel;
}

/** Every label in `scene` an edit may touch, in render order: one carrying the
 *  label trait, on exactly one edge, that `labelEditable` passes. With `edges`,
 *  only the labels on those edges. */
export function* editableLabels(
  scene: Scene<unknown, string, unknown>, edges?: ReadonlySet<string>,
): Iterable<EditableLabel> {
  for (const node of scene.renderOrderNodes()) {
    const label = diagramLabelOf(node);
    if (label === null) continue;
    const deps = node.dependsOn;
    if (!Array.isArray(deps) || deps.length !== 1) continue;
    const edgeId = deps[0] as NodeId;
    if (edges !== undefined && !edges.has(edgeId)) continue;
    if (labelEditable(scene, node.id, edgeId)) yield { labelId: node.id, edgeId, label };
  }
}

/** Every editable label in `scene` whose edge derives a path, in render order. */
export function* draggableLabels(scene: Scene<unknown, string, unknown>): Iterable<DraggableLabel> {
  for (const { labelId, edgeId } of editableLabels(scene)) {
    const path = documentDepOf(scene as never, edgeId)?.path ?? null;
    if (path === null) continue;
    const box = AUTO_POSE_DESCRIPTOR.getBounds(documentPose(scene as never, scene.get(labelId) as never));
    yield { labelId, edgeId, box, path };
  }
}

const holds = (b: Bounds, at: Vec2) => at.x >= b.x && at.x <= b.x + b.width && at.y >= b.y && at.y <= b.y + b.height;

/** The topmost draggable label whose box holds `at`, as its press scratch. */
export function labelUnder(scene: Scene<unknown, string, unknown>, at: Vec2): LabelScratch | null {
  let found: LabelScratch | null = null;
  for (const { labelId, edgeId, box } of draggableLabels(scene)) {
    if (holds(box, at)) found = { targetId: labelId, labelId, edgeId };
  }
  return found;
}

function createLabelDragAffordance(scene: Scene<unknown, string, unknown>, cursor: CursorSpec): Affordance {
  return {
    id: LABEL_DRAG_LAYER_ID,
    regions(): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const { labelId, edgeId, box } of draggableLabels(scene)) {
        out.push({
          id: labelId,
          targetId: null,
          shape: { kind: 'rect', x: box.x, y: box.y, width: box.width, height: box.height },
          cursor,
          strength: 'exclusive',
          claimedKinds: ['pointer'],
          bind: () => ({ initialScratch: { targetId: labelId, labelId, edgeId } satisfies LabelScratch }),
        });
      }
      return out;
    },
  };
}

/** The composed layer, for `CanvasExtensionApi.registerLayer`. Register it
 *  before the port layer: the last registered is hit first, and a port or a
 *  route handle must win over a label beside it. */
export function labelDragLayer(
  scene: Scene<unknown, string, unknown>,
  opts: { cursor?: CursorSpec } = {},
): RenderLayer<unknown> {
  return composeAffordanceLayer(
    LABEL_DRAG_LAYER_ID,
    'Diagram edge labels',
    [createLabelDragAffordance(scene, opts.cursor ?? 'move')],
  ) as unknown as RenderLayer<unknown>;
}

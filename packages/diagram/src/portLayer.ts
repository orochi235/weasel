/**
 * The port affordance, composed into a layer and pointed at a scene.
 */
import { scenePoseFrame,
  composeAffordanceLayer,
  nodeGates,
  type GatedLayer,
  type RenderLayer,
} from '@weasel-js/core';
import {
  PORT_LAYER_ID,
  createPortAffordance,
  type ParticipantPose,
  type ParticipantSource,
  type PortAffordanceOptions,
} from './portAffordance';
import type { GraphNodeLike } from './graph';

/** The minimum a participant source needs from a scene. Narrower than `Scene`
 *  so a consumer can pass anything that answers these. `layers` and each
 *  node's `layer`, `parent`, `hidden` and `locked` feed `nodeGates`; a stand-in
 *  without them gates nothing. */
export interface ParticipantScene<TPose> {
  readonly layers?: readonly GatedLayer[];
  renderOrderNodes(): readonly {
    id: string;
    kind: 'mark' | 'group';
    layer?: string;
    parent?: string | null;
    hidden?: boolean;
    locked?: boolean;
    data: unknown;
    pose: TPose;
    dependsOn?: readonly string[] | 'children';
  }[];
  readonly overrides: { read(id: string): { pose?: TPose } | undefined };
  get(id: string): unknown;
  childrenOf(id: string): readonly string[];
}

/**
 * Every node in `scene`, at the pose it is **painted** at, marked `hidden` or
 * `locked` where the scene's `nodeGates` says so, and carrying its `layer` so
 * a view that does not paint that layer can turn its ports away too. The
 * marks keep ports off such a node; the graph reads past them, so a hidden
 * node is still laid out.
 *
 * Its effective pose, in world: an override is what a gesture is currently
 * showing, and a port that answers from the document pose while its node is
 * mid-drag, or from its pose in its container's frame, sits somewhere the
 * user can see the node is not.
 *
 * One source answers both the ports and the graph.
 */
export function sceneParticipants<TPose>(
  scene: ParticipantScene<TPose>,
): () => Iterable<ParticipantPose<TPose> & { node: GraphNodeLike }> {
  return function* () {
    const gates = nodeGates(scene as never);
    const frame = scenePoseFrame(scene as never);
    for (const node of scene.renderOrderNodes()) {
      const hidden = gates.hidden(node.id);
      const locked = gates.locked(node.id);
      yield {
        node: node as GraphNodeLike,
        pose: frame.world(node.id as never) as TPose,
        ...(node.layer !== undefined ? { layer: node.layer } : {}),
        ...(hidden ? { hidden } : {}),
        ...(locked ? { locked } : {}),
      };
    }
  };
}

/**
 * The composed layer, ready for `CanvasExtensionApi.registerLayer` — the only
 * attach route that is hit-tested. Handing this to `SceneCanvas`'s `layers`
 * prop, or to a `Contribution.overlay`, paints the ports and makes none of them
 * grabbable.
 */
export function portLayer<TPose>(
  participants: ParticipantSource<TPose>,
  opts: PortAffordanceOptions<TPose> = {},
): RenderLayer<unknown> & { hitTest: NonNullable<RenderLayer<unknown>['hitTest']> } {
  return composeAffordanceLayer(
    opts.id ?? PORT_LAYER_ID,
    'Diagram ports',
    [createPortAffordance(participants, opts)],
  ) as unknown as RenderLayer<unknown> & { hitTest: NonNullable<RenderLayer<unknown>['hitTest']> };
}

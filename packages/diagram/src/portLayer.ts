/**
 * The port affordance, composed into a layer and pointed at a scene.
 *
 * Two conveniences over {@link createPortAffordance}, both of which encode a
 * rule that is easy to get wrong rather than merely saving a line.
 */
import {
  composeAffordanceLayer,
  effectivePose,
  type RenderLayer,
} from '@weasel-js/core';
import {
  PORT_LAYER_ID,
  createPortAffordance,
  type ParticipantSource,
  type PortAffordanceOptions,
} from './portAffordance';
import type { DiagramNodeLike } from './trait';

/** The minimum a participant source needs from a scene. Narrower than `Scene`
 *  so a consumer can pass anything that answers these two. */
export interface ParticipantScene<TPose> {
  renderOrderNodes(): readonly { id: string; kind: 'leaf' | 'container'; data: unknown; pose: TPose }[];
  readonly overrides: { get(id: string): { pose?: TPose } | undefined };
  get(id: string): unknown;
  childrenOf(id: string): readonly string[];
}

/**
 * Every node in `scene`, at the pose it is **painted** at.
 *
 * `effectivePose`, not `node.pose`: an override is what a gesture is currently
 * showing, and a port that answers from the document pose while its node is
 * mid-drag sits somewhere the user can see the node is not. Nodes that carry no
 * participant trait cost one reader call each and contribute no regions.
 */
export function sceneParticipants<TPose>(
  scene: ParticipantScene<TPose>,
): ParticipantSource<TPose> {
  return function* () {
    for (const node of scene.renderOrderNodes()) {
      yield {
        node: node as DiagramNodeLike,
        pose: effectivePose(scene as never, node as never) as TPose,
      };
    }
  };
}

/**
 * The composed layer, ready for `CanvasExtensionApi.registerLayer` — the only
 * attach route that is hit-tested. Handing this to `SceneCanvas`'s `layers`
 * prop, or to a `Contribution.overlay`, paints the ports and makes none of them
 * grabbable.
 *
 * The cast is `composeAffordanceLayer` typing its data slot as `ChromeState`
 * while the layer registry takes `RenderLayer<unknown>`; both are handed the
 * same live `CanvasHelpers` envelope at runtime.
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

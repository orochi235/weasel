/**
 * Ports as affordances — what makes a painted port a grabbable one.
 *
 * A port is declared as an `AffordanceRegion`, so the kit's own region walk
 * supplies the hit-test, the screen-pixel hit radius, the cursor and the
 * exclusive claim that keeps a port drag out of the select tool's hands. That
 * is the "visible chrome is always hittable" rule doing the work: the walk runs
 * on every pointerdown before any tool sees the event, so a port answers
 * whatever tool happens to be active.
 *
 * Two things about this are easy to get wrong, and both fail silently.
 *
 * **`targetId` is `null`.** The framework composes a target's rotation about
 * its bounds center for any region naming one, and `portsOf` has already
 * rotated the port. Naming the participant here would rotate it twice.
 *
 * **`hitKind` is not set.** On the registered-layer route the discriminator is
 * the layer's own id — `<SceneCanvas>` stamps the hit `layer:<RenderLayer.id>`
 * and carries `initialScratch` through as `payload`. A `hitKind` declared here
 * would be dropped, and a binding written against it would never match.
 */
import type {
  Affordance,
  AffordanceRegion,
  ChromeState,
  CursorSpec,
  FillStyle,
  PoseProjection,
  Stroke,
} from '@weasel-js/core';
import { portsOf } from './ports';
import type { DiagramNodeLike, DiagramNodeReader } from './trait';
import type { Port } from './types';

/** The layer id this package composes its port regions into. */
export const PORT_LAYER_ID = 'diagram-ports';

/** The affordance kind a press on a port reports — what a binding's
 *  `target: 'affordance:...'` has to name. `<SceneCanvas>` builds it from
 *  {@link PORT_LAYER_ID}, so the two cannot drift. */
export const PORT_AFFORDANCE_KIND = `layer:${PORT_LAYER_ID}` as const;

/** A participant and the pose it is **painted** at. `effectivePose`, not
 *  `node.pose` — a port that answers from the document pose while its node is
 *  mid-drag sits somewhere the user can see the node is not. */
export interface ParticipantPose<TPose> {
  node: DiagramNodeLike;
  pose: TPose;
}

/** Where the affordance gets its participants. A thunk rather than a scene so
 *  the geometry is testable without one, and so a consumer whose participants
 *  come from somewhere else needs no adapter. */
export type ParticipantSource<TPose> = () => Iterable<ParticipantPose<TPose>>;

/** What a press on a port hands the action that picks up the drag. Arrives as
 *  `InvocationCtx.drag.affordance.payload`. */
export interface PortScratch {
  /** `CommonAffordanceScratch.targetId` — becomes `AffordanceHit.targetIds`. */
  targetId: string;
  nodeId: string;
  portId: string;
  /** The port resolved at press time: where it was and which way it faces. */
  port: Port;
}

export interface PortAffordanceOptions<TPose> {
  /** Also the chrome-caps visibility id. Default {@link PORT_LAYER_ID}. */
  id?: string;
  read?: DiagramNodeReader;
  geometry?: PoseProjection<TPose>;
  /** Which participants show their ports. Default: all of them. Gate on
   *  selection or hover by reading `state`. */
  shows?: (node: DiagramNodeLike, state: ChromeState) => boolean;
  /** Screen-pixel hit radius. Default 8, the kit's `HANDLE_BASE_PX`. */
  hitRadiusPx?: number;
  /** Screen-pixel side of the painted square. Default 7. Omit `paint` entirely
   *  by passing 0 — a port the consumer draws itself is still hittable. */
  sizePx?: number;
  fill?: FillStyle;
  stroke?: Stroke;
  cursor?: CursorSpec;
  /** Default `'exclusive'` on pointer gestures: a drag from a port is a
   *  connect, never a move of the node underneath it. */
  strength?: 'exclusive' | 'shared';
}

const DEFAULT_HIT_PX = 8;
const DEFAULT_SIZE_PX = 7;

/** Read a port press's scratch back off the hit an action was handed. */
export function portScratchOf(hit: { payload?: unknown } | null | undefined): PortScratch | null {
  const payload = hit?.payload as PortScratch | undefined;
  return payload !== undefined && typeof payload.portId === 'string' ? payload : null;
}

/**
 * The affordance. Compose it into a layer with `composeAffordanceLayer` and
 * attach that with `CanvasExtensionApi.registerLayer` — the only attach route
 * that is hit-tested. A `Contribution.overlay` is painted and never hit.
 */
export function createPortAffordance<TPose>(
  participants: ParticipantSource<TPose>,
  opts: PortAffordanceOptions<TPose> = {},
): Affordance {
  const {
    id = PORT_LAYER_ID,
    hitRadiusPx = DEFAULT_HIT_PX,
    sizePx = DEFAULT_SIZE_PX,
    strength = 'exclusive',
  } = opts;
  const portOpts = {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
  };
  const paint = sizePx <= 0
    ? undefined
    : {
      kind: 'square' as const,
      sizePx,
      ...(opts.fill ? { fill: opts.fill } : {}),
      ...(opts.stroke ? { stroke: opts.stroke } : {}),
    };

  return {
    id,
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const { node, pose } of participants()) {
        if (opts.shows !== undefined && !opts.shows(node, state)) continue;
        for (const port of portsOf(node, pose, portOpts)) {
          out.push({
            id: `${node.id}:${port.id}`,
            targetId: null,
            shape: { kind: 'point', x: port.point.x, y: port.point.y, hitRadiusPx },
            ...(paint ? { paint } : {}),
            ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
            strength,
            claimedKinds: ['pointer'],
            bind: () => ({
              initialScratch: {
                targetId: node.id,
                nodeId: node.id,
                portId: port.id,
                port,
              } satisfies PortScratch,
            }),
          });
        }
      }
      return out;
    },
  };
}

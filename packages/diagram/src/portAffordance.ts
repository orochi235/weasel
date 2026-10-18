/**
 * Ports as affordances — what makes a painted port a grabbable one.
 *
 * A port is declared as an `AffordanceRegion`, so the kit's own region walk
 * supplies the hit-test, the screen-pixel hit radius, the cursor and the
 * exclusive claim that keeps a port drag out of the select tool's hands. The
 * walk runs on every pointerdown before any tool sees the event, so a port
 * answers whatever tool happens to be active.
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
  CommandStroke,
  CursorSpec,
  PoseDescriptor,
  CommandFill,
} from '@weasel-js/core';
import { ellipsePath, paintsLayer, viewToTransform } from '@weasel-js/core';
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
  /** Not drawn: on a hidden layer, or hidden on its own or by an ancestor.
   *  `sceneParticipants` answers it from the scene's `nodeGates`. */
  hidden?: boolean;
  /** Out of reach: locked, or on a locked layer. */
  locked?: boolean;
  /** The scene layer the node is painted on, which the asking view may not
   *  paint (`ChromeState.layerIsPainted`, `ViewApi.layerIsPainted`). */
  layer?: string;
}

/** Whether a participant's ports are drawn, grabbed and landed on. A hidden
 *  or locked node gets none, as it gets no selection or hover chrome either,
 *  and nor does one on a layer the asking view does not paint. */
export function offersPorts(
  p: { hidden?: boolean; locked?: boolean; layer?: string },
  view?: Parameters<typeof paintsLayer>[0],
): boolean {
  return p.hidden !== true && p.locked !== true && paintsLayer(view, p.layer);
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

/** Options for {@link createPortAffordance}: which ports show, and how they
 *  are painted and hit. */
export interface PortAffordanceOptions<TPose> {
  /** Also the chrome-caps visibility id. Default {@link PORT_LAYER_ID}. */
  id?: string;
  read?: DiagramNodeReader;
  geometry?: PoseDescriptor<TPose>;
  /** Which participants show their ports. Default: all of them. Gate on
   *  selection or hover by reading `state`. */
  shows?: (node: DiagramNodeLike, state: ChromeState) => boolean;
  /** Which of a participant's ports show. Default: all of them. A port
   *  this turns away is not painted or grabbable, and passed with the connect
   *  options (as `diagramPorts` and `DiagramView` do), no connect lands on it. */
  showsPort?: (port: Port) => boolean;
  /** Screen-pixel hit radius. Default 8, the kit's `HANDLE_BASE_PX`. */
  hitRadiusPx?: number;
  /** Screen-pixel size of the painted mark: a square's side, or a circle's
   *  diameter. Default 7. Omit `paint` entirely by passing 0 — a port the
   *  consumer draws itself is still hittable. */
  sizePx?: number;
  /** One fill for every port, or a function of the port — its `type`, say. */
  fill?: CommandFill | ((port: Port) => CommandFill);
  stroke?: CommandStroke;
  /** Default `'square'`. */
  shape?: 'square' | 'circle';
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

function withPaint(paint: AffordanceRegion['paint']): { paint?: NonNullable<AffordanceRegion['paint']> } {
  return paint === undefined ? {} : { paint };
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
  const paintOf = (port: Port): AffordanceRegion['paint'] => {
    if (sizePx <= 0) return undefined;
    const fill = typeof opts.fill === 'function' ? opts.fill(port) : opts.fill;
    const look = { ...(fill ? { fill } : {}), ...(opts.stroke ? { stroke: opts.stroke } : {}) };
    if (opts.shape !== 'circle') return { kind: 'square', sizePx, ...look };
    return {
      kind: 'custom',
      // An affordance layer paints in screen pixels, so the mark stays one size at any zoom.
      draw: ({ world, view }) => {
        const t = viewToTransform(view);
        const x = t.panX + world.x * t.zoom.x - sizePx / 2;
        const y = t.panY + world.y * t.zoom.y - sizePx / 2;
        return [{ kind: 'path', path: ellipsePath({ x, y, width: sizePx, height: sizePx }), ...look }];
      },
    };
  };

  return {
    id,
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const participant of participants()) {
        if (!offersPorts(participant, state)) continue;
        const { node, pose } = participant;
        if (opts.shows !== undefined && !opts.shows(node, state)) continue;
        for (const port of portsOf(node, pose, portOpts)) {
          if (opts.showsPort !== undefined && !opts.showsPort(port)) continue;
          out.push({
            id: `${node.id}:${port.id}`,
            targetId: null,
            shape: { kind: 'point', x: port.point.x, y: port.point.y, hitRadiusPx },
            ...withPaint(paintOf(port)),
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

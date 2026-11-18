import { useEffect, useMemo, useRef } from 'react';
import { solid } from '@weasel-js/paint';
import { asNodeId, createSetPoseOp, SceneCanvas, WeaselProvider, useScene, useVelocityTracker } from '@weasel-js/core';
import { createGridLayer } from '@weasel-js/guides';
import type { Dims, Fill, MoveBehavior, RectPose as Pose } from '@weasel-js/core';
import type { Animator, PhysicsHandle } from '@weasel-js/animator';
import { DemoStage } from '../DemoStage';
import { movePreset, pickPreset, useSelection } from '@weasel-js/editing';

interface Vec2 { x: number; y: number }

const FLICK_W = 600, FLICK_H = 160;
const FLICK_GRID = 60;
const FLICK_GRID_LAYER = createGridLayer({ spacing: FLICK_GRID });
const FLICK_BLOCK = 40;
const FLICK_COAST_MS = 180;

function nearestGridCell(p: Vec2, area: Dims): Vec2 {
  const round = (v: number) => Math.round(v / FLICK_GRID) * FLICK_GRID;
  return {
    x: Math.max(0, Math.min(area.width - FLICK_BLOCK, round(p.x))),
    y: Math.max(0, Math.min(area.height - FLICK_BLOCK, round(p.y))),
  };
}

/** A flick in flight, and how to record it where it stands. */
interface Flight { handle: PhysicsHandle<Pose>; land(): void }

/**
 * Move behavior: on release, coast on the flick velocity, then retarget the
 * same in-flight physics to the nearest grid cell. One animation throughout —
 * `PhysicsHandle.setTarget` turns the decay into a spring without restarting.
 * It runs on the node's pose target, so each frame is a pose override, and the
 * whole flick records as one transform once it lands.
 */
function flickToGrid(args: {
  animator: Animator;
  tracker: ReturnType<typeof useVelocityTracker>;
  flight: React.MutableRefObject<Flight | null>;
  area: () => Dims;
}): MoveBehavior<Pose> {
  const { animator, tracker, flight, area } = args;
  const PREV = 'flickToGrid.prev';
  const pointer = (ctx: { pointer: { worldX: number; worldY: number } }): Vec2 =>
    ({ x: ctx.pointer.worldX, y: ctx.pointer.worldY });

  return {
    onStart(ctx) {
      flight.current?.land();
      tracker.reset();
      ctx.scratch[PREV] = pointer(ctx);
    },
    onMove(ctx) {
      const prev = ctx.scratch[PREV] as Vec2;
      const now = pointer(ctx);
      tracker.record(now.x - prev.x, now.y - prev.y, performance.now());
      ctx.scratch[PREV] = now;
    },
    onEnd(ctx, end) {
      if (end.answered) return undefined;
      const id = ctx.draggedIds[0];
      const release = id ? ctx.current.get(id) : undefined;
      const target = id ? ctx.adapter.poseTarget?.(id) : undefined;
      if (!id || !release || !target) return undefined;
      const from = ctx.origin.get(id) ?? target.committed();

      let live: Pose = release;
      let landed = false;
      let snapped = false;
      let handle: PhysicsHandle<Pose> | undefined;
      const land = (settled = false): void => {
        if (landed) return;
        landed = true;
        if (handle && flight.current?.handle === handle) flight.current = null;
        handle?.cancel();
        // A flick too slow to coast rests before the retarget below, so it snaps here.
        const to = settled && !snapped
          ? { ...live, ...nearestGridCell(live, area()) }
          // The target committed the landing untracked; put the document back so the op records the move.
          : target.committed();
        target.commit(from);
        ctx.adapter.applyOps?.([createSetPoseOp<Pose>({ id, from, to })], 'flick');
      };
      const { vx, vy } = tracker.getVelocity();
      handle = animator.physics<Pose>({
        target,
        from: release,
        to: null, // start in decay mode
        // useVelocityTracker reports px/ms; physics velocity is units/sec.
        velocity: { x: vx * 1000, y: vy * 1000, width: 0, height: 0 },
        damping: 5,
        stiffness: 80,
        onTick: (p) => { live = p; },
        onDone: () => land(true),
      });
      if (landed) return null;
      const self: Flight = { handle, land: () => land() };
      flight.current = self;
      // A newer flick, or the demo unmounting, has already ended this one.
      setTimeout(() => {
        if (flight.current !== self) return;
        snapped = true;
        self.handle.setTarget({ ...live, ...nearestGridCell(live, area()) });
      }, FLICK_COAST_MS);
      return null;
    },
  };
}

export function FlickSnapPanel({ animator }: { animator: Animator }) {
  const scene = useScene<{ fill: Fill }, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      id: asNodeId('block'),
      kind: 'mark',
      layer: 'default',
      pose: { x: 60, y: 60, width: FLICK_BLOCK, height: FLICK_BLOCK },
      data: { fill: { paint: solid('#7fb069') } },
    }],
  });
  const selection = useSelection({ scene });
  const tracker = useVelocityTracker();
  const flight = useRef<Flight | null>(null);
  const size = useRef<Dims>({ width: FLICK_W, height: FLICK_H });
  useEffect(() => () => {
    flight.current?.handle.cancel();
    flight.current = null;
  }, []);

  const behaviors = useMemo(
    () => [flickToGrid({ animator, tracker, flight, area: () => size.current })],
    [animator, tracker],
  );

  // The demo site mounts one provider set at its root; isolated so this canvas
  // and the card canvas each keep their own selection.
  return (
    <WeaselProvider isolate>
      <DemoStage width={FLICK_W} height={FLICK_H}>
        <SceneCanvas features={[pickPreset, movePreset]}
          className="ckd-canvas"
          onResize={(s) => { size.current = s; }}
          scene={scene}
          selection={selection}
          selectTool={{ move: { behaviors } }}
          layers={{
            grid: { layer: FLICK_GRID_LAYER },
            selectionOverlay: { handles: false },
          }}
        />
      </DemoStage>
    </WeaselProvider>
  );
}


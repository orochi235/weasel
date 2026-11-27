import { useCallback, useEffect, useRef } from 'react';
import { glide, kit, mix, sum, vec, type Glide, type GlideEdge, type Mix } from '@msb235/blits';
import { useVisibleRaf, type VisibleRaf } from '@weasel-js/react';
import { checkInertia } from './checkInertia';

/** Per-axis limits on a view's position. Any side may be left open. */
export interface PanBounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

/** Momentum settings for a pan: how quickly a flung view slows, when it stops,
 *  and what happens at the pan limits. The `DecayLoopOptions` fields a caller
 *  chooses up front, without the per-gesture `velocity` / `onTick`. */
export interface InertiaOptions {
  /** Share of speed kept each 60 Hz frame, in (0, 1). Default 0.92. */
  friction?: number;
  /** Speed, in units per ms, below which the coast ends; positive. Default 0.01. */
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

/** How a decay should run: its starting velocity, how fast it slows, and what
 *  happens if it reaches the pan limits. */
export interface DecayLoopOptions {
  velocity: { vx: number; vy: number };
  friction?: number;
  minSpeed?: number;
  /** Per-axis factor turning `velocity` into the units `minSpeed` is in: a view's
   *  scale, when the velocity is in world units and `minSpeed` in screen pixels. Default 1. */
  speedScale?: { x: number; y: number };
  /** Bounds for boundary clamping. Requires `boundary` to take effect. */
  viewBounds?: PanBounds;
  /**
   * What to do when the coast reaches `viewBounds`. Default: no clamping.
   * - `'stop'`: stop on the edge, dropping that axis's velocity.
   * - `'bounce'`: turn back off the edge with all of the speed it met it at.
   * - `'spring'`: turn back with half that speed, so the motion settles after a few bounces.
   *
   * A coast let go past an edge springs back to it unless it is heading back inside.
   */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** Starting position for internal boundary tracking, used when no `position` is given.
   *  `viewBounds` with a `boundary` needs one of the two. */
  initialPosition?: { x: number; y: number };
  /** Reads the live position each frame for boundary checks, so a move made by
   *  anything else mid-coast is seen. Without it, the loop tracks its own sum of
   *  deltas from `initialPosition`. */
  position?: () => { x: number; y: number };
  onTick: (dx: number, dy: number) => void;
  /** Called once when the coast ends: `'end'` when it comes to rest, `'cancel'`
   *  when `cancel`, a new `start`, or an unmount cuts it short. */
  onEnd?: (reason: 'end' | 'cancel') => void;
}

/** What each `boundary` is as a blits glide edge: `'spring'` keeps half the speed per bounce. */
const EDGES: Record<NonNullable<DecayLoopOptions['boundary']>, GlideEdge> = {
  stop: 'stop',
  bounce: { reflect: 1 },
  spring: { reflect: 0.5 },
};

/** The 60 Hz frame `friction` is the share of speed kept over. */
const FRAME_MS = 16.67;

interface Pan { p: number[] }
const PAN = kit<Pan>({ p: vec(2, sum()) });
/** The one subject a coast moves. */
const VIEW = {};

interface Coast {
  mix: Mix<object, Pan>;
  glide: Glide<object, Pan, number[]>;
  /** The position at the last frame, from which the next tick's delta is taken. */
  at: number[];
  minSpeed: number;
  /** `speedScale` per axis, as magnitudes. */
  k: { x: number; y: number };
  /** Whether the glide is cued yet: that happens on the first frame, at its time. */
  cued: boolean;
  /** What a glide re-cued from a live position is built from. */
  config: DecayLoopOptions;
  friction: number;
  position?: () => { x: number; y: number };
  onTick: (dx: number, dy: number) => void;
  onEnd?: (reason: 'end' | 'cancel') => void;
}

/** A blits glide for `config` from `from`: per-axis bounds only where `boundary` and `viewBounds` are both set. */
function glideFor(config: DecayLoopOptions, friction: number, from: number[]): Coast['glide'] {
  const { velocity, viewBounds: b, boundary } = config;
  const bounded = b !== undefined && boundary !== undefined;
  return glide<object, Pan, number[]>('p', {
    from,
    // blits counts velocity per second and the friction as a time constant in ms.
    velocity: [velocity.vx * 1000, velocity.vy * 1000],
    ms: -FRAME_MS / Math.log(friction),
    settle: 0,
    ...(bounded && {
      bounds: [
        [b.minX ?? -Infinity, b.minY ?? -Infinity],
        [b.maxX ?? Infinity, b.maxY ?? Infinity],
      ] as const,
      edge: EDGES[boundary],
    }),
  });
}

const PAN_MIX = { name: 'viewport coast' };

/** Restarts `c`'s glide at `now` from `live`, keeping its velocity: something else moved the view mid-coast. */
function recue(c: Coast, live: { x: number; y: number }, now: number): void {
  const v = c.glide.read(VIEW)?.velocity ?? [0, 0];
  c.mix.close();
  c.mix = mix<object, Pan>(PAN, PAN_MIX);
  c.mix.sync(now);
  c.at = [live.x, live.y];
  const velocity = { vx: (v[0] as number) / 1000, vy: (v[1] as number) / 1000 };
  c.glide = glideFor({ ...c.config, velocity }, c.friction, c.at);
  c.mix.cue({ patch: c.glide });
}

/** A frame loop that coasts a value to a stop under friction on a blits glide,
 *  reporting the per-frame delta. What turns a released pan drag into momentum
 *  scrolling. */
export function useDecayLoop() {
  const coastRef = useRef<Coast | null>(null);

  const end = useCallback((frameLoop: VisibleRaf) => {
    const c = coastRef.current;
    coastRef.current = null;
    frameLoop.cancel();
    c?.mix.close();
    return c;
  }, []);

  const tick = useCallback((now: number, frameLoop: VisibleRaf) => {
    const c = coastRef.current;
    if (!c) return;
    c.mix.sync(now);
    if (!c.cued) {
      // Cued at the first frame's time, so the coast starts at the frame that first shows it.
      c.mix.cue({ patch: c.glide });
      c.cued = true;
      frameLoop.request();
      return;
    }
    const live = c.position?.();
    if (live && (live.x !== c.at[0] || live.y !== c.at[1])) recue(c, live, now);
    const p = c.mix.probe(VIEW).p;
    const [x, y] = [p[0] as number, p[1] as number];
    const dx = x - (c.at[0] as number);
    const dy = y - (c.at[1] as number);
    c.at = [x, y];
    if (dx !== 0 || dy !== 0) c.onTick(dx, dy);
    // The callback may have canceled or replaced this coast.
    if (coastRef.current !== c) return;
    const v = c.glide.read(VIEW)?.velocity ?? [0, 0];
    if (Math.hypot((v[0] as number) * c.k.x, (v[1] as number) * c.k.y) / 1000 < c.minSpeed) {
      end(frameLoop);
      c.onEnd?.('end');
      return;
    }
    frameLoop.request();
  }, [end]);

  const frameLoop = useVisibleRaf(
    tick,
    {
      phase: 'update',
      // Coasting does not continue while suspended: the resuming frame picks
      // up where the coast was rather than an hour further on.
      onResume: useCallback(() => { coastRef.current?.mix.rebase(); }, []),
    },
  );

  const cancel = useCallback(() => { end(frameLoop)?.onEnd?.('cancel'); }, [end, frameLoop]);

  const start = useCallback((config: DecayLoopOptions) => {
    checkInertia('useDecayLoop', config);
    if (config.viewBounds && config.boundary && !config.position && !config.initialPosition) {
      throw new TypeError('useDecayLoop: viewBounds with a boundary needs a position or an initialPosition to check them from');
    }
    cancel();
    const { velocity, friction = 0.92, minSpeed = 0.01, position, initialPosition, onTick, onEnd } = config;
    const k = { x: Math.abs(config.speedScale?.x ?? 1), y: Math.abs(config.speedScale?.y ?? 1) };
    const speed = Math.hypot(velocity.vx * k.x, velocity.vy * k.y);
    // A non-finite velocity is a bad measurement, not a fling: friction never brings it down.
    if (!Number.isFinite(speed) || speed < minSpeed) { onEnd?.('end'); return; }
    const at = position?.() ?? initialPosition ?? { x: 0, y: 0 };
    const from = [at.x, at.y];
    coastRef.current = {
      mix: mix<object, Pan>(PAN, PAN_MIX),
      glide: glideFor(config, friction, from),
      at: from,
      minSpeed,
      k,
      cued: false,
      config,
      friction,
      position,
      onTick,
      onEnd,
    };
    frameLoop.request();
  }, [cancel, frameLoop]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { start, cancel };
}

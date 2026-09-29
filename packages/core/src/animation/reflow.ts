import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../core/geometry/poseDescriptor';
import { documentPose, effectivePose, type PosedNode, type PoseSource } from '../core/scene/effectivePose';
import type { NodeId, PoseOverride, PoseOverrides } from '../core/scene/types';
import type { ReflowTransition } from '../layout/types';
import type { AnimationHandle, Animator, EasingSpec, SpringPresetName } from './types';

/** How a reflowed sibling travels: a duration and easing, or a spring. */
export interface ReflowTransitionOptions<TPose> {
  /** Default 200. Ignored under `spring`. */
  ms?: number;
  easing?: EasingSpec;
  /** Travel on a spring instead of a duration. A retarget restarts it from
   *  the pose on screen, so position stays continuous and velocity does not
   *  carry over. */
  spring?: {
    preset?: SpringPresetName;
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  /** Supplies the `lerp` between two poses. Default `RECT_POSE_DESCRIPTOR`. */
  geometry?: PoseDescriptor<TPose>;
  /** Names each glide in `animator.watch` and `live()`. Default `'reflow'`. */
  label?: string;
}

/** A {@link ReflowTransition} the animator drives. `dispose` drops every
 *  override it holds; the transition stays usable afterward. */
export interface AnimatedReflow<TPose = unknown> extends ReflowTransition<TPose> {
  dispose(): void;
}

/** The part of a scene a reflow transition reads and overrides. */
export interface ReflowScene<TPose> extends PoseSource<TPose> {
  readonly overrides: PoseOverrides<TPose>;
}

interface Glide<TPose> {
  entry: PoseOverride<TPose>;
  target: TPose;
  settling: boolean;
  handle: AnimationHandle | null;
}

/** The animator's cancel-key for one node's glide. */
const keyFor = (id: string): string => `reflow:${id}`;

function samePose(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if (!samePose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function makeReflow<TPose>(
  scene: ReflowScene<TPose>,
  animator: Animator,
  read: () => ReflowTransitionOptions<TPose>,
): AnimatedReflow<TPose> {
  const glides = new Map<string, Glide<TPose>>();
  let dirty = false;
  let unsubscribe: (() => void) | null = null;

  // Ticks only mark the frame dirty; one commit per animator frame publishes
  // every glide at once.
  const subscribe = (): void => {
    if (unsubscribe) return;
    unsubscribe = animator.onTick(() => {
      if (!dirty) return;
      dirty = false;
      scene.overrides.commit();
    });
  };
  const unsubscribeIfIdle = (): void => {
    if (glides.size > 0 || !unsubscribe) return;
    unsubscribe();
    unsubscribe = null;
  };

  const release = (id: string, g: Glide<TPose>): void => {
    if (glides.get(id) === g) glides.delete(id);
    const nid = id as NodeId;
    if (scene.overrides.get(nid) === g.entry) scene.overrides.clear(nid);
    dirty = true;
  };

  const run = (id: string, g: Glide<TPose>, to: TPose, settling: boolean): void => {
    const from = g.entry.pose as TPose;
    g.target = to;
    g.settling = settling;
    if (samePose(from, to)) {
      g.handle?.cancel();
      g.handle = null;
      g.entry.pose = to;
      if (settling) release(id, g);
      scene.overrides.commit();
      unsubscribeIfIdle();
      return;
    }
    const o = read();
    const lerp = (o.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>)).lerp;
    if (!lerp) throw new Error('useAnimatedReflow: geometry has no lerp; supply geometry: { ..., lerp }');
    const onTick = (p: number): void => {
      g.entry.pose = lerp(from, to, p);
      dirty = true;
    };
    const onDone = (): void => {
      g.handle = null;
      if (!g.settling) return;
      release(id, g);
      unsubscribeIfIdle();
    };
    const cancelKey = keyFor(id);
    const label = o.label ?? 'reflow';
    subscribe();
    // The shared key is what retargets: the new animation interrupts the old.
    g.handle = o.spring
      ? animator.spring<number>({ from: 0, to: 1, ...o.spring, cancelKey, label, onTick, onDone })
      : animator.tween<number>({ from: 0, to: 1, ms: o.ms ?? 200, easing: o.easing, cancelKey, label, onTick, onDone });
    scene.overrides.commit();
  };

  const stop = (id: string): void => {
    const g = glides.get(id);
    if (!g) return;
    glides.delete(id);
    g.handle?.cancel();
    const nid = id as NodeId;
    if (scene.overrides.get(nid) === g.entry) {
      scene.overrides.clear(nid);
      scene.overrides.commit();
    }
    unsubscribeIfIdle();
  };

  // The glide for `id`, created if absent, starting from `from` when given,
  // and published over whatever override is showing the node.
  const claim = (
    id: string,
    node: PosedNode<TPose>,
    g: Glide<TPose> | undefined,
    from: TPose | undefined,
  ): Glide<TPose> => {
    if (!g) {
      const start = from ?? effectivePose(scene, node);
      g = { entry: { pose: start }, target: start, settling: false, handle: null };
      glides.set(id, g);
    } else if (from !== undefined) {
      g.entry.pose = from;
    }
    if (scene.overrides.get(id as NodeId) !== g.entry) scene.overrides.set(id as NodeId, g.entry);
    return g;
  };

  return {
    glide(id, pose, opts) {
      const node = scene.get(id as NodeId);
      if (!node) return;
      const from = opts?.from;
      const g = glides.get(id);
      if (g && from === undefined && !g.settling && samePose(g.target, pose)) return;
      run(id, claim(id, node, g, from), pose, false);
    },
    settle(id, opts) {
      const from = opts?.from;
      const g = glides.get(id);
      if (!g && from === undefined) return;
      const node = scene.get(id as NodeId);
      if (!node) { stop(id); return; }
      const home = documentPose(scene, node);
      if (g && from === undefined) {
        if (g.settling && samePose(g.target, home)) return;
        run(id, g, home, true);
        return;
      }
      run(id, claim(id, node, g, from), home, true);
    },
    stop,
    poseOf: (id) => glides.get(id)?.entry.pose,
    dispose() {
      for (const id of [...glides.keys()]) stop(id);
    },
  };
}

/**
 * A reflow transition over `animator`: each glide is a tween (or spring) of
 * its own, keyed `reflow:<id>`, so a new target for a node interrupts the
 * glide it is on and `animator.cancelKey` reaches one node's. See
 * {@link useAnimatedReflow} for the hook form.
 */
export function createReflowTransition<TPose>(
  scene: ReflowScene<TPose>,
  animator: Animator,
  opts: ReflowTransitionOptions<TPose> = {},
): AnimatedReflow<TPose> {
  return makeReflow(scene, animator, () => opts);
}

/**
 * Opt a canvas's layout reflow into animation: pass the result to
 * `<SceneCanvas reflowTransition>` and siblings a drag displaces glide to
 * their slots instead of snapping. `null` (or `false`) turns it off, and
 * whatever it was holding snaps home. Option changes apply from the next
 * glide on, without rebuilding.
 */
export function useAnimatedReflow<TPose>(
  scene: ReflowScene<TPose>,
  animator: Animator,
  opts: ReflowTransitionOptions<TPose> | null | false | undefined,
): AnimatedReflow<TPose> | null {
  const latest = useLatest(opts || {});
  const enabled = !!opts;
  const reflow = useMemo(
    () => (enabled ? makeReflow(scene, animator, () => latest.current) : null),
    [enabled, scene, animator, latest],
  );
  useEffect(() => () => reflow?.dispose(), [reflow]);
  return reflow;
}

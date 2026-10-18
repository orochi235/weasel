import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../core/geometry/poseDescriptor';
import { documentPose, effectivePose, type PosedNode, type PoseSource } from '../core/scene/effectivePose';
import type { NodeId, PoseOverride, PoseOverrides } from '../core/scene/types';
import type { ReflowTransition } from '../layout/types';
import { liveAxes } from './poseTarget';
import { createTarget, type Target } from '@weasel-js/animator';
import type { Animator, EasingSpec, SpringPresetName } from '@weasel-js/animator';

/** How a reflowed sibling travels: a duration and easing, or a spring. */
export interface ReflowTransitionOptions<TPose> {
  /** Default 200. Ignored under `spring`. */
  ms?: number;
  easing?: EasingSpec;
  /** Travel on a spring instead of a duration. A retarget starts a new spring
   *  from the pose on screen at the speed the node was moving. */
  spring?: {
    preset?: SpringPresetName;
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  /** Supplies the pose's axes, and its `lerp` is the path a timed glide
   *  follows. Default `RECT_POSE_DESCRIPTOR`, each axis in a straight line.
   *  A pose with no axes glides by `lerp` alone, and a retarget restarts it. */
  geometry?: PoseDescriptor<TPose>;
  /** Names each glide in `animator.watch` and `live()`. Default `'reflow'`. */
  label?: string;
}

/** A {@link ReflowTransition} the animator drives. `dispose` drops every
 *  override it holds; the transition stays usable afterward. */
export interface AnimatedReflow<TPose = unknown> extends ReflowTransition<TPose> {
  dispose(): void;
  /** The same transition over another scene: its animator, timing and label,
   *  for poses `geometry` describes given this one's descriptor. Option
   *  changes reach it as they reach this one. */
  over<TOther>(
    scene: ReflowScene<TOther>,
    geometry: (mine: PoseDescriptor<TPose>) => PoseDescriptor<TOther>,
  ): AnimatedReflow<TOther>;
}

/** The part of a scene a reflow transition reads and overrides. */
export interface ReflowScene<TPose> extends PoseSource<TPose> {
  readonly overrides: PoseOverrides<TPose>;
}

interface Glide<TPose> {
  entry: PoseOverride<TPose>;
  /** Where the layout wants the node shown: what its target commits. */
  slot: TPose;
  settling: boolean;
  /** Null for a pose with no axes, which glides by `lerp`. */
  target: Target<TPose> | null;
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
  return {
    ...makeGlides(scene, animator, read),
    over: (other, geometry) => makeReflow(other, animator, () => {
      const { geometry: own, ...timing } = read();
      return { ...timing, geometry: geometry(own ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>)) };
    }),
  };
}

function makeGlides<TPose>(
  scene: ReflowScene<TPose>,
  animator: Animator,
  read: () => ReflowTransitionOptions<TPose>,
): Omit<AnimatedReflow<TPose>, 'over'> {
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
    g.settling = settling;
    if (samePose(from, to)) {
      animator.cancelKey(keyFor(id));
      g.slot = to;
      g.entry.pose = to;
      if (settling) release(id, g);
      scene.overrides.commit();
      unsubscribeIfIdle();
      return;
    }
    // Already on its way there: whatever is moving it finishes the job.
    if (g.target?.active && samePose(g.slot, to)) return;
    const o = read();
    const lerp = o.geometry?.lerp;
    const onDone = (): void => {
      if (g.target?.active || !g.settling) return;
      release(id, g);
      unsubscribeIfIdle();
    };
    const cancelKey = keyFor(id);
    const label = o.label ?? 'reflow';
    subscribe();
    if (g.target) {
      // A spring interrupts what is moving the node and takes its velocity; a timed glide adds to it.
      if (o.spring) animator.spring<TPose>({ target: g.target, to, ...o.spring, cancelKey, label, onDone });
      else {
        animator.tween<TPose>({
          target: g.target, to, ms: o.ms ?? 200, easing: o.easing, cancelKey, interrupt: false, label, onDone,
          interpolate: lerp && ((a, b, t) => lerp(a, b, t)),
        });
      }
    } else {
      if (!lerp) throw new Error('useAnimatedReflow: this pose has no axes; supply geometry: { ..., lerp }');
      g.slot = to;
      const onTick = (p: number): void => {
        g.entry.pose = lerp(from, to, p);
        dirty = true;
      };
      // The shared key is what retargets: the new animation interrupts the old.
      if (o.spring) animator.spring<number>({ from: 0, to: 1, ...o.spring, cancelKey, label, onTick, onDone });
      else animator.tween<number>({ from: 0, to: 1, ms: o.ms ?? 200, easing: o.easing, cancelKey, label, onTick, onDone });
    }
    scene.overrides.commit();
  };

  // False for a glide canceled through the animator: it stopped short of its
  // slot and nothing is carrying it there.
  const onCourse = (id: string, g: Glide<TPose>): boolean =>
    animator.isActive(keyFor(id)) || samePose(g.entry.pose, g.slot);

  const stop = (id: string): void => {
    const g = glides.get(id);
    if (!g) return;
    glides.delete(id);
    animator.cancelKey(keyFor(id));
    const nid = id as NodeId;
    if (scene.overrides.get(nid) === g.entry) {
      scene.overrides.clear(nid);
      scene.overrides.commit();
    }
    unsubscribeIfIdle();
  };

  const start = (id: string, pose: TPose): Glide<TPose> => {
    const g: Glide<TPose> = { entry: { pose }, slot: pose, settling: false, target: null };
    const descriptor = read().geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
    const axes = liveAxes(descriptor, () => g.slot);
    if (axes) {
      g.target = createTarget<TPose>({
        axes,
        get: () => g.slot,
        set: (slot) => { g.slot = slot; },
        show: (shown) => {
          g.entry.pose = shown;
          dirty = true;
        },
      });
    }
    glides.set(id, g);
    return g;
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
      g = start(id, from ?? effectivePose(scene, node));
    } else if (from !== undefined) {
      animator.cancelKey(keyFor(id));
      g.slot = from;
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
      if (g && from === undefined && !g.settling && samePose(g.slot, pose) && onCourse(id, g)) return;
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
        if (g.settling && samePose(g.slot, home) && onCourse(id, g)) return;
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
 * A reflow transition over `animator`. Each node it moves has an animation
 * target whose committed value is the slot the layout wants it shown at, and
 * a new slot is a new animation on that target under the key `reflow:<id>`:
 * a timed glide adds to the ones still running, a spring interrupts them at
 * their velocity, and `animator.cancelKey` reaches one node's. See
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

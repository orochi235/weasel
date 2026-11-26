/** What `animator.watch` and `animator.live` report about the animations an animator runs. */
import type { EventTrack, TimelineEvent } from './timeline/types';

/** Which animator call started an animation. A loop, tween loop or stagger is
 *  an entry of its own beside the children it runs; `keepAlive` holds the
 *  frame loop open and animates nothing. */
export type AnimationKind =
  | 'tween' | 'spring' | 'decay' | 'physics' | 'timeline'
  | 'loop' | 'tweenLoop' | 'stagger' | 'keepAlive' | 'hold';

/** Who an {@link AnimatorEvent} is about. One object per registration, so the
 *  same animation's events share it by identity. */
export interface AnimationInfo {
  /** The id on the animation's handle. */
  readonly id: number;
  readonly kind: AnimationKind;
  /** The animation's `cancelKey`. Pose helpers key by node, as `pose:<id>`. */
  readonly key?: string;
  /** The animation's `label` option. */
  readonly label?: string;
}

/** One row of `animator.live()`. */
export interface LiveAnimation extends AnimationInfo {
  /** Paused on its own handle. The animator-wide pause is `animator.isPaused()`. */
  readonly paused: boolean;
  /** Its own time scale; the animator's multiplies on top. */
  readonly timeScale: number;
  /** Virtual ms its clock has advanced since it started. */
  readonly elapsed: number;
  /** Handed to `Element.animate`: the browser's compositor shows it, and no frame ticks it. */
  readonly compositor?: true;
  /** 0 to 1, for a tween or a timeline (the playhead over its duration).
   *  Absent where there is no end to measure against: physics, composites. */
  readonly progress?: number;
}

/**
 * One thing happening to an animation, as `animator.watch` delivers it.
 *
 * - `start` — registered. A finished timeline that `seek` or `edit` revives
 *   starts again, under the same id.
 * - `end` — finished on its own. Delivered once every animation has ticked
 *   that frame, in registration order.
 * - `cancel` — stopped by its handle, `cancel`, `cancelKey` or `cancelAll`.
 * - `interrupt` — stopped because `by` claimed its `cancelKey`. Delivered
 *   before `by`'s `start`.
 * - `error` — its tick threw (an `onTick`, `onDone` or interpolator), so it was
 *   taken off the table, after the frame's other animations ticked. In place of
 *   `cancel`, or after `end` when `onDone` threw. The error is also logged.
 * - `lap` — a looping timeline wrapped; `lap` counts wraps since it started.
 * - `fire` — an event on a timeline's event track was crossed, at any depth.
 *   `path` indexes from the root timeline's `tracks()` down through each
 *   nested timeline to the event track. Delivered after the event's own `fire`.
 */
export type AnimatorEvent =
  | { readonly type: 'start' | 'end' | 'cancel'; readonly animation: AnimationInfo }
  | { readonly type: 'interrupt'; readonly animation: AnimationInfo; readonly by: AnimationInfo }
  | { readonly type: 'error'; readonly animation: AnimationInfo; readonly error: unknown }
  | { readonly type: 'lap'; readonly animation: AnimationInfo; readonly lap: number }
  | {
    readonly type: 'fire';
    readonly animation: AnimationInfo;
    readonly track: EventTrack;
    readonly path: readonly number[];
    readonly event: TimelineEvent;
    /** As the event's own `fire` is told: ms behind the frame it was crossed. */
    readonly lateBy: number;
  };

/** Receives what `animator.watch` delivers. */
export type AnimatorListener = (event: AnimatorEvent) => void;

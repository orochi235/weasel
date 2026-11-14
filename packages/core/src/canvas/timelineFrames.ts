import type { TimelineHandle } from '@weasel-js/animator';
import { createRasterSession, type RasterRenderArgs, type RasterSession, type RasterSessionOptions } from './renderSceneToPixels';
import type { RasterImage } from './renderSceneToPixelsTypes';

/** The part of a timeline {@link renderTimelineFrames} drives. */
export type SteppedTimeline = Pick<TimelineHandle, 'seek' | 'time' | 'duration' | 'pause' | 'resume' | 'isPaused'>;

/** Where {@link renderTimelineFrames} has got to, reported as each frame is rendered. */
export interface TimelineFrameProgress {
  /** The frame just rendered, from 0. */
  index: number;
  /** How many frames the span renders. */
  count: number;
  /** The playhead it was rendered at, in ms. */
  time: number;
}

/** One frame of a timeline. */
export interface TimelineFrame {
  index: number;
  /** The playhead in ms. */
  time: number;
  image: RasterImage;
}

/** What {@link renderTimelineFrames} takes. */
export interface TimelineFramesOptions<TData, TLayer extends string, TPose> {
  timeline: SteppedTimeline;
  /** Frames per second. */
  fps: number;
  /** The span's start in ms. Default 0. */
  from?: number;
  /** The span's end in ms. Default the timeline's duration. */
  to?: number;
  /** Whether a frame lands on `to` itself. Default false: frame `i` is at `from + i / fps`, and the
   *  frames cover `[from, to)` as a video of the span plays them, each lasting `1 / fps`. True adds
   *  the last pose, for a sequence that ends where the animation does. */
  includeEnd?: boolean;
  /** What each frame renders: the same args every frame, the scene's poses being what the timeline
   *  moves, or a function of the frame for a render that changes with it. */
  render: RasterRenderArgs<TData, TLayer, TPose> | ((frame: { index: number; time: number }) => RasterRenderArgs<TData, TLayer, TPose>);
  /** A session to render through, which stays open. Default one opened for the run and disposed after it. */
  session?: RasterSession;
  /** As `createRasterSession` takes them, for the session opened when `session` is not given. */
  sessionOptions?: RasterSessionOptions;
  /** Aborting it stops the run before its next frame, which throws the signal's reason. */
  signal?: AbortSignal;
  onProgress?: (progress: TimelineFrameProgress) => void;
}

/** The playheads of a span's frames, in ms, in the order they render. */
export function timelineFrameTimes(from: number, to: number, fps: number, includeEnd = false): number[] {
  if (!(fps > 0) || !Number.isFinite(fps)) throw new RangeError(`timeline frames: fps must be a positive number, got ${String(fps)}`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    throw new RangeError(`timeline frames: the span ${String(from)} to ${String(to)} ms is not one`);
  }
  // The slack keeps a span of whole frames whole where (to - from) * fps / 1000 lands a hair over.
  const count = Math.max(1, Math.ceil((to - from) * fps / 1000 - 1e-6));
  const times = Array.from({ length: count }, (_, i) => from + (i * 1000) / fps);
  if (includeEnd && times[count - 1]! < to) times.push(to);
  return times;
}

/**
 * Render a timeline span frame by frame: pause it, `seek` to each frame's playhead in order, and
 * render through a raster session, yielding each frame as it is made. The timeline is put back
 * where it was, playing or paused, when the run ends, is aborted, throws, or the caller stops
 * iterating.
 *
 * ```ts
 * for await (const frame of renderTimelineFrames({ timeline, fps: 30, render: { scene, sourceRect, scale } })) {
 *   files.push(await rasterToPng(frame.image));
 * }
 * ```
 *
 * Each render reads the scene as `seek` leaves it, so it draws what the timeline's tracks show at
 * that time.
 */
export async function* renderTimelineFrames<TData, TLayer extends string, TPose>(
  opts: TimelineFramesOptions<TData, TLayer, TPose>,
): AsyncGenerator<TimelineFrame, void, undefined> {
  const { timeline, signal } = opts;
  const times = timelineFrameTimes(opts.from ?? 0, opts.to ?? timeline.duration(), opts.fps, opts.includeEnd);
  signal?.throwIfAborted();
  const wasAt = timeline.time();
  const wasPaused = timeline.isPaused();
  const session = opts.session ?? createRasterSession(opts.sessionOptions);
  timeline.pause();
  try {
    for (let index = 0; index < times.length; index++) {
      signal?.throwIfAborted();
      const time = times[index]!;
      timeline.seek(time);
      const args = typeof opts.render === 'function' ? opts.render({ index, time }) : opts.render;
      const image = session.render(args);
      opts.onProgress?.({ index, count: times.length, time });
      yield { index, time, image };
    }
  } finally {
    if (!opts.session) session.dispose();
    timeline.seek(wasAt);
    if (!wasPaused) timeline.resume();
  }
}

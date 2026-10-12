import {
  EASINGS, reviveTypedArrays, tagTypedArrays, type BezierEasing, type EasingName, type EasingSpec,
} from '@weasel-js/geom';
import type { Target } from '../target';
import type { Interpolate } from '../types';
import type { EventTrack, NestedTimeline, SampledTrack, TimelineEvent, TimelineTrack, Track } from './types';

/** A value a clip can hold: what `JSON.stringify` writes and `JSON.parse` reads back. An
 *  object's `undefined` members are left out, as JSON leaves them. */
export type ClipValue = number | string | boolean | null | ClipValue[] | { [key: string]: ClipValue | undefined };

/** A keyframe as data. Its easing is a built-in's name or bezier control points. */
export interface ClipKey {
  t: number;
  /** A typed array in the live key's value, as a `Path` has, is held as a `TaggedTypedArray`
   *  from `@weasel-js/geom`: `{ __ta: 'f32', data: [...] }`. `bindClip` makes it the array again. */
  value: ClipValue;
  easing?: EasingName | BezierEasing;
}

/** A `SampledTrack` as data: what it moves and how it interpolates are names. */
export interface ClipSampledTrack {
  kind: 'sampled';
  label?: string;
  /** Resolved by `ClipBinder.target`. A track with none is sampled and moves nothing. */
  target?: string;
  keys: ClipKey[];
  /** Resolved from `ClipBinder.interpolate`. Without one the track is sampled in its
   *  target's axes, or field by field. */
  interpolate?: string;
  /** The track's share of its target: a number, or a name for `ClipBinder.weight` to resolve
   *  into a function read each frame, as a crossfade's is. */
  weight?: number | string;
  /** The part of the target the track holds: names for `ClipBinder.axes` to resolve, a rig's
   *  joints among them, or positions in the target's axes where it has no names. */
  axes?: number[] | string[];
}

/** An `EventTrack` as data: each event is a name and what to carry with it. */
export interface ClipEventTrack {
  kind: 'event';
  label?: string;
  events: { t: number; name: string; data?: ClipValue }[];
}

/** A `TimelineTrack` as data. */
export interface ClipTimelineTrack {
  kind: 'timeline';
  label?: string;
  at: number;
  timeline: ClipTimeline;
}

/** Any track a clip can hold. */
export type ClipTrack = ClipSampledTrack | ClipEventTrack | ClipTimelineTrack;

/** A `NestedTimeline` as data. */
export interface ClipTimeline {
  tracks: ClipTrack[];
  duration?: number;
}

/** A timeline as data: what `JSON.stringify` can write, `bindClip` can play, and `toClip`
 *  can read back off a live timeline. */
export interface Clip extends ClipTimeline {
  version: 1;
}

/** What turns the names in a clip into the live things a timeline plays. */
export interface ClipBinder {
  /** The target a sampled track names. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target?(name: string): Target<any> | undefined;
  /** Interpolations by name. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interpolate?: Readonly<Record<string, Interpolate<any>>>;
  /** The axes of the target named `target` that `names` stand for, as `jointAxes` answers a
   *  skeleton's joints, or `undefined` for a target it has no names for. */
  axes?(target: string, names: readonly string[]): readonly number[] | undefined;
  /** The function a track's named weight stands for. */
  weight?(name: string): (() => number) | undefined;
  /** What an event does: its `fire`, its `book`, or both. */
  event?(name: string, data: ClipValue | undefined): Pick<TimelineEvent, 'fire' | 'book'> | undefined;
}

const defined = <T extends object>(o: T): T => {
  for (const k in o) if (o[k] === undefined) delete o[k];
  return o;
};

function bindTrack(track: ClipTrack, binder: ClipBinder): Track {
  if (track.kind === 'timeline') {
    return defined<TimelineTrack>({ kind: 'timeline', label: track.label, at: track.at, timeline: bindTimeline(track.timeline, binder) });
  }
  if (track.kind === 'event') {
    return defined<EventTrack>({
      kind: 'event',
      label: track.label,
      events: track.events.map((e) => {
        const does = binder.event?.(e.name, e.data);
        if (!does) throw new Error(`bindClip: the binder has no event named "${e.name}".`);
        return defined<TimelineEvent>({ t: e.t, name: e.name, data: e.data, fire: does.fire, book: does.book });
      }),
    });
  }
  const target = track.target === undefined ? undefined : binder.target?.(track.target);
  if (track.target !== undefined && !target) throw new Error(`bindClip: the binder has no target named "${track.target}".`);
  const interpolate = track.interpolate === undefined ? undefined : binder.interpolate?.[track.interpolate];
  if (track.interpolate !== undefined && !interpolate) {
    throw new Error(`bindClip: the binder has no interpolation named "${track.interpolate}".`);
  }
  return defined<SampledTrack<ClipValue>>({
    kind: 'sampled',
    label: track.label,
    keys: track.keys.map((k) => ({ ...k, value: reviveTypedArrays(k.value) as ClipValue })),
    target,
    targetName: track.target,
    interpolate,
    interpolateName: track.interpolate,
    ...bindWeight(track, binder),
    ...bindAxes(track, binder),
  });
}

const isNames = (axes: readonly (number | string)[]): axes is readonly string[] => typeof axes[0] === 'string';

function bindWeight(track: ClipSampledTrack, binder: ClipBinder): Pick<SampledTrack<ClipValue>, 'weight' | 'weightName'> {
  const { weight } = track;
  if (typeof weight !== 'string') return { weight };
  const read = binder.weight?.(weight);
  if (!read) throw new Error(`bindClip: the binder has no weight named "${weight}".`);
  return { weight: read, weightName: weight };
}

function bindAxes(track: ClipSampledTrack, binder: ClipBinder): Pick<SampledTrack<ClipValue>, 'axes' | 'axisNames'> {
  const { axes } = track;
  if (!axes) return {};
  if (!isNames(axes)) return { axes: [...axes] };
  const quoted = axes.map((name) => `"${name}"`).join(', ');
  if (track.target === undefined) throw new Error(`bindClip: track "${track.label ?? ''}" names axes and no target: ${quoted}.`);
  const resolved = binder.axes?.(track.target, axes);
  if (!resolved) throw new Error(`bindClip: the binder has no axes named ${quoted} on the target "${track.target}".`);
  return { axes: [...resolved], axisNames: [...axes] };
}

function bindTimeline(timeline: ClipTimeline, binder: ClipBinder): NestedTimeline {
  return defined<NestedTimeline>({ tracks: timeline.tracks.map((t) => bindTrack(t, binder)), duration: timeline.duration });
}

/**
 * The live timeline a clip describes, for `animator.timeline`: each sampled track given the
 * target and interpolation it names, each event what the binder says it does. The tracks
 * keep those names, so `toClip` can write them back after an editor has changed them.
 * Throws on a name the binder does not resolve.
 */
export function bindClip(clip: Clip, binder: ClipBinder): NestedTimeline {
  if (clip.version !== 1) throw new Error(`bindClip: this clip is version ${String(clip.version)}, and version 1 is the one understood.`);
  return bindTimeline(clip, binder);
}

const EASING_NAMES = new Map<unknown, EasingName>(
  (Object.keys(EASINGS) as EasingName[]).map((name) => [EASINGS[name], name]),
);

function isClipValue(v: unknown): v is ClipValue {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(isClipValue);
  if (typeof v !== 'object' || Object.prototype.toString.call(v) !== '[object Object]') return false;
  return Object.values(v as object).every((member) => member === undefined || isClipValue(member));
}

function easingOf(spec: EasingSpec | undefined, where: string): EasingName | BezierEasing | undefined {
  if (spec === undefined || typeof spec === 'string') return spec;
  if (typeof spec !== 'function') return { bezier: [...spec.bezier] as BezierEasing['bezier'] };
  const name = EASING_NAMES.get(spec);
  if (!name) throw new Error(`toClip: ${where} eases a key by a function that is not a built-in; name it or use bezier points.`);
  return name;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sampledToClip(track: SampledTrack<any>, where: string): ClipSampledTrack {
  if (track.onTick) throw new Error(`toClip: ${where} has an onTick, which a clip cannot hold; move the value with a target.`);
  if (track.target && track.targetName === undefined) throw new Error(`toClip: ${where} has a target and no targetName.`);
  if (track.interpolator) throw new Error(`toClip: ${where} has an interpolator, which a clip cannot hold.`);
  if (track.interpolate && track.interpolateName === undefined) throw new Error(`toClip: ${where} has an interpolate and no interpolateName.`);
  if (typeof track.weight === 'function' && track.weightName === undefined) {
    throw new Error(`toClip: ${where} has a function for its weight and no weightName.`);
  }
  return defined<ClipSampledTrack>({
    kind: 'sampled',
    label: track.label,
    target: track.targetName,
    keys: track.keys.map((k) => {
      const value = tagTypedArrays(k.value);
      if (!isClipValue(value)) throw new Error(`toClip: ${where} holds a value JSON cannot round-trip, at t = ${k.t}.`);
      return defined<ClipKey>({ t: k.t, value, easing: easingOf(k.easing, where) });
    }),
    interpolate: track.interpolateName,
    weight: typeof track.weight === 'function' ? track.weightName : track.weight,
    axes: track.axisNames ? [...track.axisNames] : track.axes && [...track.axes],
  });
}

function trackToClip(track: Track, index: number): ClipTrack {
  const where = `track "${track.label ?? index}"`;
  if (track.kind === 'timeline') {
    return defined<ClipTimelineTrack>({ kind: 'timeline', label: track.label, at: track.at, timeline: timelineToClip(track.timeline) });
  }
  if (track.kind === 'sampled') return sampledToClip(track, where);
  return defined<ClipEventTrack>({
    kind: 'event',
    label: track.label,
    events: track.events.map((e) => {
      if (e.name === undefined) throw new Error(`toClip: ${where} has an event with no name, at t = ${e.t}.`);
      if (e.data !== undefined && !isClipValue(e.data)) throw new Error(`toClip: ${where} carries data JSON cannot round-trip, at t = ${e.t}.`);
      return defined({ t: e.t, name: e.name, data: e.data as ClipValue | undefined });
    }),
  });
}

function timelineToClip(timeline: NestedTimeline): ClipTimeline {
  return defined<ClipTimeline>({ tracks: timeline.tracks.map(trackToClip), duration: timeline.duration });
}

/**
 * A live timeline as a clip: `{ tracks, duration }` as `animator.timeline` takes them, or
 * `{ tracks: handle.tracks() }` off a running one. Each track is written by the names it
 * carries (`targetName`, `interpolateName`, an event's `name`), which `bindClip` sets and a
 * track written by hand can set too. A typed array in a key's value is written tagged.
 * Throws, naming the track, on anything a clip cannot hold: a function with no name, an
 * `onTick`, or a value JSON would not read back.
 */
export function toClip(timeline: NestedTimeline): Clip {
  return { version: 1, ...timelineToClip(timeline) };
}

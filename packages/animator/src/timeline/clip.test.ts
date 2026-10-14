import { describe, expect, it, vi } from 'vitest';
import { easeInOutSine, PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';
import { skeletonAxes } from '../rig/skeletonAxes';
import { IDENTITY_JOINT, type Pose, type Skeleton } from '../rig/types';
import { createTarget, type Target } from '../target';
import { bindClip, toClip, type Clip, type ClipBinder, type ClipKey, type ClipSampledTrack } from './clip';
import { sampleTrack } from './sampleTrack';
import type { EventTrack, NestedTimeline, SampledTrack, TimelineTrack, Track } from './types';

function numberTarget(start = 0): Target<number> & { value(): number } {
  let v = start;
  return Object.assign(createTarget<number>({ get: () => v, set: (n) => { v = n; } }), { value: () => v });
}

const CLIP: Clip = {
  version: 1,
  duration: 1200,
  tracks: [
    {
      kind: 'sampled', label: 'x', target: 'pose:box.x', weight: 0.5,
      keys: [{ t: 0, value: 0 }, { t: 1000, value: 100, easing: 'easeInOutSine' }, { t: 1200, value: 50, easing: { bezier: [0.2, 0, 0.4, 1] } }],
    },
    { kind: 'sampled', label: 'tint', target: 'tint', interpolate: 'oklab', keys: [{ t: 0, value: [1, 0, 0] }, { t: 1000, value: [0, 0, 1] }] },
    { kind: 'event', label: 'steps', events: [{ t: 300, name: 'step', data: { foot: 'left' } }, { t: 900, name: 'step' }] },
    {
      kind: 'timeline', label: 'bounce', at: 200,
      timeline: { duration: 400, tracks: [{ kind: 'sampled', target: 'pose:box.y', keys: [{ t: 0, value: 0 }, { t: 400, value: 9 }] }] },
    },
  ],
};

function binder(over: Partial<ClipBinder> = {}): ClipBinder & { targets: Record<string, Target<unknown>> } {
  const targets: Record<string, Target<unknown>> = {
    'pose:box.x': numberTarget() as never, 'pose:box.y': numberTarget() as never, tint: numberTarget() as never,
  };
  return {
    targets,
    target: (name) => targets[name],
    interpolate: { oklab: (a: number[], b: number[], u: number) => a.map((v, i) => v + (b[i] - v) * u) },
    event: () => ({ fire: () => {} }),
    ...over,
  };
}

describe('bindClip', () => {
  it('gives each sampled track the target it names, with its keys, weight, and easings', () => {
    const b = binder();
    const live = bindClip(CLIP, b);
    const x = live.tracks[0] as SampledTrack<number>;
    expect(live.duration).toBe(1200);
    expect(x.target).toBe(b.targets['pose:box.x']);
    expect(x.targetName).toBe('pose:box.x');
    expect(x.weight).toBe(0.5);
    expect(x.keys).toEqual(CLIP.tracks[0].kind === 'sampled' ? CLIP.tracks[0].keys : []);
    // The keys are the live track's own, so an edit to one does not reach the clip.
    x.keys[0].value = 7;
    expect((CLIP.tracks[0] as { keys: { value: number }[] }).keys[0].value).toBe(0);
  });

  it('samples a bound track as one written by hand', () => {
    const x = bindClip(CLIP, binder()).tracks[0] as SampledTrack<number>;
    const byHand: SampledTrack<number> = {
      kind: 'sampled', target: numberTarget(),
      keys: [{ t: 0, value: 0 }, { t: 1000, value: 100, easing: easeInOutSine }],
    };
    expect(sampleTrack(x, 250)).toBeCloseTo(sampleTrack(byHand, 250)!, 6);
  });

  it('resolves a named interpolation', () => {
    const tint = bindClip(CLIP, binder()).tracks[1] as SampledTrack<number[]>;
    expect(tint.interpolateName).toBe('oklab');
    expect(sampleTrack(tint, 500)).toEqual([0.5, 0, 0.5]);
  });

  it('asks the binder what each event does, by name and data', () => {
    const fired: unknown[] = [];
    const event = vi.fn((name: string, data: unknown) => ({ fire: () => { fired.push([name, data]); } }));
    const steps = bindClip(CLIP, binder({ event })).tracks[2] as EventTrack;
    expect(steps.events.map((e) => [e.t, e.name, e.data])).toEqual([[300, 'step', { foot: 'left' }], [900, 'step', undefined]]);
    steps.events[0].fire!(0);
    expect(fired).toEqual([['step', { foot: 'left' }]]);
  });

  it('binds a nested timeline', () => {
    const b = binder();
    const nested = bindClip(CLIP, b).tracks[3] as TimelineTrack;
    expect(nested.at).toBe(200);
    expect(nested.timeline.duration).toBe(400);
    expect((nested.timeline.tracks[0] as SampledTrack<number>).target).toBe(b.targets['pose:box.y']);
  });

  it('throws on a name the binder cannot resolve, saying which', () => {
    expect(() => bindClip(CLIP, binder({ target: () => undefined }))).toThrow(/no target named "pose:box.x"/);
    expect(() => bindClip(CLIP, binder({ interpolate: {} }))).toThrow(/no interpolation named "oklab"/);
    expect(() => bindClip(CLIP, binder({ event: () => undefined }))).toThrow(/no event named "step"/);
    expect(() => bindClip({ ...CLIP, version: 2 as never }, binder())).toThrow(/version 2/);
  });
});

describe('toClip', () => {
  it('answers the clip a timeline was bound from, through JSON', () => {
    const back = toClip(bindClip(CLIP, binder()));
    expect(JSON.parse(JSON.stringify(back))).toEqual(CLIP);
  });

  it('keeps a track\'s names through the shallow copy an editor makes of it', () => {
    const live = bindClip(CLIP, binder());
    const x = live.tracks[0] as SampledTrack<number>;
    const edited: NestedTimeline = {
      ...live,
      tracks: [{ ...x, keys: [...x.keys, { t: 1500, value: 0, easing: easeInOutSine }] }, ...live.tracks.slice(1)],
    };
    const clip = toClip(edited);
    const keys = (clip.tracks[0] as { keys: unknown[] }).keys;
    expect(keys[3]).toEqual({ t: 1500, value: 0, easing: 'easeInOutSine' });
  });

  it('describes a track written by hand once it carries names', () => {
    const track: SampledTrack<number> = {
      kind: 'sampled', target: numberTarget(), targetName: 'gain', keys: [{ t: 0, value: 1 }],
    };
    expect(toClip({ tracks: [track] })).toEqual({
      version: 1, tracks: [{ kind: 'sampled', target: 'gain', keys: [{ t: 0, value: 1 }] }],
    });
  });

  it('throws on what a clip cannot hold, naming the track', () => {
    const base: SampledTrack<number> = { kind: 'sampled', label: 'x', target: numberTarget(), targetName: 'x', keys: [{ t: 0, value: 1 }] };
    const clip = (track: Track) => () => toClip({ tracks: [track] });
    expect(clip({ ...base, targetName: undefined } as never)).toThrow(/track "x" has a target and no targetName/);
    expect(clip({ ...base, onTick: () => {}, target: undefined, targetName: undefined } as never)).toThrow(/track "x" has an onTick/);
    expect(clip({ ...base, interpolate: (a: number) => a } as never)).toThrow(/track "x" has an interpolate and no interpolateName/);
    expect(clip({ ...base, weight: () => 1 } as never)).toThrow(/track "x" has a function for its weight and no weightName/);
    expect(clip({ ...base, keys: [{ t: 0, value: 1, easing: (u: number) => u * u }] } as never)).toThrow(/track "x" eases a key by a function that is not a built-in/);
    expect(clip({ ...base, keys: [{ t: 0, value: new Map() }] } as never)).toThrow(/track "x" holds a value JSON cannot/);
    expect(clip({ ...base, keys: [{ t: 0, value: Float32Array.of(NaN) }] } as never)).toThrow(/track "x" holds a value JSON cannot/);
    expect(clip({ kind: 'event', label: 'e', events: [{ t: 0, fire: () => {} }] })).toThrow(/track "e" has an event with no name/);
  });
});

describe('a clip naming a target\'s axes', () => {
  const skeleton = (...names: string[]): Skeleton => ({
    joints: names.map((name) => ({ name, parent: null, bind: { ...IDENTITY_JOINT } })),
  });
  const ARM: Clip = {
    version: 1,
    tracks: [{ kind: 'sampled', target: 'rig:hero', axes: ['armL', 'foreL'], keys: [{ t: 0, value: {} }] }],
  };
  const over = (s: Skeleton): ClipBinder => binder({
    target: () => createTarget<Pose>({ get: () => ({}), set: () => {}, axes: skeletonAxes(s) }) as never,
  });

  it('keeps the names on the track, for its target to resolve', () => {
    const track = bindClip(ARM, over(skeleton('hip', 'armL', 'foreL'))).tracks[0] as SampledTrack<Pose>;
    expect(track.axes).toEqual(['armL', 'foreL']);
    expect(track.target!.axisIndexes(track.axes!)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('follows the joints when the skeleton\'s order changes', () => {
    const track = bindClip(ARM, over(skeleton('foreL', 'hip', 'armL'))).tracks[0] as SampledTrack<Pose>;
    expect(track.target!.axisIndexes(track.axes!)).toEqual([10, 11, 12, 13, 14, 0, 1, 2, 3, 4]);
  });

  it('writes the names back', () => {
    expect(toClip(bindClip(ARM, over(skeleton('hip', 'armL', 'foreL'))))).toEqual(ARM);
  });

  it('takes numbers as positions', () => {
    const clip: Clip = { version: 1, tracks: [{ kind: 'sampled', target: 'pose:box.x', axes: [0], keys: [{ t: 0, value: 1 }] }] };
    const track = bindClip(clip, binder()).tracks[0] as SampledTrack<unknown>;
    expect(track.axes).toEqual([0]);
    expect(toClip({ tracks: [track] })).toEqual(clip);
  });

  it('throws as it binds on axes the target does not have, saying which track target', () => {
    expect(() => bindClip(ARM, binder({ target: () => numberTarget() as never })))
      .toThrow(/bindClip: track "" on the target "rig:hero" names "armL" on a target whose axes have no names/);
    expect(() => bindClip(ARM, over(skeleton('hip')))).toThrow(/on the target "rig:hero" names "armL", and the target's axes are "hip.x"/);
    const untargeted: Clip = { version: 1, tracks: [{ kind: 'sampled', label: 'loose', axes: ['armL'], keys: [{ t: 0, value: 1 }] }] };
    expect(() => bindClip(untargeted, over(skeleton('armL')))).toThrow(/track "loose" names axes and no target/);
  });
});

describe('a clip naming a track\'s weight', () => {
  const FADED: Clip = {
    version: 1,
    tracks: [{ kind: 'sampled', target: 'pose:box.x', weight: 'fade', keys: [{ t: 0, value: 1 }] }],
  };

  it('asks the binder for the function the name stands for, and keeps the name', () => {
    let fade = 0.25;
    const track = bindClip(FADED, binder({ weight: (name) => (name === 'fade' ? () => fade : undefined) })).tracks[0] as SampledTrack<number>;
    expect(track.weightName).toBe('fade');
    expect((track.weight as () => number)()).toBe(0.25);
    fade = 1;
    expect((track.weight as () => number)()).toBe(1);
  });

  it('writes the name back', () => {
    expect(toClip(bindClip(FADED, binder({ weight: () => () => 1 })))).toEqual(FADED);
  });

  it('throws on a name the binder cannot resolve', () => {
    expect(() => bindClip(FADED, binder())).toThrow(/no weight named "fade"/);
  });
});

describe('a clip holding a path', () => {
  const shape = (...coords: number[]): PolygonPath => ({
    kind: 'polygon', commands: Uint8Array.of(PATH_M, PATH_L), coords: Float32Array.from(coords), fillRule: 'nonzero',
  });
  const live = (): NestedTimeline => ({
    tracks: [
      {
        kind: 'sampled', label: 'outline', target: numberTarget() as never, targetName: 'pose:blob',
        keys: [{ t: 0, value: shape(0, 0, 10, 0) }, { t: 500, value: shape(0, 0, 10, 20) }],
      },
    ],
  });

  it('writes a typed array as a tag and its numbers', () => {
    const track = toClip(live()).tracks[0] as ClipSampledTrack;
    expect(track.keys[1].value).toEqual({
      kind: 'polygon', commands: { __ta: 'u8', data: [PATH_M, PATH_L] }, coords: { __ta: 'f32', data: [0, 0, 10, 20] }, fillRule: 'nonzero',
    });
  });

  it('reads the typed arrays back through JSON', () => {
    const clip = JSON.parse(JSON.stringify(toClip(live()))) as Clip;
    const back = bindClip(clip, binder({ target: () => numberTarget() as never }));
    const keys = (back.tracks[0] as SampledTrack<PolygonPath>).keys;
    expect(keys[1].value.coords).toBeInstanceOf(Float32Array);
    expect(keys[1].value.commands).toBeInstanceOf(Uint8Array);
    expect(keys.map((k) => k.value)).toEqual([shape(0, 0, 10, 0), shape(0, 0, 10, 20)]);
    expect(toClip(back)).toEqual(clip);
  });

  it('leaves a clip\'s own values out of reach of an edit to the live track', () => {
    const clip = toClip(live());
    const back = bindClip(clip, binder({ target: () => numberTarget() as never }));
    (back.tracks[0] as SampledTrack<PolygonPath>).keys[0].value.coords[2] = 99;
    expect((clip.tracks[0] as ClipSampledTrack).keys[0].value).toMatchObject({ coords: { data: [0, 0, 10, 0] } });
  });
});

describe('a clip value typed by an interface', () => {
  interface BoxPose { x: number; y: number; width: number; height: number }

  // The assignment is the check, and only the typecheck can fail it.
  it('is a key value, as the same object written inline is', () => {
    const pose: BoxPose = { x: 1, y: 2, width: 3, height: 4 };
    const key: ClipKey = { t: 0, value: pose };
    const clip: Clip = { version: 1, tracks: [{ kind: 'sampled', keys: [key] }] };
    expect(toClip(bindClip(clip, {}))).toEqual(clip);
  });
});

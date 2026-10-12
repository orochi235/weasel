import { describe, expect, it, vi } from 'vitest';
import { easeInOutSine } from '@weasel-js/geom';
import { createTarget, type Target } from '../target';
import { bindClip, toClip, type Clip, type ClipBinder } from './clip';
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
    expect(clip({ ...base, weight: () => 1 } as never)).toThrow(/track "x" has a function for its weight/);
    expect(clip({ ...base, keys: [{ t: 0, value: 1, easing: (u: number) => u * u }] } as never)).toThrow(/track "x" eases a key by a function that is not a built-in/);
    expect(clip({ ...base, keys: [{ t: 0, value: new Float32Array(2) }] } as never)).toThrow(/track "x" holds a value JSON cannot/);
    expect(clip({ kind: 'event', label: 'e', events: [{ t: 0, fire: () => {} }] })).toThrow(/track "e" has an event with no name/);
  });
});

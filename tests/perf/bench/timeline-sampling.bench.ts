/**
 * Keyframe sampling before and after it moved onto a blits `keys` patch
 * (step 3 of `docs/proposals/2026-09-30-animator-on-blits.md`). One iteration
 * samples N four-key tracks once each at an advancing playhead, the way a
 * timeline's frame does.
 */
import { resolveEasing } from '@weasel-js/geom';
import { sampleTrack, type SampledTrack } from '@weasel-js/core';
import { group } from './group';

/** Read once: a module export read per call adds vitest getter overhead. */
const sample = sampleTrack;
const resolve = resolveEasing;

/** The sampler as it was before the port, kept here as the baseline. */
function today(track: SampledTrack<number>, t: number): number | undefined {
  const { keys } = track;
  if (keys.length === 0) return undefined;
  let lo = 0, hi = keys.length - 1, i = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid].t <= t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  if (i < 0) return keys[0].value;
  if (i >= keys.length - 1) return keys[keys.length - 1].value;
  const a = keys[i], b = keys[i + 1];
  const raw = (t - a.t) / (b.t - a.t);
  const u = b.easing ? resolve(b.easing)(raw) : raw;
  return a.value + (b.value - a.value) * u;
}

const tracks = (n: number): SampledTrack<number>[] =>
  Array.from({ length: n }, (_, k) => ({
    kind: 'sampled',
    keys: [{ t: 0, value: k }, { t: 300, value: k + 10, easing: 'easeInOutQuad' }, { t: 700, value: k - 5 }, { t: 1000, value: k }],
    onTick: () => {},
  }));

for (const n of [100, 1000, 10000]) {
  const ts = tracks(n);
  const caches = ts.map(() => new Map<number, (u: number) => number>());
  let sink = 0;
  let clock = 0;
  group(`${n} tracks, one frame`, (bench) => {
    bench('today', () => { clock = (clock + 16) % 1000; for (let k = 0; k < n; k++) sink += today(ts[k], clock)!; });
    bench('blits keys', () => { clock = (clock + 16) % 1000; for (let k = 0; k < n; k++) sink += sample(ts[k], clock, caches[k])!; });
  });
  if (sink === Infinity) console.log(sink);
}

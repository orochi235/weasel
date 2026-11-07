import type { PrefNumberScale } from '@weasel-js/prefs';
import { isDev } from '@weasel-js/registry';
import { linearScale, logScale, powScale, warpScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';

let warnedLog = false;

const LOG: ContinuousScaleFactory = (opts) => {
  const [lo, hi] = opts.domain;
  if (lo > 0 && hi > 0) return logScale(opts);
  if (isDev() && !warnedLog) {
    warnedLog = true;
    console.warn(`prefs: a log slider needs a range above zero, but its track runs ${lo}..${hi}; drawing it linear.`);
  }
  return linearScale(opts);
};

const SQRT: ContinuousScaleFactory = (opts) => powScale({ ...opts, exponent: 0.5 });

const warps = new WeakMap<object, ContinuousScaleFactory>();

/** The scale a number leaf's slider runs its track by, or `undefined` for a linear one. Every surface drawing a
 *  prefs number as a slider reads `scale` through this. */
export function prefNumberScale(scale: PrefNumberScale | undefined): ContinuousScaleFactory | undefined {
  if (scale === undefined || scale === 'linear') return undefined;
  if (scale === 'log') return LOG;
  if (scale === 'sqrt') return SQRT;
  let warp = warps.get(scale);
  if (!warp) {
    const { to, from } = scale;
    warp = (opts) => warpScale({ ...opts, to, from });
    warps.set(scale, warp);
  }
  return warp;
}

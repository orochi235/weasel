import type { PrefNumberScale } from '@weasel-js/prefs';
import { isDev } from '@weasel-js/registry';
import { linearScale, logScale, powScale, warpScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';

/** A log factory per caller, each warning once, under its caller's name, when its track does not lie above zero. */
const logs = new Map<string, ContinuousScaleFactory>();

function guardedLog(label: string): ContinuousScaleFactory {
  let log = logs.get(label);
  if (log) return log;
  let warned = false;
  log = (opts) => {
    const [lo, hi] = opts.domain;
    if (lo > 0 && hi > 0) return logScale(opts);
    if (isDev() && !warned) {
      warned = true;
      console.warn(`${label}: a log track needs a range above zero, but it runs ${lo}..${hi}; drawing it linear.`);
    }
    return linearScale(opts);
  };
  logs.set(label, log);
  return log;
}

const SQRT: ContinuousScaleFactory = (opts) => powScale({ ...opts, exponent: 0.5 });

const warps = new WeakMap<object, ContinuousScaleFactory>();

/**
 * The scale a track is spaced by, or `undefined` for a linear one. Every surface drawing a prefs number as a
 * slider reads `scale` through this, and so does any control taking a named scale. A factory passes through
 * as it is. `label` names the caller in the warning a `'log'` track over a range not above zero gives.
 */
export function prefNumberScale(
  scale: PrefNumberScale | ContinuousScaleFactory | undefined,
  label = 'prefs',
): ContinuousScaleFactory | undefined {
  if (scale === undefined || scale === 'linear') return undefined;
  if (scale === 'log') return guardedLog(label);
  if (scale === 'sqrt') return SQRT;
  if (typeof scale === 'function') return scale;
  let warp = warps.get(scale);
  if (!warp) {
    const { to, from } = scale;
    warp = (opts) => warpScale({ ...opts, to, from });
    warps.set(scale, warp);
  }
  return warp;
}

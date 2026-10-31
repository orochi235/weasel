/**
 * `@weasel-js/plot/scales` — the scales on their own: values onto a range and back, the ticks an axis marks,
 * and how they read. No React, no DOM and no scene, so a control that places values along a track, or a
 * server that lays out an axis, takes them without the rest of the package.
 *
 * @packageDocumentation
 */
export type { Scale, ContinuousScale, ContinuousScaleFactory } from './scales/types';
export {
  linearScale, niceDomain, niceStep, tickStep, stepTicks, decimalsOf, formatNumber,
  type LinearScale, type LinearScaleOptions, type SpacedTickOptions, type TickSet,
} from './scales/linear';
export { formatTick, tickDecimals, type TickFormatCtx, type TickFormatter } from './scales/tickFormat';
export { logScale, type LogScale, type LogScaleOptions } from './scales/log';
export { bandScale, type BandScale, type BandScaleOptions } from './scales/band';
export { timeScale, formatInstant, type TimeScale, type TimeScaleOptions } from './scales/time';
export { ordinalScale, type OrdinalScale, type OrdinalScaleOptions } from './scales/ordinal';

/**
 * @weasel-js/scale — values onto a range and back, the ticks an axis marks, and how they read. No React,
 * no DOM and no scene, so a control that places values along a track, a chart, or a server that lays out an
 * axis takes them alike.
 *
 * @packageDocumentation
 */
export type { Scale, ContinuousScale, ContinuousScaleFactory } from './types';
export {
  linearScale, niceDomain, tickStep, stepTicks, decimalsOf, formatNumber,
  type LinearScale, type LinearScaleOptions, type SpacedTickOptions, type TickSet,
} from './linear';
export { formatTick, tickDecimals, type TickFormatCtx, type TickFormatter } from './tickFormat';
export { logScale, type LogScale, type LogScaleOptions } from './log';
export {
  powScale, warpScale, type PowScale, type PowScaleOptions, type WarpScale, type WarpScaleOptions,
} from './warp';
export { bandScale, type BandScale, type BandScaleOptions } from './band';
export { timeScale, formatInstant, type TimeScale, type TimeScaleOptions, type TimeUnit } from './time';
export { ordinalScale, type OrdinalScale, type OrdinalScaleOptions } from './ordinal';
export { polarScale, type PolarScale, type PolarScaleOptions } from './polar';

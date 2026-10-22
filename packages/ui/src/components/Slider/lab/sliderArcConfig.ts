import type { Endless } from '@weasel-js/quantity';
import type { AlongArc } from '@weasel-js/ui/components/Along';
import type { SliderProps, SliderStop, Thumb } from '@weasel-js/ui/components/Slider';

/** The knobs the Slider-on-an-arc lab reads: the arc, and every Slider prop that is not a callback. */
export interface SliderArcConfig {
  arc: { start: number; end: number; direction: 'cw' | 'ccw'; inset: number; size: number };
  values: { min: number; max: number; step: number; thumbs: number; constraint: 'free' | 'ordered'; link: boolean };
  stops: { set: StopSet; showStops: boolean; stopLabels: 'all' | 'ends' | 'none'; snap: 'magnetic' | 'strict'; spacing: 'linear' | 'even' };
  behavior: { trackClick: 'default' | 'none' | 'move-nearest'; allowShiftAll: boolean; thumbFit: 'inside' | 'overhang'; endless: 'none' | Endless; addRemove: boolean };
  look: { trackHeight: number; density: 'default' | 'slim'; readoutPlacement: 'none' | 'inline-after' | 'below-thumb'; thumbShape: 'round' | 'notched' };
}

export type StopSet = 'none' | 'quarters' | 'labeled' | 'uneven';

/** Every knob at its default: what the story's schema starts from, and what each preset is laid over. */
export const SLIDER_ARC_DEFAULTS: SliderArcConfig = {
  arc: { start: 240, end: 120, direction: 'ccw', inset: 24, size: 280 },
  values: { min: 0, max: 100, step: 1, thumbs: 1, constraint: 'free', link: true },
  stops: { set: 'labeled', showStops: true, stopLabels: 'all', snap: 'magnetic', spacing: 'linear' },
  behavior: { trackClick: 'default', allowShiftAll: false, thumbFit: 'inside', endless: 'none', addRemove: false },
  look: { trackHeight: 8, density: 'default', readoutPlacement: 'below-thumb', thumbShape: 'round' },
};

/** The stops `set` names, laid over `min..max`. */
export function stopsOf(set: StopSet, min: number, max: number): (number | SliderStop)[] | undefined {
  const at = (k: number) => min + k * (max - min);
  const round = (v: number) => Math.round(v * 100) / 100;
  if (set === 'none') return undefined;
  if (set === 'quarters') return [0, 0.25, 0.5, 0.75, 1].map((k) => round(at(k)));
  const ks = set === 'labeled' ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.1, 0.25, 0.6, 1];
  return ks.map((k) => ({ value: round(at(k)), label: String(round(at(k))) }));
}

/** The arc the curved twin lies along. */
export function arcOf({ start, end, direction, inset }: Omit<SliderArcConfig['arc'], 'size'>): AlongArc {
  return { start, end, direction, inset };
}

/** `n` thumbs spread evenly over `min..max`, each on a `step`. */
export function spreadThumbs(n: number, min: number, max: number, step: number): Thumb[] {
  const on = (k: number) => ({ value: Math.round((min + Math.round((k * (max - min)) / step) * step) * 1e6) / 1e6 });
  if (n <= 1) return [on(0.3)];
  return Array.from({ length: n }, (_, i) => on((i + 1) / (n + 1)));
}

/** The props both twins are given: everything but the thumbs, their handlers and the shape. */
export type TwinProps = Omit<SliderProps, 'thumbs' | 'onInput' | 'onChange' | 'shape'>;

export function twinProps(c: SliderArcConfig): TwinProps {
  const { values: v, stops: st, behavior: b, look: l } = c;
  return {
    min: v.min,
    max: v.max,
    step: v.step,
    constraint: v.constraint,
    stops: stopsOf(st.set, v.min, v.max),
    showStops: st.showStops,
    stopLabels: st.stopLabels,
    snap: st.snap,
    spacing: st.spacing,
    ...(b.trackClick === 'default' ? {} : { trackClick: b.trackClick }),
    allowShiftAll: b.allowShiftAll,
    thumbFit: b.thumbFit,
    ...(b.endless === 'none' ? {} : { endless: b.endless }),
    trackHeight: l.trackHeight,
    density: l.density,
    readoutPlacement: l.readoutPlacement,
  };
}

/** A named set of knob values, by dotted path. */
export interface SliderArcPreset {
  name: string;
  config: Record<string, unknown>;
}

/** Every knob at its default, by dotted path: what each preset starts from, so loading one leaves nothing of the last behind. */
function defaultsByPath(): Record<string, unknown> {
  const d = SLIDER_ARC_DEFAULTS as unknown as Record<string, Record<string, unknown>>;
  return Object.fromEntries(Object.entries(d).flatMap(([group, leaves]) => Object.entries(leaves).map(([k, v]) => [`${group}.${k}`, v])));
}
const preset = (name: string, config: Record<string, unknown>): SliderArcPreset => ({ name, config: { ...defaultsByPath(), ...config } });

export const SLIDER_ARC_PRESETS: readonly SliderArcPreset[] = [
  preset('Zoom detents', { 'values.min': 2, 'values.max': 16, 'stops.set': 'uneven', 'stops.snap': 'strict', 'stops.spacing': 'even' }),
  preset('Range on top', { 'values.thumbs': 2, 'values.constraint': 'ordered', 'stops.set': 'quarters', 'arc.start': 300, 'arc.end': 60, 'arc.direction': 'cw' }),
  preset('Fine, no stops', { 'values.max': 1, 'values.step': 0.01, 'stops.set': 'none' }),
  preset('Endless max', { 'values.step': 5, 'behavior.endless': 'max' }),
  preset('Right side, cw', { 'arc.start': 30, 'arc.end': 150, 'arc.direction': 'cw' }),
  preset('Slim, overhang', { 'look.density': 'slim', 'behavior.thumbFit': 'overhang', 'look.trackHeight': 4 }),
  preset('Add and remove', { 'values.thumbs': 2, 'behavior.addRemove': true, 'values.link': false, 'look.thumbShape': 'notched' }),
];

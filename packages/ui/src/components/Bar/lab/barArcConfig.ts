import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { AlongArc, RunAlign } from '@weasel-js/ui/components/Along';
import { actionLeaf, LAB_ACTIONS } from '../../Along/lab/labActions';

/** The knobs the Bar-on-an-arc lab reads. */
export interface BarArcConfig {
  items: { actions: number; fields: number; section: boolean; lead: 'none' | 'label' | 'icon' };
  layout: { overflow: 'scroll' | 'menu'; align: RunAlign };
  arc: { center: number; measure: 'deg' | 'px'; sweep: number; length: number; direction: 'cw' | 'ccw'; inset: number; size: number };
  debug: { boxes: boolean };
}

/** Every knob at its default: what the story's schema starts from, and what each preset is laid over. */
export const BAR_ARC_DEFAULTS: BarArcConfig = {
  items: { actions: 6, fields: 0, section: false, lead: 'none' },
  layout: { overflow: 'scroll', align: 'center' },
  arc: { center: 0, measure: 'deg', sweep: 120, length: 200, direction: 'cw', inset: 18, size: 260 },
  debug: { boxes: false },
};

const FIELDS = ['Gain', 'Gamma', 'Blur', 'Grain'];

/** The arc centered on `center`, `sweep` degrees or `length` px long as `measure` says, running `direction` from start to end. */
export function arcOf({ center, measure, sweep, length, direction, inset }: Omit<BarArcConfig['arc'], 'size'>): AlongArc {
  return { at: center, span: measure === 'px' ? `${length}px` : `${sweep}deg`, direction, inset };
}

/** The bar's schema: the first `actions` lab actions, then `fields` number fields, those in a section of their own when asked. */
export function barSchema({ actions, fields, section }: BarArcConfig['items']): PrefGroup {
  const acts = Object.fromEntries(LAB_ACTIONS.slice(0, actions).map((a) => [a.key, actionLeaf(a.key)]));
  const numbers = Object.fromEntries(
    FIELDS.slice(0, fields).map((name) => [name.toLowerCase(), { kind: 'number', name, description: '', default: 1, min: 0, max: 10 } as PrefLeaf]),
  );
  const children = section && fields > 0 ? { ...acts, tune: { name: 'Tune', as: 'section', children: numbers } } : { ...acts, ...numbers };
  return { name: 'Lens', icon: LAB_ACTIONS[0]!.glyph, children } as PrefGroup;
}

/** A named set of knob values, by dotted path. */
export interface BarArcPreset {
  name: string;
  config: Record<string, unknown>;
}

/** What every preset starts from, so loading one leaves nothing of the last behind. */
const BASE = Object.fromEntries(
  Object.entries(BAR_ARC_DEFAULTS).flatMap(([group, leaves]) => Object.entries(leaves as Record<string, unknown>).map(([k, v]) => [`${group}.${k}`, v])),
);
const preset = (name: string, config: Record<string, unknown>): BarArcPreset => ({ name, config: { ...BASE, ...config } });

export const BAR_ARC_PRESETS: readonly BarArcPreset[] = [
  preset('Six on the top rim', {}),
  preset('Too many, scroll', { 'items.actions': 10, 'arc.sweep': 70 }),
  preset('Too many, menu', { 'items.actions': 10, 'layout.overflow': 'menu', 'arc.sweep': 70 }),
  preset('Fields on the bottom', { 'items.actions': 2, 'items.fields': 3, 'items.section': true, 'arc.center': 180, 'arc.sweep': 150, 'arc.direction': 'ccw' }),
  preset('Right side, start', { 'items.actions': 4, 'items.fields': 1, 'layout.align': 'start', 'arc.center': 90, 'arc.sweep': 160 }),
  preset('Short, align end', { 'items.actions': 2, 'layout.align': 'end', 'arc.center': 300, 'arc.sweep': 100 }),
  preset('Labeled lead', { 'items.actions': 4, 'items.lead': 'label', 'arc.sweep': 150 }),
  preset('Fixed 200 px, scroll', { 'items.actions': 10, 'arc.measure': 'px', 'arc.length': 200 }),
];

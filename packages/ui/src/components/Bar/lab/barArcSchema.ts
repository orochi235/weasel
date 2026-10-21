import { f } from '@weasel-js/forge';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { AlongArc, RunAlign } from '@weasel-js/ui/components/Along';
import { actionLeaf, LAB_ACTIONS } from '../../Along/lab/labActions';

/** The knobs the Bar-on-an-arc lab reads. */
export interface BarArcConfig {
  items: { actions: number; fields: number; section: boolean; lead: 'none' | 'label' | 'icon' };
  layout: { overflow: 'scroll' | 'menu'; align: RunAlign };
  arc: { center: number; sweep: number; direction: 'cw' | 'ccw'; inset: number; size: number };
}

export const BAR_ARC_SCHEMA = f.schema({
  items: f.group({
    actions: f.number(6).range(0, LAB_ACTIONS.length).step(1).label('Actions'),
    fields: f.number(0).range(0, 4).step(1).label('Fields'),
    section: f.boolean(false).label('Fields in a section of their own'),
    lead: f.enum('none', ['none', 'label', 'icon']).radio().label('Lead'),
  }).label('Items'),
  layout: f.group({
    overflow: f.enum('scroll', ['scroll', 'menu']).radio().label('Overflow'),
    align: f.enum('center', ['start', 'center', 'end']).radio().label('Align'),
  }).label('Layout'),
  arc: f.group({
    center: f.number(0).range(0, 359).step(1).suffix('°').label('Centered on'),
    sweep: f.number(120).range(10, 359).step(1).suffix('°').label('Sweep'),
    direction: f.enum('cw', ['cw', 'ccw']).radio().label('Direction'),
    inset: f.number(18).range(0, 80).step(1).suffix('px').label('Inset'),
    size: f.number(260).range(160, 420).step(10).suffix('px').label('Box'),
  }).label('Arc'),
});

const FIELDS = ['Gain', 'Gamma', 'Blur', 'Grain'];
const mod360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** The arc `sweep` degrees long centered on `center`, running `direction` from start to end. */
export function arcOf({ center, sweep, direction, inset }: Omit<BarArcConfig['arc'], 'size'>): AlongArc {
  const [a, b] = [mod360(center - sweep / 2), mod360(center + sweep / 2)];
  return direction === 'cw' ? { start: a, end: b, direction, inset } : { start: b, end: a, direction, inset };
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
const BASE = {
  'items.actions': 6, 'items.fields': 0, 'items.section': false, 'items.lead': 'none',
  'layout.overflow': 'scroll', 'layout.align': 'center',
  'arc.center': 0, 'arc.sweep': 120, 'arc.direction': 'cw', 'arc.inset': 18, 'arc.size': 260,
};
const preset = (name: string, config: Record<string, unknown>): BarArcPreset => ({ name, config: { ...BASE, ...config } });

export const BAR_ARC_PRESETS: readonly BarArcPreset[] = [
  preset('Six on the top rim', {}),
  preset('Too many, scroll', { 'items.actions': 10, 'arc.sweep': 70 }),
  preset('Too many, menu', { 'items.actions': 10, 'layout.overflow': 'menu', 'arc.sweep': 70 }),
  preset('Fields on the bottom', { 'items.actions': 2, 'items.fields': 3, 'items.section': true, 'arc.center': 180, 'arc.sweep': 150, 'arc.direction': 'ccw' }),
  preset('Right side, start', { 'items.actions': 4, 'items.fields': 1, 'layout.align': 'start', 'arc.center': 90, 'arc.sweep': 160 }),
  preset('Short, align end', { 'items.actions': 2, 'layout.align': 'end', 'arc.center': 300, 'arc.sweep': 100 }),
  preset('Labeled lead', { 'items.actions': 4, 'items.lead': 'label', 'arc.sweep': 150 }),
];

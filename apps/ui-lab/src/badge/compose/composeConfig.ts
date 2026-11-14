import { type ConfigSchema, f } from '@weasel-js/labkit';
import {
  BADGE_BASES, BADGE_LOOKS, type BadgeBase, type BadgeLook, type BadgeVariant,
} from '@weasel-js/ui/components/Badge';
import { baseParams, SPLINE_CURVE, SPLINE_CURVE_DEFAULTS, type SplineCurve } from '../baseParams';
import type { LabEffect } from '../effects';
import { badgeParams, type Params } from '../params';
import { effectsRenderer } from './EffectsRow';
import { splineRenderer } from './SplineRow';

export const BASE_PARAMS = baseParams(f.custom<SplineCurve>('badge-spline', SPLINE_CURVE_DEFAULTS).block().render(splineRenderer));

export type LabCaps = 'normal' | 'small-caps' | 'all-small-caps';

/** What a composed badge is: its base, every base's params (each keeps its own), and the effect stack. */
export interface ComposeShape {
  base: BadgeBase;
  params: Record<BadgeBase, Params>;
  effects: LabEffect[];
}

export interface ComposeConfig {
  shape: ComposeShape;
  look: {
    variant: BadgeVariant;
    look: BadgeLook;
    tint: string;
    bloat: number;
    size: 'sm' | 'md';
    label: string;
    crawl: boolean;
    crawlSpeed: number;
    labelX: number;
    labelY: number;
  };
  type: { font: string; sizeDelta: number; bold: boolean; italic: boolean; caps: LabCaps };
  padding: { top: number; right: number; bottom: number; left: number; linkX: boolean; linkY: boolean };
}

const FONTS = [
  { value: 'inherit', label: 'inherit' },
  { value: 'system-ui, sans-serif', label: 'system' },
  { value: 'Helvetica, Arial, sans-serif', label: 'sans' },
  { value: "Georgia, 'Times New Roman', serif", label: 'serif' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, monospace', label: 'mono' },
  { value: "'Helvetica Neue Condensed', 'Arial Narrow', sans-serif", label: 'cond' },
];

const shape = f.group({
  base: f.enum<BadgeBase>('rounded-rect', BADGE_BASES),
  params: f.group(Object.fromEntries(BADGE_BASES.map((base) => [
    base,
    f.group(BASE_PARAMS[base]).label(base).showIf({ path: 'shape.base', is: base }),
  ]))),
  effects: f.custom<LabEffect[]>('badge-effects', []).block().render(effectsRenderer),
}).section('Shape');

const look = f.group({
  variant: f.enum<BadgeVariant>('solid', ['outline', 'solid', 'subtle']),
  look: f.enum<BadgeLook>('high', [...BADGE_LOOKS, 'tint']),
  tint: f.color('#7fb069').showIf({ path: 'look.look', is: 'tint' }),
  bloat: f.number(0).range(-10, 20).step(0.25),
  size: f.enum('sm', ['sm', 'md']),
  label: f.string('COMPOSE'),
  crawl: f.boolean(false),
  crawlSpeed: f.number(0.2).range(-2, 2).step(0.05).enableIf({ path: 'look.crawl', is: true }),
  labelX: f.number(0).range(-30, 30).step(0.5).label('Label X'),
  labelY: f.number(0).range(-30, 30).step(0.5).label('Label Y'),
}).section('Appearance');

const type = f.group({
  font: f.enum('inherit', FONTS),
  sizeDelta: f.number(0).range(-6, 24).step(0.5).label('Size Δ'),
  bold: f.boolean(false),
  italic: f.boolean(false),
  caps: f.enum<LabCaps>('normal', ['normal', 'small-caps', 'all-small-caps']),
}).section('Type');

// A linked axis draws its leading side (top, left) on both and hides the other's row.
const padding = f.group({
  linkY: f.boolean(true).label('Link top and bottom'),
  linkX: f.boolean(true).label('Link left and right'),
  top: f.number(1).range(0, 40).step(0.5),
  bottom: f.number(1).range(0, 40).step(0.5).showIf({ path: 'padding.linkY', is: false }),
  left: f.number(6).range(0, 40).step(0.5),
  right: f.number(6).range(0, 40).step(0.5).showIf({ path: 'padding.linkX', is: false }),
}).section('Padding');

export const composeConfig = f.schema({ shape, look, type, padding }) as unknown as ConfigSchema<ComposeConfig>;

/** The chosen base's params as `<Badge baseParams>` takes them, a spline base's curve spread among the rest. */
export function composedBaseParams(shape: Pick<ComposeShape, 'base' | 'params'>): Params {
  const { [SPLINE_CURVE]: curve, ...rest } = shape.params[shape.base] ?? {};
  const flat = curve && typeof curve === 'object' ? { ...rest, ...(curve as SplineCurve) } : rest;
  return badgeParams(BASE_PARAMS[shape.base], flat);
}

/** The padding as `<Badge padding>` takes it, a linked axis drawing its leading side on both. */
export function composedPadding({ top, right, bottom, left, linkX, linkY }: ComposeConfig['padding']): string {
  return `${top}px ${linkX ? left : right}px ${linkY ? top : bottom}px ${left}px`;
}

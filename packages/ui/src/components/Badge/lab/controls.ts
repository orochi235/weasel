import { type BadgeBase, type BadgeEffect } from '@weasel-js/ui/components/Badge';
import { BASES } from '../bases';
import { EFFECTS } from '../effects';
import { QUATREFOIL_CONTROLS, type ShapeControl } from '../shapeControls';

const OCTANT_SPLINE_CONTROLS: ShapeControl[] = [
  { key: 'mode',     kind: 'select', options: ['octant', 'quadrant'], default: 'octant' },
  { key: 'count',    kind: 'range', min: 3,   max: 12,  step: 1,    default: 5 },
  { key: '__advanced__', kind: 'header', label: 'Advanced' },
  { key: 'rotation', kind: 'range', min: -45, max: 45,  step: 0.5, default: 0 },
  { key: 'samples',  kind: 'range', min: 48,  max: 360, step: 4,   default: 192 },
];

export const BASE_LAB_CONTROLS: Record<BadgeBase, ShapeControl[]> = {
  'rounded-rect':   [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.16 },
    { key: 'eccentricity', kind: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: 'pinch', kind: 'range', min: 0, max: 1, step: 0.02, default: 0 },
  ],
  'chamfered-rect': [{ key: 'chamfer', kind: 'range', min: 0, max: 25, step: 0.5, default: 6 }],
  'polygon':        [],
  'puzzle':         [
    { key: 'top',        kind: 'select', options: ['flat', 'out', 'in'], default: 'out' },
    { key: 'right',      kind: 'select', options: ['flat', 'out', 'in'], default: 'in' },
    { key: 'bottom',     kind: 'select', options: ['flat', 'out', 'in'], default: 'out' },
    { key: 'left',       kind: 'select', options: ['flat', 'out', 'in'], default: 'in' },
    { key: 'tabSize',    kind: 'range', min: 4, max: 30, step: 0.5, default: 12 },
    { key: 'arcSamples', kind: 'range', min: 6, max: 40, step: 1,   default: 18 },
  ],
  'octant-spline':  OCTANT_SPLINE_CONTROLS,
  'octant-bspline': OCTANT_SPLINE_CONTROLS,
  'quatrefoil':     QUATREFOIL_CONTROLS,
  'ribbon':         [
    { key: 'left',       kind: 'select', options: ['flat', 'inward', 'outward'], default: 'inward' },
    { key: 'right',      kind: 'select', options: ['flat', 'inward', 'outward'], default: 'outward' },
    { key: 'taperWidth', kind: 'range', min: 0, max: 24, step: 0.5, default: 8 },
  ],
  'powerline':      [
    { key: 'leftEdge',  kind: 'select', options: ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'], default: 'flat' },
    { key: 'rightEdge', kind: 'select', options: ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'], default: 'flat' },
    { key: 'depth',     kind: 'range',  min: 0, max: 20, step: 0.5, default: 6 },
  ],
};

export const EFFECT_LAB_CONTROLS: Record<BadgeEffect, ShapeControl[]> = {
  spikes: [
    { key: 'count',         kind: 'range',  min: 4,  max: 96, step: 1,    default: 44 },
    { key: 'length',        kind: 'range',  min: 1,  max: 30, step: 0.5,  default: 8 },
    { key: 'baseWidth',     kind: 'range',  min: 0.5, max: 12, step: 0.5, default: 3 },
    { key: 'vertScale',     kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 1.4 },
    { key: 'horzScale',     kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 1 },
    { key: 'diagonalScale', kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 0.5 },
    { key: 'irregularity',  kind: 'range',  min: 0,  max: 1,  step: 0.05, default: 0 },
  ],
  puffs: [
    { key: 'bumpWidth',     kind: 'range', min: 4, max: 50, step: 1, default: 18 },
    { key: 'puffiness',     kind: 'range', min: 1, max: 30, step: 0.5, default: 10 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,  step: 0.05, default: 0 },
  ],
  bites: [
    { key: 'biteRadius',    kind: 'range', min: 0.5, max: 8, step: 0.25, default: 3 },
    { key: 'biteSpacing',   kind: 'range', min: 2, max: 24,  step: 0.5,  default: 8 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,   step: 0.05, default: 0 },
  ],
  scallops: [
    { key: 'scallopRadius', kind: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'scallopSpacing',kind: 'range', min: 4, max: 30, step: 1,   default: 12 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,  step: 0.05, default: 0 },
  ],
  bevel: [
    { key: 'bevelWidth',    kind: 'range',  min: 0, max: 20, step: 0.5, default: 6 },
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
  ],
  bevel2: [
    { key: 'bevelWidth',    kind: 'range',  min: 0, max: 20, step: 0.5, default: 6 },
    { key: 'lightFrom',     kind: 'range',  min: 0, max: 360, step: 1, default: 315 },
  ],
  sheen: [
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
    { key: 'intensity',     kind: 'range',  min: 0, max: 0.5, step: 0.02, default: 0.22 },
  ],
  rivets: [
    { key: 'radius',        kind: 'range',  min: 0, max: 6,  step: 0.2, default: 2.4 },
    { key: 'inset',         kind: 'range',  min: 3, max: 16, step: 0.5, default: 7 },
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
  ],
  shadow: [
    { key: 'dx',            kind: 'range', min: -6, max: 6, step: 0.25, default: 1 },
    { key: 'dy',            kind: 'range', min: -6, max: 6, step: 0.25, default: 2 },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1, step: 0.02, default: 0.28 },
  ],
  woodgrain: [
    { key: 'lines',         kind: 'range', min: 1, max: 10, step: 1, default: 4 },
    { key: 'knots',         kind: 'range', min: 0, max: 6,  step: 1, default: 2 },
    { key: 'intensity',     kind: 'range', min: 0, max: 1,  step: 0.05, default: 0.55 },
  ],
  perforations: [
    { key: 'holeRadius',    kind: 'range', min: 0.5, max: 8, step: 0.25, default: 3 },
    { key: 'holeSpacing',   kind: 'range', min: 2,   max: 30, step: 0.5, default: 11 },
  ],
  outline: [
    { key: 'width',         kind: 'range', min: 0,  max: 8, step: 0.25, default: 1 },
    { key: 'color',         kind: 'color', default: '#7fb069' },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1, step: 0.02, default: 1 },
    { key: 'dash',          kind: 'text',  default: '' },
    { key: 'blendMode',     kind: 'select', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'], default: 'normal' },
  ],
  sunbeams: [
    { key: 'count',         kind: 'range', min: 1,  max: 8,  step: 1,    default: 3 },
    { key: 'width',         kind: 'range', min: 2,  max: 60, step: 1,    default: 18 },
    { key: 'gap',           kind: 'range', min: 0,  max: 40, step: 1,    default: 8 },
    { key: 'angle',         kind: 'range', min: -60, max: 60, step: 1,   default: 28 },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0.18 },
    { key: 'offset',        kind: 'range', min: -60, max: 60, step: 1,   default: 0 },
    { key: 'irregularity',  kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0 },
    { key: 'gradientAngle', kind: 'range', min: 0,  max: 360, step: 1,   default: 90 },
    { key: 'gradientStart', kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0 },
    { key: 'gradientEnd',   kind: 'range', min: 0,  max: 1,  step: 0.02, default: 1 },
  ],
  aqua: [
    { key: '__body__',       kind: 'header', label: 'Body' },
    { key: 'topAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.45 },
    { key: 'upperAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'equator',        kind: 'range', min: 15, max: 85, step: 1, default: 52 },
    { key: 'equatorSpread',  kind: 'range', min: 1, max: 40, step: 1, default: 12 },
    { key: 'equatorTint',    kind: 'range', min: 50, max: 100, step: 1, default: 95 },
    { key: 'baseTint',       kind: 'range', min: 20, max: 100, step: 1, default: 70 },
    { key: '__gloss__',      kind: 'header', label: 'Gloss' },
    { key: 'glossTopAlpha',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'glossMidAlpha',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.18 },
    { key: 'glossExtent',    kind: 'range', min: 5, max: 90, step: 1, default: 50 },
    { key: '__bezel__',      kind: 'header', label: 'Bezel & rim' },
    { key: 'bezelAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'bezelWidth',     kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
    { key: 'rimAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'rimWidth',       kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
  ],
  metal: [
    { key: 'specularity',    kind: 'range', min: 0, max: 1, step: 0.02, default: 0.6 },
    { key: '__body__',       kind: 'header', label: 'Body' },
    { key: 'equator',        kind: 'range', min: 15, max: 85, step: 1, default: 50 },
    { key: 'equatorSpread',  kind: 'range', min: 1, max: 30, step: 1, default: 8 },
    { key: 'topDarkness',    kind: 'range', min: 0, max: 100, step: 1, default: 55 },
    { key: 'baseDarkness',   kind: 'range', min: 0, max: 100, step: 1, default: 35 },
    { key: '__gloss__',      kind: 'header', label: 'Gloss' },
    { key: 'glossAlphaTop',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: 'glossExtent',    kind: 'range', min: 5, max: 90, step: 1, default: 50 },
    { key: '__bezel__',      kind: 'header', label: 'Bezel & rim' },
    { key: 'bezelAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.85 },
    { key: 'bezelWidth',     kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
    { key: 'rimAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.35 },
    { key: 'rimWidth',       kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
  ],
};

export const BASE_KEYS = Object.keys(BASES) as BadgeBase[];
export const EFFECT_KEYS = Object.keys(EFFECTS) as BadgeEffect[];

/** A lab color control holds a hex string; the effect it feeds takes a color source. */
export const isColorParam = (type: BadgeEffect, key: string): boolean =>
  EFFECT_LAB_CONTROLS[type].some((c) => c.key === key && c.kind === 'color');

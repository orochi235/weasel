import type { BadgeShape } from './types';

export type ShapeControl =
  | { key: string; kind: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; kind: 'select'; options: string[]; default: string }
  | { key: string; kind: 'color'; default: string }
  | { key: string; kind: 'text'; default: string }
  | { key: string; kind: 'header'; label: string };

export const SHAPE_CONTROLS: Partial<Record<BadgeShape, ShapeControl[]>> = {
  square: [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.16 },
  ],
  hexagon: [
    { key: 'tipHeight', kind: 'range', min: 0, max: 49, step: 1, default: 25 },
    { key: 'tipTruncation', kind: 'range', min: 0, max: 49, step: 1, default: 0 },
  ],
  shield: [
    { key: 'pointDepth', kind: 'range', min: 60, max: 110, step: 1, default: 100 },
    { key: 'shoulderY', kind: 'range', min: 20, max: 80, step: 1, default: 55 },
    { key: 'curveTightness', kind: 'range', min: 0.1, max: 1, step: 0.05, default: 0.7 },
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.33 },
  ],
  scalloped: [
    { key: 'scallopRadius', kind: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'scallopSpacing', kind: 'range', min: 4, max: 30, step: 1, default: 12 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  notched: [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: 'eccentricity', kind: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
  ],
  perforated: [
    { key: 'holeRadius', kind: 'range', min: 1, max: 8, step: 0.5, default: 3.5 },
    { key: 'holePitch', kind: 'range', min: 6, max: 24, step: 1, default: 11 },
  ],
  ribbon: [
    { key: 'left', kind: 'select', options: ['inward', 'outward', 'flat'], default: 'inward' },
    { key: 'right', kind: 'select', options: ['inward', 'outward', 'flat'], default: 'outward' },
    { key: 'taperWidth', kind: 'range', min: 4, max: 30, step: 1, default: 12 },
  ],
  beavis: [
    { key: 'points', kind: 'range', min: 8, max: 96, step: 1, default: 44 },
    { key: 'cornerRadius', kind: 'range', min: 0, max: 30, step: 1, default: 6 },
    { key: 'spikeLen', kind: 'range', min: 0, max: 40, step: 1, default: 12 },
    { key: 'spikeBaseWidth', kind: 'range', min: 0.5, max: 12, step: 0.5, default: 3 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  sparkler: [
    { key: 'points', kind: 'range', min: 4, max: 32, step: 1, default: 16 },
    { key: 'outerR', kind: 'range', min: 50, max: 80, step: 1, default: 58 },
    { key: 'innerR', kind: 'range', min: 30, max: 55, step: 1, default: 50 },
    { key: 'rotation', kind: 'range', min: -45, max: 45, step: 1, default: -5 },
  ],
  starburst: [
    { key: 'points', kind: 'range', min: 4, max: 24, step: 1, default: 12 },
    { key: 'outerR', kind: 'range', min: 30, max: 60, step: 1, default: 48 },
    { key: 'innerR', kind: 'range', min: 15, max: 50, step: 1, default: 36 },
    { key: 'rotation', kind: 'range', min: -45, max: 45, step: 1, default: -7 },
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  postage: [
    { key: 'biteRadius', kind: 'range', min: 1, max: 8, step: 0.5, default: 3 },
    { key: 'biteSpacing', kind: 'range', min: 4, max: 24, step: 0.5, default: 8 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  cloud: [
    { key: 'bumpWidth', kind: 'range', min: 8, max: 50, step: 1, default: 24 },
    { key: 'puffiness', kind: 'range', min: 2, max: 30, step: 1, default: 14 },
    { key: 'padding', kind: 'range', min: 0, max: 40, step: 1, default: 18 },
    { key: 'roundness', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  house: [
    { key: 'eaveY', kind: 'range', min: 5, max: 90, step: 1, default: 32 },
    { key: 'peakHeight', kind: 'range', min: 0, max: 60, step: 1, default: 32 },
    { key: 'roofOverhang', kind: 'range', min: 0, max: 12, step: 1, default: 0 },
  ],
  crest: [
    { key: 'topInset', kind: 'range', min: 0, max: 35, step: 1, default: 12 },
    { key: 'pointDepth', kind: 'range', min: 60, max: 110, step: 1, default: 100 },
  ],
  quatrefoil: [
    { key: '__spike__',       kind: 'header', label: 'Spike' },
    { key: 'spikeR',          kind: 'range', min: 5,   max: 50,   step: 0.5,  default: 50 },
    { key: 'spikeCurvature',  kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'spikeBend',       kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'spikeTipErosion', kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__valley__',      kind: 'header', label: 'Valley' },
    { key: 'valleyR',         kind: 'range', min: 0,   max: 50,   step: 0.5,  default: 25 },
    { key: 'valleyAt',        kind: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5 },
    { key: 'valleySmooth',    kind: 'range', min: 0,   max: 20,   step: 0.25, default: 3 },
    { key: '__lobe__',        kind: 'header', label: 'Lobe' },
    { key: 'lobeR',           kind: 'range', min: 5,   max: 75,   step: 0.5,  default: 42 },
    { key: 'lobeCurvature',   kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'lobeBend',        kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'lobeTipErosion',  kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__advanced__',    kind: 'header', label: 'Advanced' },
    { key: 'rotation',        kind: 'range', min: -45, max: 45,   step: 0.5,  default: 0 },
    { key: 'samples',         kind: 'range', min: 48,  max: 360,  step: 4,    default: 192 },
  ],
  plaque: [
    { key: 'bevelWidth', kind: 'range', min: 0, max: 20, step: 1, default: 6 },
    { key: 'lightFrom', kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
    { key: 'rivetRadius', kind: 'range', min: 0, max: 6, step: 0.2, default: 2.4 },
    { key: 'rivetInset', kind: 'range', min: 3, max: 16, step: 0.5, default: 7 },
  ],
  coffin: [
    { key: 'headX', kind: 'range', min: 0, max: 40, step: 1, default: 6 },
    { key: 'headHalfHeight', kind: 'range', min: 2, max: 50, step: 1, default: 23 },
    { key: 'shoulderX', kind: 'range', min: 5, max: 70, step: 1, default: 33 },
    { key: 'shoulderHalfHeight', kind: 'range', min: 0, max: 45, step: 1, default: 36 },
    { key: 'footX', kind: 'range', min: 50, max: 100, step: 1, default: 100 },
    { key: 'footHalfHeight', kind: 'range', min: 2, max: 50, step: 1, default: 29 },
  ],
  receipt: [
    { key: 'teeth', kind: 'range', min: 4, max: 30, step: 1, default: 11 },
    { key: 'tearDepth', kind: 'range', min: 1, max: 12, step: 0.5, default: 4 },
    { key: 'sideToTopRatio', kind: 'range', min: 0.2, max: 8, step: 0.1, default: 3 },
  ],
};

export function defaultParamsFor(shape: BadgeShape): Record<string, number | string> {
  const controls = SHAPE_CONTROLS[shape] ?? [];
  const init: Record<string, number | string> = {};
  for (const c of controls) {
    if (c.kind === 'header') continue;
    init[c.key] = c.default;
  }
  return init;
}

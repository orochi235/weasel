import type { BadgeBase, BadgeEffect } from '@weasel-js/ui/components/Badge';

export interface LabPreset {
  name: string;
  base: BadgeBase;
  // Widened to allow array-valued params (e.g. polygon `vertices: [[x, y], …]`).
  baseParams: Record<string, number | string | number[][]>;
  effects: { type: BadgeEffect; params: Record<string, number | string> }[];
}

export const LAB_PRESETS: LabPreset[] = [
  {
    name: 'pill',
    base: 'rounded-rect',
    baseParams: { erosion: 1 },
    effects: [],
  },
  {
    name: 'chamfer',
    base: 'chamfered-rect',
    baseParams: { chamfer: 8 },
    effects: [],
  },
  {
    name: 'spiky',
    base: 'rounded-rect',
    baseParams: { erosion: 0.35 },
    effects: [{ type: 'spikes', params: { count: 36, length: 10, baseWidth: 3, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0, cornerCompensation: 1 } }],
  },
  {
    name: 'cloud',
    base: 'rounded-rect',
    baseParams: { erosion: 0.2 },
    effects: [{ type: 'puffs', params: { bumpWidth: 24, puffiness: 14, irregularity: 0 } }],
  },
  {
    name: 'bitten',
    base: 'rounded-rect',
    baseParams: { erosion: 0.5 },
    effects: [{ type: 'bites', params: { biteRadius: 3, biteSpacing: 8, irregularity: 0 } }],
  },
  {
    name: 'scalloped',
    base: 'rounded-rect',
    baseParams: { erosion: 0.16 },
    effects: [{ type: 'scallops', params: { scallopRadius: 4, scallopSpacing: 10, irregularity: 0 } }],
  },
  {
    name: 'sun',
    base: 'rounded-rect',
    baseParams: { erosion: 1 },
    effects: [{ type: 'spikes', params: { count: 16, length: 14, baseWidth: 5, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0, cornerCompensation: 0 } }],
  },
  {
    name: 'rough',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4 },
    effects: [
      { type: 'bites', params: { biteRadius: 2, biteSpacing: 6, irregularity: 0.6 } },
      { type: 'spikes', params: { count: 22, length: 4, baseWidth: 2, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0.5, cornerCompensation: 1 } },
    ],
  },
  // The next eight presets mirror canonical compose configurations from the legacy shape kit
  // (see SHAPES[name].compose() for the equivalent shape spec).
  {
    name: 'plaque',
    base: 'chamfered-rect',
    baseParams: { chamfer: 6 },
    effects: [
      { type: 'bevel',  params: { bevelWidth: 6, lightFrom: 'tl' } },
      { type: 'rivets', params: { radius: 2.4, inset: 7, lightFrom: 'tl' } },
    ],
  },
  {
    name: 'postage',
    base: 'rounded-rect',
    baseParams: { erosion: 0.05 },
    effects: [
      { type: 'perforations', params: { holeRadius: 3, holeSpacing: 11 } },
    ],
  },
  {
    name: 'hexagon',
    base: 'polygon',
    baseParams: { vertices: [[50,0],[100,25],[100,75],[50,100],[0,75],[0,25]] },
    effects: [],
  },
  {
    name: 'house',
    base: 'polygon',
    baseParams: { vertices: [[50,0],[100,32],[100,100],[0,100],[0,32]] },
    effects: [],
  },
  {
    name: 'sunlit',
    base: 'rounded-rect',
    baseParams: { erosion: 0.5 },
    effects: [
      { type: 'sunbeams', params: { count: 3, width: 18, gap: 8, angle: 28, opacity: 0.25, gradientAngle: 90, gradientStart: 0.1, gradientEnd: 0.9 } },
    ],
  },
  {
    name: 'lemon',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4, pinch: 0.6 },
    effects: [],
  },
  {
    name: 'arrow →',
    base: 'polygon',
    baseParams: { vertices: [[0, 0], [85, 0], [100, 50], [85, 100], [0, 100]] },
    effects: [],
  },
  {
    name: 'arrow ←',
    base: 'polygon',
    baseParams: { vertices: [[15, 0], [100, 0], [100, 100], [15, 100], [0, 50]] },
    effects: [],
  },
  {
    name: 'chevron banner',
    base: 'polygon',
    baseParams: { vertices: [[15, 0], [85, 0], [100, 50], [85, 100], [15, 100], [0, 50]] },
    effects: [],
  },
  {
    name: '> sign >',
    base: 'polygon',
    baseParams: { vertices: [[0, 0], [85, 0], [100, 50], [85, 100], [0, 100], [15, 50]] },
    effects: [],
  },
  {
    name: 'quatrefoil',
    base: 'quatrefoil',
    baseParams: { spikeR: 50, lobeR: 42, valleyR: 25, valleyAt: 0.5, spikeCurvature: 1, spikeBend: 0, spikeTipErosion: 0, lobeCurvature: 1, lobeBend: 0, lobeTipErosion: 0, valleySmooth: 3, rotation: 0, samples: 192 },
    effects: [],
  },
  {
    name: 'embossed',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4 },
    effects: [
      { type: 'bevel2', params: { bevelWidth: 6, lightFrom: 315 } },
    ],
  },
];

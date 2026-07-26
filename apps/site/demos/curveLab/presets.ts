import type { SharedAnchor } from '@weasel-js/core';

export interface CurvePreset {
  id: string;
  label: string;
  description: string;
  anchors: SharedAnchor[];
}

export const CURVE_PRESETS: readonly CurvePreset[] = [
  {
    id: 'smooth-s',
    label: 'Smooth S-curve',
    description: '3 anchors, all smooth — baseline; all four representations look similar here.',
    anchors: [
      { x: 60, y: 220 },
      { x: 200, y: 80 },
      { x: 340, y: 220 },
    ],
  },
  {
    id: 'sharp-corner',
    label: 'Sharp corner',
    description: 'Five anchors, one tagged corner. Spiro pins the corner; Bezier smooths through it.',
    anchors: [
      { x: 40, y: 200 },
      { x: 120, y: 200 },
      { x: 200, y: 60, spiroType: 'corner' },
      { x: 280, y: 200 },
      { x: 360, y: 200 },
    ],
  },
  {
    id: 'near-circle',
    label: 'Near-circle (4 anchors at cardinals)',
    description: 'NURBS with weights ≈ 0.707 hits an exact circle. Bezier and Spiro approximate.',
    anchors: [
      { x: 200, y: 60 },
      { x: 340, y: 200 },
      { x: 200, y: 340 },
      { x: 60, y: 200 },
    ],
  },
  {
    id: 'closed-loop',
    label: 'Closed loop (heart-ish)',
    description: 'Open-curve representations close via a straight return; Spiro v1 doesn\'t support true closed.',
    anchors: [
      { x: 200, y: 80 },
      { x: 340, y: 160 },
      { x: 280, y: 300 },
      { x: 200, y: 360 },
      { x: 120, y: 300 },
      { x: 60, y: 160 },
      { x: 200, y: 80 },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed: corner + smooth + weighted',
    description: 'Sampler — every rep\'s discriminators do something visible.',
    anchors: [
      { x: 60, y: 200, spiroType: 'corner' },
      { x: 180, y: 80, weight: 2 },
      { x: 300, y: 200, spiroType: 'g4-smooth' },
      { x: 380, y: 320, weight: 0.5 },
    ],
  },
];

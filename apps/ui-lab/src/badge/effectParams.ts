import { type ConfigShape, f } from '@weasel-js/labkit';
import type { BadgeEffect } from '@weasel-js/ui/components/Badge';
import { head, LIGHT_FROM, num } from './params';

/** Each effect's params, at the defaults a new effect starts from. */
export const EFFECT_PARAMS: Record<BadgeEffect, ConfigShape> = {
  spikes: {
    count: num(44, 4, 96, 1),
    length: num(8, 1, 30, 0.5),
    baseWidth: num(3, 0.5, 12, 0.5),
    vertScale: num(1.4, 0, 3, 0.05),
    horzScale: num(1, 0, 3, 0.05),
    diagonalScale: num(0.5, 0, 3, 0.05),
    irregularity: num(0, 0, 1, 0.05),
  },
  puffs: {
    bumpWidth: num(18, 4, 50, 1),
    puffiness: num(10, 1, 30, 0.5),
    irregularity: num(0, 0, 1, 0.05),
  },
  bites: {
    biteRadius: num(3, 0.5, 8, 0.25),
    biteSpacing: num(8, 2, 24, 0.5),
    irregularity: num(0, 0, 1, 0.05),
  },
  scallops: {
    scallopRadius: num(5, 1, 12, 0.5),
    scallopSpacing: num(12, 4, 30, 1),
    irregularity: num(0, 0, 1, 0.05),
  },
  bevel: {
    bevelWidth: num(6, 0, 20, 0.5),
    lightFrom: f.enum('tl', LIGHT_FROM),
  },
  bevel2: {
    bevelWidth: num(6, 0, 20, 0.5),
    lightFrom: num(315, 0, 360, 1),
  },
  sheen: {
    lightFrom: f.enum('tl', LIGHT_FROM),
    intensity: num(0.22, 0, 0.5, 0.02),
  },
  rivets: {
    radius: num(2.4, 0, 6, 0.2),
    inset: num(7, 3, 16, 0.5),
    lightFrom: f.enum('tl', LIGHT_FROM),
  },
  shadow: {
    dx: num(1, -6, 6, 0.25),
    dy: num(2, -6, 6, 0.25),
    opacity: num(0.28, 0, 1, 0.02),
  },
  woodgrain: {
    lines: num(4, 1, 10, 1),
    knots: num(2, 0, 6, 1),
    intensity: num(0.55, 0, 1, 0.05),
  },
  perforations: {
    holeRadius: num(3, 0.5, 8, 0.25),
    holeSpacing: num(11, 2, 30, 0.5),
  },
  outline: {
    width: num(1, 0, 8, 0.25),
    color: f.color('#7fb069'),
    opacity: num(1, 0, 1, 0.02),
    dash: f.string(''),
    blendMode: f.enum('normal', ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']),
  },
  sunbeams: {
    count: num(3, 1, 8, 1),
    width: num(18, 2, 60, 1),
    gap: num(8, 0, 40, 1),
    angle: num(28, -60, 60, 1),
    opacity: num(0.18, 0, 1, 0.02),
    offset: num(0, -60, 60, 1),
    irregularity: num(0, 0, 1, 0.02),
    gradientAngle: num(90, 0, 360, 1),
    gradientStart: num(0, 0, 1, 0.02),
    gradientEnd: num(1, 0, 1, 0.02),
  },
  aqua: {
    __body__: head('Body'),
    topAlpha: num(0.45, 0, 1, 0.02),
    upperAlpha: num(0.7, 0, 1, 0.02),
    equator: num(52, 15, 85, 1),
    equatorSpread: num(12, 1, 40, 1),
    equatorTint: num(95, 50, 100, 1),
    baseTint: num(70, 20, 100, 1),
    __gloss__: head('Gloss'),
    glossTopAlpha: num(0.7, 0, 1, 0.02),
    glossMidAlpha: num(0.18, 0, 1, 0.02),
    glossExtent: num(50, 5, 90, 1),
    __bezel__: head('Bezel & rim'),
    bezelAlpha: num(0.7, 0, 1, 0.02),
    bezelWidth: num(1, 0, 4, 0.25),
    rimAlpha: num(0.22, 0, 1, 0.02),
    rimWidth: num(1, 0, 4, 0.25),
  },
  metal: {
    specularity: num(0.6, 0, 1, 0.02),
    __body__: head('Body'),
    equator: num(50, 15, 85, 1),
    equatorSpread: num(8, 1, 30, 1),
    topDarkness: num(55, 0, 100, 1),
    baseDarkness: num(35, 0, 100, 1),
    __gloss__: head('Gloss'),
    glossAlphaTop: num(0.55, 0, 1, 0.02),
    glossExtent: num(50, 5, 90, 1),
    __bezel__: head('Bezel & rim'),
    bezelAlpha: num(0.85, 0, 1, 0.02),
    bezelWidth: num(1, 0, 4, 0.25),
    rimAlpha: num(0.35, 0, 1, 0.02),
    rimWidth: num(1, 0, 4, 0.25),
  },};

import { type ConfigShape, f } from '@weasel-js/labkit';
import type { BadgeShape } from '@weasel-js/ui/components/Badge';
import { QUATREFOIL_PARAMS } from './baseParams';
import { LIGHT_FROM, num } from './params';

/** The params of each shape that takes any, at the defaults the shape draws with. */
export const SHAPE_PARAMS: Partial<Record<BadgeShape, ConfigShape>> = {
  square: {
    erosion: num(0.16, 0, 1, 0.02),
  },
  hexagon: {
    tipHeight: num(25, 0, 49, 1),
    tipTruncation: num(0, 0, 49, 1),
  },
  shield: {
    pointDepth: num(100, 60, 110, 1),
    shoulderY: num(55, 20, 80, 1),
    curveTightness: num(0.7, 0.1, 1, 0.05),
    erosion: num(0.33, 0, 1, 0.05),
  },
  scalloped: {
    scallopRadius: num(5, 1, 12, 0.5),
    scallopSpacing: num(12, 4, 30, 1),
    irregularity: num(0, 0, 1, 0.05),
  },
  notched: {
    erosion: num(0.28, 0, 1, 0.02),
    eccentricity: num(1, 0.3, 3, 0.1),
  },
  perforated: {
    holeRadius: num(3.5, 1, 8, 0.5),
    holePitch: num(11, 6, 24, 1),
  },
  ribbon: {
    left: f.enum('inward', ['inward', 'outward', 'flat']),
    right: f.enum('outward', ['inward', 'outward', 'flat']),
    taperWidth: num(12, 4, 30, 1),
  },
  beavis: {
    points: num(44, 8, 96, 1),
    cornerRadius: num(6, 0, 30, 1),
    spikeLen: num(12, 0, 40, 1),
    spikeBaseWidth: num(3, 0.5, 12, 0.5),
    irregularity: num(0, 0, 1, 0.05),
  },
  sparkler: {
    points: num(16, 4, 32, 1),
    outerR: num(58, 50, 80, 1),
    innerR: num(50, 30, 55, 1),
    rotation: num(-5, -45, 45, 1),
  },
  starburst: {
    points: num(12, 4, 24, 1),
    outerR: num(48, 30, 60, 1),
    innerR: num(36, 15, 50, 1),
    rotation: num(-7, -45, 45, 1),
    erosion: num(0, 0, 1, 0.05),
  },
  postage: {
    biteRadius: num(3, 1, 8, 0.5),
    biteSpacing: num(8, 4, 24, 0.5),
    irregularity: num(0, 0, 1, 0.05),
  },
  cloud: {
    bumpWidth: num(24, 8, 50, 1),
    puffiness: num(14, 2, 30, 1),
    padding: num(18, 0, 40, 1),
    roundness: num(0, 0, 1, 0.05),
    irregularity: num(0, 0, 1, 0.05),
  },
  house: {
    eaveY: num(32, 5, 90, 1),
    peakHeight: num(32, 0, 60, 1),
    roofOverhang: num(0, 0, 12, 1),
  },
  crest: {
    topInset: num(12, 0, 35, 1),
    pointDepth: num(100, 60, 110, 1),
  },
  quatrefoil: QUATREFOIL_PARAMS,
  plaque: {
    bevelWidth: num(6, 0, 20, 1),
    lightFrom: f.enum('tl', LIGHT_FROM),
    rivetRadius: num(2.4, 0, 6, 0.2),
    rivetInset: num(7, 3, 16, 0.5),
  },
  coffin: {
    headX: num(6, 0, 40, 1),
    headHalfHeight: num(23, 2, 50, 1),
    shoulderX: num(33, 5, 70, 1),
    shoulderHalfHeight: num(36, 0, 45, 1),
    footX: num(100, 50, 100, 1),
    footHalfHeight: num(29, 2, 50, 1),
  },
  receipt: {
    teeth: num(11, 4, 30, 1),
    tearDepth: num(4, 1, 12, 0.5),
    sideToTopRatio: num(3, 0.2, 8, 0.1),
  },};

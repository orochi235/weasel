import type { BadgeShape, ShapeModule } from '../types';
import Pill from './Pill';
import Square from './Square';
import Notched from './Notched';
import Perforated from './Perforated';
import Diamond from './Diamond';
import Dot from './Dot';
import Hexagon from './Hexagon';
import Chevron from './Chevron';
import Banner from './Banner';

const stub: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export const SHAPES: Record<BadgeShape, ShapeModule> = {
  pill: Pill,
  square: Square,
  notched: Notched,
  perforated: Perforated,
  diamond: Diamond,
  dot: Dot,
  hexagon: Hexagon,
  chevron: Chevron,
  banner: Banner,
  starburst: stub,
  scalloped: stub,
  shield: stub,
  ribbon: stub,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'square', 'notched', 'perforated',
  'diamond', 'dot', 'hexagon', 'chevron', 'banner',
  'starburst', 'scalloped', 'shield', 'ribbon',
];

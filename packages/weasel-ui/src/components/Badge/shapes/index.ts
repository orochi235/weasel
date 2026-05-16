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
import Starburst from './Starburst';
import Scalloped from './Scalloped';
import Shield from './Shield';
import Ribbon from './Ribbon';

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
  starburst: Starburst,
  scalloped: Scalloped,
  shield: Shield,
  ribbon: Ribbon,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'square', 'notched', 'perforated',
  'diamond', 'dot', 'hexagon', 'chevron', 'banner',
  'starburst', 'scalloped', 'shield', 'ribbon',
];

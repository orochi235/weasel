import type { BadgeShape, ShapeModule } from '../types';

const stub: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export const SHAPES: Record<BadgeShape, ShapeModule> = {
  pill: stub,
  square: stub,
  notched: stub,
  perforated: stub,
  diamond: stub,
  dot: stub,
  hexagon: stub,
  chevron: stub,
  banner: stub,
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

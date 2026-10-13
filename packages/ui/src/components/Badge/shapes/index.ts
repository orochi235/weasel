import type { BadgeShape, ShapeModule } from '../types';
import Pill from './Pill';
import Plain from './Plain';
import Square, { type BadgeSquareShapeParams } from './Square';
import Notched, { type BadgeNotchedShapeParams } from './Notched';
import Perforated, { type BadgePerforatedShapeParams } from './Perforated';
import Hexagon, { type BadgeHexagonShapeParams } from './Hexagon';
import Starburst, { type BadgeStarburstShapeParams } from './Starburst';
import Scalloped, { type BadgeScallopedShapeParams } from './Scalloped';
import Shield, { type BadgeShieldShapeParams } from './Shield';
import Ribbon, { type BadgeRibbonShapeParams } from './Ribbon';
import Beavis, { type BadgeBeavisShapeParams } from './Beavis';
import Sparkler, { type BadgeSparklerShapeParams } from './Sparkler';
import Postage, { type BadgePostageShapeParams } from './Postage';
import Cloud, { type BadgeCloudShapeParams } from './Cloud';
import House, { type BadgeHouseShapeParams } from './House';
import Plaque, { type BadgePlaqueShapeParams } from './Plaque';
import Crest, { type BadgeCrestShapeParams } from './Crest';
import Urn from './Urn';
import Coffin, { type BadgeCoffinShapeParams } from './Coffin';
import Receipt, { type BadgeReceiptShapeParams } from './Receipt';
import Wood from './Wood';
import Quatrefoil, { type BadgeQuatrefoilShapeParams } from './Quatrefoil';

/** What `shapeParams` takes, by the `shape` it goes with. */
export interface BadgeShapeParams {
  pill: Record<string, never>;
  plain: Record<string, never>;
  square: BadgeSquareShapeParams;
  notched: BadgeNotchedShapeParams;
  perforated: BadgePerforatedShapeParams;
  hexagon: BadgeHexagonShapeParams;
  starburst: BadgeStarburstShapeParams;
  scalloped: BadgeScallopedShapeParams;
  shield: BadgeShieldShapeParams;
  ribbon: BadgeRibbonShapeParams;
  beavis: BadgeBeavisShapeParams;
  sparkler: BadgeSparklerShapeParams;
  postage: BadgePostageShapeParams;
  cloud: BadgeCloudShapeParams;
  house: BadgeHouseShapeParams;
  plaque: BadgePlaqueShapeParams;
  crest: BadgeCrestShapeParams;
  urn: Record<string, never>;
  coffin: BadgeCoffinShapeParams;
  receipt: BadgeReceiptShapeParams;
  wood: Record<string, never>;
  quatrefoil: BadgeQuatrefoilShapeParams;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ShapeModule's P is contravariant (Component/compose/insets take it), and Badge.tsx indexes this registry by a runtime BadgeShape, so a per-key map type collapses to an unsatisfiable intersection.
export const SHAPES: Record<BadgeShape, ShapeModule<any>> = {
  pill: Pill,
  plain: Plain,
  square: Square,
  notched: Notched,
  perforated: Perforated,
  hexagon: Hexagon,
  starburst: Starburst,
  scalloped: Scalloped,
  shield: Shield,
  ribbon: Ribbon,
  beavis: Beavis,
  sparkler: Sparkler,
  postage: Postage,
  cloud: Cloud,
  house: House,
  plaque: Plaque,
  crest: Crest,
  urn: Urn,
  coffin: Coffin,
  receipt: Receipt,
  wood: Wood,
  quatrefoil: Quatrefoil,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'plain', 'square', 'notched', 'perforated',
  'hexagon',
  'starburst', 'scalloped', 'shield', 'ribbon', 'beavis',
  'sparkler', 'postage', 'cloud', 'house', 'plaque',
  'crest', 'urn', 'coffin', 'receipt', 'wood', 'quatrefoil',
];

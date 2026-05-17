import type { BadgeShape, ShapeModule } from '../types';
import Pill from './Pill';
import Plain from './Plain';
import Square, { type SquareParams } from './Square';
import Notched, { type NotchedParams } from './Notched';
import Perforated, { type PerforatedParams } from './Perforated';
import Hexagon, { type HexagonParams } from './Hexagon';
import Starburst, { type StarburstParams } from './Starburst';
import Scalloped, { type ScallopedParams } from './Scalloped';
import Shield, { type ShieldParams } from './Shield';
import Ribbon, { type RibbonParams } from './Ribbon';
import Beavis, { type BeavisParams } from './Beavis';
import Sparkler, { type SparklerParams } from './Sparkler';
import Postage, { type PostageParams } from './Postage';
import Cloud, { type CloudParams } from './Cloud';
import House, { type HouseParams } from './House';
import Plaque, { type PlaqueParams } from './Plaque';
import Crest, { type CrestParams } from './Crest';
import Urn from './Urn';
import Coffin, { type CoffinParams } from './Coffin';
import Receipt, { type ReceiptParams } from './Receipt';
import Wood from './Wood';

export interface BadgeShapeParams {
  pill: Record<string, never>;
  plain: Record<string, never>;
  square: SquareParams;
  notched: NotchedParams;
  perforated: PerforatedParams;
  hexagon: HexagonParams;
  starburst: StarburstParams;
  scalloped: ScallopedParams;
  shield: ShieldParams;
  ribbon: RibbonParams;
  beavis: BeavisParams;
  sparkler: SparklerParams;
  postage: PostageParams;
  cloud: CloudParams;
  house: HouseParams;
  plaque: PlaqueParams;
  crest: CrestParams;
  urn: Record<string, never>;
  coffin: CoffinParams;
  receipt: ReceiptParams;
  wood: Record<string, never>;
}

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
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'plain', 'square', 'notched', 'perforated',
  'hexagon',
  'starburst', 'scalloped', 'shield', 'ribbon', 'beavis',
  'sparkler', 'postage', 'cloud', 'house', 'plaque',
  'crest', 'urn', 'coffin', 'receipt', 'wood',
];

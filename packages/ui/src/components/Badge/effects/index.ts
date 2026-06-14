import type { EffectModule } from '../bases/types';
import Spikes, { type SpikesEffectParams } from './Spikes';
import Puffs, { type PuffsEffectParams } from './Puffs';
import Bites, { type BitesEffectParams } from './Bites';
import Scallops, { type ScallopsEffectParams } from './Scallops';
import Bevel, { type BevelEffectParams } from './Bevel';
import Sheen, { type SheenEffectParams } from './Sheen';
import Rivets, { type RivetsEffectParams } from './Rivets';
import Shadow, { type ShadowEffectParams } from './Shadow';
import Woodgrain, { type WoodgrainEffectParams } from './Woodgrain';
import Perforations, { type PerforationsEffectParams } from './Perforations';
import Bevel2, { type Bevel2EffectParams } from './Bevel2';
import Outline, { type OutlineEffectParams } from './Outline';
import Sunbeams, { type SunbeamsEffectParams } from './Sunbeams';
import Aqua, { type AquaEffectParams } from './Aqua';
import Metal, { type MetalEffectParams } from './Metal';

export type BadgeEffect =
  | 'spikes' | 'puffs' | 'bites' | 'scallops'
  | 'bevel' | 'bevel2' | 'sheen' | 'sunbeams' | 'rivets' | 'shadow' | 'woodgrain' | 'perforations' | 'outline'
  | 'aqua' | 'metal';

export interface BadgeEffectParams {
  spikes: SpikesEffectParams;
  puffs: PuffsEffectParams;
  bites: BitesEffectParams;
  scallops: ScallopsEffectParams;
  bevel: BevelEffectParams;
  bevel2: Bevel2EffectParams;
  sheen: SheenEffectParams;
  rivets: RivetsEffectParams;
  shadow: ShadowEffectParams;
  woodgrain: WoodgrainEffectParams;
  perforations: PerforationsEffectParams;
  outline: OutlineEffectParams;
  sunbeams: SunbeamsEffectParams;
  aqua: AquaEffectParams;
  metal: MetalEffectParams;
}

export const EFFECTS: Record<BadgeEffect, EffectModule<any>> = {
  spikes: Spikes,
  puffs: Puffs,
  bites: Bites,
  scallops: Scallops,
  bevel: Bevel,
  bevel2: Bevel2,
  sheen: Sheen,
  rivets: Rivets,
  shadow: Shadow,
  woodgrain: Woodgrain,
  perforations: Perforations,
  outline: Outline,
  sunbeams: Sunbeams,
  aqua: Aqua,
  metal: Metal,
};

export interface EffectSpec<E extends BadgeEffect = BadgeEffect> {
  type: E;
  params?: BadgeEffectParams[E];
}

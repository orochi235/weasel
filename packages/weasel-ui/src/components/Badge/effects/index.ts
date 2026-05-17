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

export type BadgeEffect =
  | 'spikes' | 'puffs' | 'bites' | 'scallops'
  | 'bevel' | 'sheen' | 'rivets' | 'shadow' | 'woodgrain';

export interface BadgeEffectParams {
  spikes: SpikesEffectParams;
  puffs: PuffsEffectParams;
  bites: BitesEffectParams;
  scallops: ScallopsEffectParams;
  bevel: BevelEffectParams;
  sheen: SheenEffectParams;
  rivets: RivetsEffectParams;
  shadow: ShadowEffectParams;
  woodgrain: WoodgrainEffectParams;
}

export const EFFECTS: Record<BadgeEffect, EffectModule<any>> = {
  spikes: Spikes,
  puffs: Puffs,
  bites: Bites,
  scallops: Scallops,
  bevel: Bevel,
  sheen: Sheen,
  rivets: Rivets,
  shadow: Shadow,
  woodgrain: Woodgrain,
};

export interface EffectSpec<E extends BadgeEffect = BadgeEffect> {
  type: E;
  params?: BadgeEffectParams[E];
}

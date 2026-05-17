import type { EffectModule } from '../bases/types';
import Spikes, { type SpikesEffectParams } from './Spikes';
import Puffs, { type PuffsEffectParams } from './Puffs';
import Bites, { type BitesEffectParams } from './Bites';

export type BadgeEffect = 'spikes' | 'puffs' | 'bites';

export interface BadgeEffectParams {
  spikes: SpikesEffectParams;
  puffs: PuffsEffectParams;
  bites: BitesEffectParams;
}

export const EFFECTS: Record<BadgeEffect, EffectModule<any>> = {
  spikes: Spikes,
  puffs: Puffs,
  bites: Bites,
};

export interface EffectSpec<E extends BadgeEffect = BadgeEffect> {
  type: E;
  params?: BadgeEffectParams[E];
}

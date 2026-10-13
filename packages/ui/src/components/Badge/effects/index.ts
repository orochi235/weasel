import type { EffectModule } from '../bases/types';
import Spikes, { type BadgeSpikesEffectParams } from './Spikes';
import Puffs, { type BadgePuffsEffectParams } from './Puffs';
import Bites, { type BadgeBitesEffectParams } from './Bites';
import Scallops, { type BadgeScallopsEffectParams } from './Scallops';
import Bevel, { type BadgeBevelEffectParams } from './Bevel';
import Sheen, { type BadgeSheenEffectParams } from './Sheen';
import Rivets, { type BadgeRivetsEffectParams } from './Rivets';
import Shadow, { type BadgeShadowEffectParams } from './Shadow';
import Woodgrain, { type BadgeWoodgrainEffectParams } from './Woodgrain';
import Perforations, { type BadgePerforationsEffectParams } from './Perforations';
import Bevel2, { type BadgeBevel2EffectParams } from './Bevel2';
import Outline, { type BadgeOutlineEffectParams } from './Outline';
import Sunbeams, { type BadgeSunbeamsEffectParams } from './Sunbeams';
import Aqua, { type BadgeAquaEffectParams } from './Aqua';
import Metal, { type BadgeMetalEffectParams } from './Metal';

/** The treatments a composed badge can layer over its base. */
export type BadgeEffect =
  | 'spikes' | 'puffs' | 'bites' | 'scallops'
  | 'bevel' | 'bevel2' | 'sheen' | 'sunbeams' | 'rivets' | 'shadow' | 'woodgrain' | 'perforations' | 'outline'
  | 'aqua' | 'metal';

/** What an effect takes as `params`, by its `type`. */
export interface BadgeEffectParams {
  spikes: BadgeSpikesEffectParams;
  puffs: BadgePuffsEffectParams;
  bites: BadgeBitesEffectParams;
  scallops: BadgeScallopsEffectParams;
  bevel: BadgeBevelEffectParams;
  bevel2: BadgeBevel2EffectParams;
  sheen: BadgeSheenEffectParams;
  rivets: BadgeRivetsEffectParams;
  shadow: BadgeShadowEffectParams;
  woodgrain: BadgeWoodgrainEffectParams;
  perforations: BadgePerforationsEffectParams;
  outline: BadgeOutlineEffectParams;
  sunbeams: BadgeSunbeamsEffectParams;
  aqua: BadgeAquaEffectParams;
  metal: BadgeMetalEffectParams;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- EffectModule's P is contravariant (offsetAt/Component take it), and Badge.tsx indexes this registry by a runtime effect name, so a per-key map type collapses to an unsatisfiable intersection.
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

/** One entry in a badge's `effects`: the effect, and its parameters. */
export interface BadgeEffectSpec<E extends BadgeEffect = BadgeEffect> {
  type: E;
  params?: BadgeEffectParams[E];
}

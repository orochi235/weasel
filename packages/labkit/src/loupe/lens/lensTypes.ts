import type { NodeId, RectPose, Scene } from '@weasel-js/core';
import type { LoupePoint } from '@weasel-js/loupe';
import type { LoupeShape } from '../types';

export type LensAim = 'pinned' | 'follow' | 'glass';
export type LensView = 'swap' | 'split' | 'difference';
export type LensSourceKind = 'live' | 'pixels' | 'revision' | 'reference';
export type LensReadout = 'token' | 'contrast' | 'grid';

/** What a user can change about a lens. `C` is the comparison target, whatever
 *  the host compares against (a revision, a reference image). */
export interface LensSettings<C> {
  aim: LensAim;
  source: LensSourceKind;
  factor: number;
  dprs: readonly number[];
  compare: C | null;
  view: LensView;
  /** Where the split seam sits, 0 to 1 across the lens. */
  seam: number;
  readouts: readonly LensReadout[];
  shape: LoupeShape;
}

export interface LensBodyData<C> extends LensSettings<C> {
  role: 'lens-body';
  lensId: string;
}
export interface LensReticleData {
  role: 'lens-reticle';
  lensId: string;
}
export interface LensLeaderData {
  role: 'lens-leader';
  lensId: string;
}
export type LensNodeData<C> = LensBodyData<C> | LensReticleData | LensLeaderData;

export type LensScene<C> = Scene<LensNodeData<C>, 'lenses', RectPose>;

export interface LensIds {
  lensId: string;
  body: NodeId;
  reticle: NodeId;
  leader: NodeId;
}

export type { LoupePoint };

export const LENS_DEFAULTS: LensSettings<never> = {
  aim: 'pinned',
  source: 'live',
  factor: 4,
  dprs: [1],
  compare: null,
  view: 'swap',
  seam: 0.5,
  readouts: [],
  shape: 'circle',
};

/** Registry key of the reticle's Glass pose: centered on the body it depends on. */
export const GLASS_POSE_KEY = 'labkit:lens-glass';
/** Registry key of the leader's path: body rim to reticle center. */
export const LEADER_PATH_KEY = 'labkit:lens-leader';

export const BODY_SIZE = 160;
export const RETICLE_SIZE = 16;

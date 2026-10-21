import type { NodeId, RectPose, Scene } from '@weasel-js/core';
import type { LoupePoint } from '@weasel-js/loupe';
import type { LoupeShape } from '../types';

/** Where a reticle aims: where it was put, at the pointer, or at the body's own center. */
export type LensAim = 'pinned' | 'follow' | 'glass';
/** How a lens with a comparison shows it. */
export type LensView = 'swap' | 'split' | 'difference';
/** What renders a lens's patch. Revision and reference are reserved for later sources. */
export type LensSourceKind = 'live' | 'pixels' | 'revision' | 'reference';
/** A readout a lens can draw over its interior. */
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

/** A lens body's node data: the lens's settings. */
export interface LensBodyData<C> extends LensSettings<C> {
  role: 'lens-body';
  lensId: string;
}
/** A reticle's node data. */
export interface LensReticleData {
  role: 'lens-reticle';
  lensId: string;
}
/** A leader line's node data. */
export interface LensLeaderData {
  role: 'lens-leader';
  lensId: string;
}
/** The data any node of a lens scene carries. */
export type LensNodeData<C> = LensBodyData<C> | LensReticleData | LensLeaderData;

/** A scene of lenses: each one a body, a reticle and a leader on the `lenses` layer. */
export type LensScene<C> = Scene<LensNodeData<C>, 'lenses', RectPose>;

/** A lens's id and the ids of its three nodes. */
export interface LensIds {
  lensId: string;
  body: NodeId;
  reticle: NodeId;
  leader: NodeId;
}

export type { LoupePoint };

/** A new lens's settings. */
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

/** A new lens body's width and height, in px. */
export const BODY_SIZE = 160;
/** A reticle's width and height, in px. */
export const RETICLE_SIZE = 16;

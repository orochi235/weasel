/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { WorldPoint } from '@weasel-js/routing';
import type { AlignReference } from './align/align';
import type { DistributeMode } from './distribute/distribute';
import type { FlipAxis, FlipPivot } from './flip/helpers';
import type { EditAnchorsParams } from './edit-anchors/params';
import type { SetAnchorFieldParams } from './defaults/anchorFields';

/** `align.*`'s params. */
export type AlignParams = {
  /** The point a reference of `'pointer'` resolves to in place of the pointer dep. */
  world: WorldPoint;
  to: AlignReference;
};
/** `flip`'s params. */
export type FlipParams = {
  /** The point a pivot of `'pointer'` resolves to in place of the pointer dep. */
  world: WorldPoint;
  axis: FlipAxis;
  pivot: FlipPivot;
};
export type DistributeParams = { mode: DistributeMode };
export type ReorderParams = { distance: 'adjacent' | 'extreme' };
export type NudgeParams = { magnitude: 'small' | 'big' };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'align.left': AlignParams;
    'align.centerX': AlignParams;
    'align.right': AlignParams;
    'align.top': AlignParams;
    'align.centerY': AlignParams;
    'align.bottom': AlignParams;
    flip: FlipParams;
    'distribute.horizontal': DistributeParams;
    'distribute.vertical': DistributeParams;
    'reorder.forward': ReorderParams;
    'reorder.backward': ReorderParams;
    'nudge.up': NudgeParams;
    'nudge.down': NudgeParams;
    'nudge.left': NudgeParams;
    'nudge.right': NudgeParams;
    'tool.activate': { toolId: string };
    editAnchors: EditAnchorsParams;
    setAnchorField: SetAnchorFieldParams;
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';

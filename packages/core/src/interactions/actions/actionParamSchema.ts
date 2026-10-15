/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { AlignReference } from './align/align';
import type { DistributeMode } from './distribute/distribute';
import type { FlipAxis, FlipPivot } from './flip/helpers';

/** A point a spatial reference of `'pointer'` resolves to in place of the
 *  pointer dep, when the invocation has one of its own. */
type AtPoint = { worldX: number; worldY: number };

type AlignParams = AtPoint & { to: AlignReference };
type FlipParams = AtPoint & { axis: FlipAxis; pivot: FlipPivot };
type DistributeParams = { mode: DistributeMode };
type ReorderParams = { distance: 'adjacent' | 'extreme' };
type NudgeParams = { magnitude: 'small' | 'big' };

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
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
    setSpiroKind: { kind: import('@weasel-js/geom').SpiroKind };
    'spiro.placePoint': { kind?: import('@weasel-js/geom').SpiroKind };
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';

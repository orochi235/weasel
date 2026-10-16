/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { AlignReference } from './align/align';
import type { DistributeMode } from './distribute/distribute';
import type { FlipAxis, FlipPivot } from './flip/helpers';
import type { EditAnchorsParams } from './edit-anchors/params';
import type { SimplifyBrushParams } from './defaults/simplifyBrush';
import type { WarpKind, WarpSettings } from './warp/warpTargets';

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
    editAnchors: EditAnchorsParams;
    simplifyBrush: SimplifyBrushParams;
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
    'distort.drag': WarpSettings;
    'envelope.drag': WarpSettings;
    'puppet.drag': WarpSettings;
    'puppet.addPin': WarpSettings;
    configureWarp: WarpSettings & { kind?: WarpKind };
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';

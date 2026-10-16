/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { AlignReference } from './align/align';
import type { DistributeMode } from './distribute/distribute';
import type { FlipAxis, FlipPivot } from './flip/helpers';
import type { BendAlongEffect, BlendEffect, RepeatAlongEffect } from 'core/scene/pathEffects/effects';
import type { EditAnchorsParams } from './edit-anchors/params';
import type { SimplifyBrushParams } from './defaults/simplifyBrush';
import type { SmudgeBrushParams } from './pathCommands/smudgeBrush';

/** A point a spatial reference of `'pointer'` resolves to in place of the
 *  pointer dep, when the invocation has one of its own. */
type AtPoint = { worldX: number; worldY: number };

type AlignParams = AtPoint & { to: AlignReference };
type FlipParams = AtPoint & { axis: FlipAxis; pivot: FlipPivot };
type DistributeParams = { mode: DistributeMode };
type ReorderParams = { distance: 'adjacent' | 'extreme' };
type NudgeParams = { magnitude: 'small' | 'big' };
/** A path effect's settings as params; a blend's `reverse` also takes
 *  `'auto'`, handing the direction back to `autoAlign`. */
type SettingsOf<E> = { [K in Exclude<keyof E, 'kind'>]?: E[K] };
type BlendParams = Omit<SettingsOf<BlendEffect>, 'reverse'> & { reverse?: boolean | 'auto' };
type EditPathEffectParams = BlendParams & SettingsOf<BendAlongEffect> & SettingsOf<RepeatAlongEffect>
  & { ids?: readonly string[] };

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
    blend: BlendParams;
    bendAlong: SettingsOf<BendAlongEffect>;
    repeatAlong: SettingsOf<RepeatAlongEffect>;
    editPathEffect: EditPathEffectParams;
    editAnchors: EditAnchorsParams;
    simplifyBrush: SimplifyBrushParams;
    smudgeBrush: SmudgeBrushParams;
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';

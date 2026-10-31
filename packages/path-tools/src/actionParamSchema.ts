/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { CornerShape, PathConstraintKind, SegmentType, SpiroKind } from '@weasel-js/geom';
import type {
  BendAlongEffect, BlendEffect, PathEffect, PuckerBloatEffect, RepeatAlongEffect, RoughenEffect, ZigzagEffect,
} from '@weasel-js/core';
import type { ConstrainAnchorsParams } from './constraints/anchorConstraints';
import type { LengthenPathParams } from './lengthen/lengthenPath';
import type { ResamplePathParams } from './resample/resample';
import type { AddExtremesParams } from './extremes/addExtremes';
import type { SimplifyBrushParams } from './simplifyBrush/simplifyBrush';
import type { SmudgeBrushParams } from './smudge/smudgeBrush';
import type { WarpKind, WarpSettings } from './warp/warpTargets';

/** A path effect's settings as params; a blend's `reverse` also takes
 *  `'auto'`, handing the direction back to `autoAlign`. */
type SettingsOf<E> = { [K in Exclude<keyof E, 'kind'>]?: E[K] };
type BlendParams = Omit<SettingsOf<BlendEffect>, 'reverse'> & { reverse?: boolean | 'auto' };
/** Either field left out keeps that part of each selected corner. */
type SetCornersParams = { shape: CornerShape; radius: number };
type EditPathEffectParams = BlendParams & SettingsOf<BendAlongEffect> & SettingsOf<RepeatAlongEffect>
  & SettingsOf<RoughenEffect> & SettingsOf<ZigzagEffect> & SettingsOf<PuckerBloatEffect>
  & { ids?: readonly string[]; kind?: PathEffect['kind'] };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    blend: BlendParams;
    bendAlong: SettingsOf<BendAlongEffect>;
    repeatAlong: SettingsOf<RepeatAlongEffect>;
    roughen: SettingsOf<RoughenEffect>;
    zigzag: SettingsOf<ZigzagEffect>;
    puckerBloat: SettingsOf<PuckerBloatEffect>;
    editPathEffect: EditPathEffectParams;
    simplifyBrush: SimplifyBrushParams;
    smudgeBrush: SmudgeBrushParams;
    lengthenPath: LengthenPathParams;
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
    setSpiroKind: { kind?: SpiroKind };
    'spiro.placePoint': { kind?: SpiroKind };
    constrainAnchors: ConstrainAnchorsParams;
    unconstrainAnchors: { kind?: PathConstraintKind };
    'distort.drag': WarpSettings;
    'envelope.drag': WarpSettings;
    'puppet.drag': WarpSettings;
    'puppet.addPin': WarpSettings;
    configureWarp: WarpSettings & { kind?: WarpKind };
    convertSegments: { to?: SegmentType };
    convertSegmentAt: { to?: SegmentType };
    selectEveryNthAnchor: { n?: number };
    resamplePath: ResamplePathParams;
    addExtremeAnchors: AddExtremesParams;
    setCorners: SetCornersParams;
  }
}

export type { ActionParamSchema } from '@weasel-js/routing';

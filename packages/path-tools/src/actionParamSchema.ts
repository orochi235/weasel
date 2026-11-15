/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { CornerShape, PathConstraintKind, SegmentType, SpiroKind } from '@weasel-js/geom';
import type {
  BendAlongEffect, TweenEffect, PathEffect, PuckerBloatEffect, RepeatAlongEffect, RoughenEffect, ZigzagEffect,
} from '@weasel-js/core';
import type { ConstrainAnchorsParams } from './constraints/anchorConstraints';
import type { TugPathParams } from './tug/tugPath';
import type { ResamplePathParams } from './resample/resample';
import type { AddExtremesParams } from './extremes/addExtremes';
import type { ReachToMeetParams } from './reach/reachToMeet';
import type { SandParams } from './sand/sand';
import type { KneadParams } from './knead/knead';
import type { WarpKind, WarpSettings } from './warp/warpTargets';

/** A path effect's settings as params: every field but `kind`, each optional. */
export type PathEffectParams<E> = { [K in Exclude<keyof E, 'kind'>]?: E[K] };
/** The `tween` action's params; its `reverse` also takes `'auto'`, handing the direction back to `autoAlign`. */
export type TweenParams = Omit<PathEffectParams<TweenEffect>, 'reverse'> & { reverse?: boolean | 'auto' };
/** The `setFillets` action's params. Either field left out keeps that part of each selected corner. */
export type SetFilletsParams = { shape?: CornerShape; radius?: number };
/** The `editPathEffect` action's params: the effects' settings, and which nodes and effect kind they edit. */
export type EditPathEffectParams = TweenParams & PathEffectParams<BendAlongEffect> & PathEffectParams<RepeatAlongEffect>
  & PathEffectParams<RoughenEffect> & PathEffectParams<ZigzagEffect> & PathEffectParams<PuckerBloatEffect>
  & { ids?: readonly string[]; kind?: PathEffect['kind'] };

declare module '@weasel-js/core' {
  interface ActionParamSchema {
    tween: TweenParams;
    bendAlong: PathEffectParams<BendAlongEffect>;
    repeatAlong: PathEffectParams<RepeatAlongEffect>;
    roughen: PathEffectParams<RoughenEffect>;
    zigzag: PathEffectParams<ZigzagEffect>;
    puckerBloat: PathEffectParams<PuckerBloatEffect>;
    editPathEffect: EditPathEffectParams;
    sand: SandParams;
    knead: KneadParams;
    tugPath: TugPathParams;
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
    setSpiroKind: { kind?: SpiroKind };
    'spiro.placePoint': { kind?: SpiroKind };
    constrainAnchors: ConstrainAnchorsParams;
    unconstrainAnchors: { kind?: PathConstraintKind };
    'plane.drag': WarpSettings;
    'cloth.drag': WarpSettings;
    'pin.drag': WarpSettings;
    'pin.addPin': WarpSettings;
    configureWarp: WarpSettings & { kind?: WarpKind };
    convertSegments: { to?: SegmentType };
    convertSegmentAt: { to?: SegmentType };
    selectEveryNthAnchor: { n?: number };
    resamplePath: ResamplePathParams;
    addExtremeAnchors: AddExtremesParams;
    reachToMeet: ReachToMeetParams;
    setFillets: SetFilletsParams;
    'spiro.finish': { viaDoubleClick?: boolean };
    'girth.drag': { reachPx?: number };
  }
}

export type { ActionParamSchema } from '@weasel-js/core';

/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { CornerShape, PathConstraintKind, SegmentType, SpiroKind } from '@weasel-js/geom';
import type { AffordanceHit, ImmediateParams } from '@weasel-js/routing';
import type { OffsetPathOptions } from '@weasel-js/stroke';
import type {
  BendAlongEffect, TweenEffect, PathEffect, PuckerBloatEffect, RepeatAlongEffect, RoughenEffect, TextAlongEffect, ZigzagEffect,
  FinishPathParams,
} from '@weasel-js/core';
import type { ConstrainAnchorsParams } from './constraints/anchorConstraints';
import type { TugPathParams } from './tug/tugPath';
import type { ResamplePathParams } from './resample/resample';
import type { AddExtremesParams } from './extremes/addExtremes';
import type { ReachToMeetParams } from './reach/reachToMeet';
import type { SandParams } from './sand/sand';
import type { KneadParams } from './knead/knead';
import type { ConfigureWarpParams, WarpSettings } from './warp/warpTargets';
import type { StrokePressParams } from './shared/scenePaths';
import type { GirthDragParams } from './girth/girthActions';
import type { LinkAnchorParams } from './constraints/linkAnchor';
import type { EditFilletParams } from './fillet/editFillet';
import type { CycleFilletParams } from './fillet/filletCommands';

/** A path effect's settings as params: every field but `kind`, each optional. */
export type PathEffectParams<E> = { [K in Exclude<keyof E, 'kind'>]?: E[K] };
/** The `tween` action's params; its `reverse` also takes `'auto'`, handing the direction back to `autoAlign`. */
export type TweenParams = Omit<PathEffectParams<TweenEffect>, 'reverse'> & { reverse?: boolean | 'auto' };
/** The `setFillets` action's params. Either field left out keeps that part of each selected corner. */
export type SetFilletsParams = { shape?: CornerShape; radius?: number };
/** The `editPathEffect` action's params: the effects' settings, and which nodes and effect kind they edit. */
export type EditPathEffectParams = TweenParams & PathEffectParams<BendAlongEffect> & PathEffectParams<RepeatAlongEffect>
  & PathEffectParams<TextAlongEffect> & PathEffectParams<RoughenEffect> & PathEffectParams<ZigzagEffect>
  & PathEffectParams<PuckerBloatEffect> & { ids?: readonly string[]; kind?: PathEffect['kind'] };

/** `offsetPath`'s params: how far to grow each outline (a negative distance shrinks it), and how its corners join. */
export type OffsetPathParams = { distance?: number; join?: OffsetPathOptions['join']; miterLimit?: number };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'pen.finishOpen': FinishPathParams;
    'pen.placeAnchor': Pick<ImmediateParams, 'press' | 'mods'>;
    'slice.finish': FinishPathParams;
    'slice.addPoint': Pick<ImmediateParams, 'press'>;
    slice: { cut?: 'freehand' };
    selectAnchor: { additive?: boolean } & Pick<ImmediateParams, 'world'>;
    cutPathAtAnchor: Pick<ImmediateParams, 'world'>;
    insertPathAnchor: Pick<ImmediateParams, 'world'>;
    enterPathEdit: Pick<ImmediateParams, 'world'>;
    simplifyPath: { tolerance?: number };
    offsetPath: OffsetPathParams;
    tween: TweenParams;
    bendAlong: PathEffectParams<BendAlongEffect>;
    repeatAlong: PathEffectParams<RepeatAlongEffect>;
    textAlong: PathEffectParams<TextAlongEffect>;
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
    'spiro.placePoint': { kind?: SpiroKind } & Pick<ImmediateParams, 'press' | 'mods'>;
    constrainAnchors: ConstrainAnchorsParams;
    linkAnchor: LinkAnchorParams;
    unconstrainAnchors: { kind?: PathConstraintKind };
    'plane.drag': WarpSettings;
    'cloth.drag': WarpSettings;
    'pin.drag': WarpSettings;
    'pin.addPin': WarpSettings & Pick<ImmediateParams, 'press' | 'world'>;
    configureWarp: ConfigureWarpParams;
    convertSegments: { to?: SegmentType };
    convertSegmentAt: { to?: SegmentType } & Pick<ImmediateParams, 'world'>;
    selectEveryNthAnchor: { n?: number };
    resamplePath: ResamplePathParams;
    addExtremeAnchors: AddExtremesParams;
    reachToMeet: ReachToMeetParams;
    setFillets: SetFilletsParams;
    editFillet: EditFilletParams;
    cycleFillet: CycleFilletParams;
    'spiro.finish': { viaDoubleClick?: boolean };
    'girth.drag': GirthDragParams;
    'girth.clear': Pick<ImmediateParams, 'press'>;
    'girth.hover': Pick<ImmediateParams, 'world'>;
    snipPath: StrokePressParams;
    'snip.preview': StrokePressParams;
    'shapeBuilder.hover': Pick<ImmediateParams, 'world' | 'mods'>;
    'shapeBuilder.click': Pick<ImmediateParams, 'press' | 'mods'>;
    equalizeHandles: { affordance?: AffordanceHit };
  }
}

export type { ActionParamSchema } from '@weasel-js/routing';

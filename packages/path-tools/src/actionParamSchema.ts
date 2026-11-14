/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { CornerShape, PathConstraintKind, SegmentType, SpiroKind } from '@weasel-js/geom';
import type {
  BendAlongEffect, BlendEffect, PathEffect, PuckerBloatEffect, RepeatAlongEffect, RoughenEffect, ZigzagEffect,
} from '@weasel-js/core';
import type { ConstrainAnchorsParams } from './constraints/anchorConstraints';
import type { TugPathParams } from './tug/tugPath';
import type { ResamplePathParams } from './resample/resample';
import type { AddExtremesParams } from './extremes/addExtremes';
import type { ReachToMeetParams } from './reach/reachToMeet';
import type { SandParams } from './sand/sand';
import type { KneadParams } from './knead/knead';
import type { WarpKind, WarpSettings } from './warp/warpTargets';

/** A path effect's settings as params; a blend's `reverse` also takes
 *  `'auto'`, handing the direction back to `autoAlign`. */
type SettingsOf<E> = { [K in Exclude<keyof E, 'kind'>]?: E[K] };
type BlendParams = Omit<SettingsOf<BlendEffect>, 'reverse'> & { reverse?: boolean | 'auto' };
/** Either field left out keeps that part of each selected corner. */
type SetFilletsParams = { shape: CornerShape; radius: number };
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
    sand: SandParams;
    knead: KneadParams;
    tugPath: TugPathParams;
    bridgePaths: { tension?: number };
    bridgeAnchors: { tension?: number };
    setSpiroKind: { kind?: SpiroKind };
    'spiro.placePoint': { kind?: SpiroKind };
    constrainAnchors: ConstrainAnchorsParams;
    unconstrainAnchors: { kind?: PathConstraintKind };
    'distort.drag': WarpSettings;
    'cloth.drag': WarpSettings;
    'puppet.drag': WarpSettings;
    'puppet.addPin': WarpSettings;
    configureWarp: WarpSettings & { kind?: WarpKind };
    convertSegments: { to?: SegmentType };
    convertSegmentAt: { to?: SegmentType };
    selectEveryNthAnchor: { n?: number };
    resamplePath: ResamplePathParams;
    addExtremeAnchors: AddExtremesParams;
    reachToMeet: ReachToMeetParams;
    setFillets: SetFilletsParams;
  }
}

export type { ActionParamSchema } from '@weasel-js/routing';

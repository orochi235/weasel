/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so their bindings, triggers, and tunings are typed.
 */
import type { ImmediateParams } from '@weasel-js/core';
import type { SeqParticipantKind } from './sequence/author';
import type { SeqArrow, SeqArrowName } from './sequence/authorSteps';
import type { SeqFragment, SeqMark } from './sequence/types';

/** A click's point and the affordance it pressed. */
type PressAt = Pick<ImmediateParams, 'world' | 'affordance'>;
/** A click's affordance and the modifiers held. */
type PressWithMods = Pick<ImmediateParams, 'affordance' | 'mods'>;
/** A click's point. */
type ClickAt = Pick<ImmediateParams, 'world'>;

/** The `diagram.sequence.drawMessage` action's params: the arrow it draws, a name in `SEQ_ARROWS` or one of its own. */
export type DrawMessageParams = { arrow?: SeqArrowName | SeqArrow };
/** The `diagram.sequence.wrapFragment` action's params: the fragment's type, `loop` by default. */
export type WrapFragmentParams = { type?: SeqFragment['type'] };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'diagram.selectLabelEdge': PressWithMods;
    'diagram.editEdgeLabel': PressAt;
    'diagram.removeWaypoint': PressAt;
    'diagram.addLane': PressAt;
    'diagram.editContainerTitle': ClickAt;
    'diagram.followOffPage': ClickAt;
    'effect.renameGroup': ClickAt;
    'diagram.sequence.select': PressWithMods;
    'diagram.sequence.drawMessage': DrawMessageParams;
    'diagram.sequence.wrapFragment': WrapFragmentParams;
    'diagram.sequence.addParticipant': ClickAt & { kind?: SeqParticipantKind };
    'diagram.sequence.addNote': ClickAt;
    'diagram.sequence.addMark': ClickAt & { mark?: SeqMark['kind'] };
  }
}

/**
 * The sequence authoring tools: each a declarative shell binding a click or a
 * drag to the action that owns the edit. Every binding comes twice, once
 * plain and once on the sequence layer's regions, since a press on a head,
 * message, or note is claimed by that layer and reaches only bindings that
 * name it.
 */
import { defineTool, toolSet, useLatest, type BindingOpts, type GestureBinding, type Tool, type ToolSet } from '@weasel-js/core';
import { useMemo } from 'react';
import { icon } from '../icons.gen';
import { createAddNoteAction, createAddParticipantAction, ADD_NOTE_ACTION_ID, ADD_PARTICIPANT_ACTION_ID, type SequenceAuthorOptions } from './authorActions';
import {
  createDrawMessageAction, createDrawNoteAction, createWrapFragmentAction, DRAW_MESSAGE_ACTION_ID, DRAW_NOTE_ACTION_ID,
  WRAP_FRAGMENT_ACTION_ID,
} from './authorDrags';
import type { SeqParticipantKind } from './author';
import type { SeqArrow, SeqArrowName } from './authorSteps';
import { SEQUENCE_AFFORDANCE_KIND } from './layer';
import type { SeqFragment } from './types';

/** The ids `useSequenceTools` keys its tools by. */
export type SequenceToolId = 'diagram.sequence.participant' | 'diagram.sequence.message' | 'diagram.sequence.note' | 'diagram.sequence.fragment';

/** The sequence authoring tools: lifelines, messages, notes, and fragments. */
export const SEQUENCE_TOOLS: ToolSet<SequenceToolId> = toolSet('sequence', [
  'diagram.sequence.participant', 'diagram.sequence.message', 'diagram.sequence.note', 'diagram.sequence.fragment',
]);

/** Options for {@link sequenceTools} and {@link useSequenceTools}. */
export interface SequenceToolsOptions extends SequenceAuthorOptions {
  /** What the Participant tool adds, read at each click. Default a plain participant. */
  participant?: () => SeqParticipantKind;
  /** The arrow the Message tool draws, read as each drag moves. Default `'sync'`. */
  arrow?: () => SeqArrowName | SeqArrow;
  /** The type the Fragment tool wraps rows in, read as each drag moves. Default `'loop'`. */
  fragment?: () => SeqFragment['type'];
}

const ON_SEQUENCE = `affordance:${SEQUENCE_AFFORDANCE_KIND}` as const;

/** `kind` bound to `actionId`, plain and on the sequence layer. */
function both(tool: string, kind: 'click' | 'drag', actionId: string, params?: BindingOpts['params']): GestureBinding[] {
  const at = (id: string) => ({ id: `${tool}.${id}`, ...(params ? { params } : {}) });
  return [
    { spec: { kind }, actionId, opts: at(kind) },
    { spec: { kind, target: ON_SEQUENCE }, actionId, opts: at(`${kind}.onSequence`) },
  ];
}

/**
 * Every tool in {@link SEQUENCE_TOOLS}, keyed by id, for `<SceneCanvas tools>`:
 * Participant clicks a lifeline in where the click falls (or starts a sequence
 * on empty canvas), Message drags from one lifeline to another at the row of
 * the press, Note clicks or drags across lifelines, and Fragment drags across
 * rows to wrap them. Each commits one undo entry through `commit`.
 */
export function sequenceTools(opts: SequenceToolsOptions = {}): Record<SequenceToolId, Tool> {
  const participant = 'diagram.sequence.participant';
  const message = 'diagram.sequence.message';
  const note = 'diagram.sequence.note';
  const fragment = 'diagram.sequence.fragment';
  return {
    [participant]: defineTool({
      id: participant, hookName: 'useSequenceTools', cursor: 'copy',
      presentation: { label: 'Participant', icon: icon('umlActor'), group: 'sequence' },
      actions: [createAddParticipantAction(opts)],
      bindings: both(participant, 'click', ADD_PARTICIPANT_ACTION_ID, () => ({ kind: opts.participant?.() ?? 'participant' })),
    }),
    [message]: defineTool({
      id: message, hookName: 'useSequenceTools', cursor: 'crosshair',
      presentation: { label: 'Message', icon: icon('core:arrow'), group: 'sequence' },
      actions: [createDrawMessageAction(opts)],
      bindings: both(message, 'drag', DRAW_MESSAGE_ACTION_ID, () => ({ arrow: opts.arrow?.() ?? 'sync' })),
    }),
    [note]: defineTool({
      id: note, hookName: 'useSequenceTools', cursor: 'copy',
      presentation: { label: 'Note', icon: icon('umlNote'), group: 'sequence' },
      actions: [createAddNoteAction(opts), createDrawNoteAction(opts)],
      bindings: [...both(note, 'click', ADD_NOTE_ACTION_ID), ...both(note, 'drag', DRAW_NOTE_ACTION_ID)],
    }),
    [fragment]: defineTool({
      id: fragment, hookName: 'useSequenceTools', cursor: 'crosshair',
      presentation: { label: 'Fragment', icon: icon('container'), group: 'sequence' },
      actions: [createWrapFragmentAction(opts)],
      bindings: both(fragment, 'drag', WRAP_FRAGMENT_ACTION_ID, () => ({ type: opts.fragment?.() ?? 'loop' })),
    }),
  } as Record<SequenceToolId, Tool>;
}

/**
 * {@link sequenceTools}, built once per change of what draws an edit. The
 * commit and the participant, arrow, and fragment readers are read through a
 * ref, so a host can pass fresh closures every render.
 */
export function useSequenceTools(opts: SequenceToolsOptions = {}): Record<SequenceToolId, Tool> {
  const latest = useLatest(opts);
  const { measure, theme } = opts;
  const custom = opts.commit !== undefined;
  const starts = opts.start === undefined ? 'default' : opts.start === null ? 'none' : 'own';
  return useMemo(() => sequenceTools({
    ...(measure ? { measure } : {}), ...(theme ? { theme } : {}),
    ...(custom ? { commit: (edit, ctx) => latest.current.commit?.(edit, ctx) } : {}),
    ...(starts === 'none' ? { start: null } : starts === 'own' ? { start: (at, data, deps) => latest.current.start?.(at, data, deps) } : {}),
    participant: () => latest.current.participant?.() ?? 'participant',
    arrow: () => latest.current.arrow?.() ?? 'sync',
    fragment: () => latest.current.fragment?.() ?? 'loop',
  }), [latest, measure, theme, custom, starts]);
}

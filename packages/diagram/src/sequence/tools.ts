/**
 * The sequence authoring tools: each a declarative shell binding a click or a
 * drag to the action that owns the edit. Every binding comes twice, once
 * plain and once on the sequence layer's regions, since a press on a head,
 * message, or note is claimed by that layer and reaches only bindings that
 * name it.
 */
import { defineTool, toolSet, useLatest, type GestureBinding, type Tool, type ToolSet } from '@weasel-js/core';
import { useMemo } from 'react';
import { icon } from '../icons.gen';
import {
  createAddMarkAction, createAddNoteAction, createAddParticipantAction, ADD_MARK_ACTION_ID, ADD_NOTE_ACTION_ID, ADD_PARTICIPANT_ACTION_ID,
  type SequenceAuthorOptions,
} from './authorActions';
import {
  createDrawMessageAction, createDrawNoteAction, createWrapFragmentAction, DRAW_MESSAGE_ACTION_ID, DRAW_NOTE_ACTION_ID,
  WRAP_FRAGMENT_ACTION_ID,
} from './authorDrags';
import { SEQUENCE_AFFORDANCE_KIND } from './layer';
import { SEQUENCE_FRAGMENT_OPTIONS, SEQUENCE_MARK_OPTIONS, SEQUENCE_MESSAGE_OPTIONS, SEQUENCE_PARTICIPANT_OPTIONS } from './toolOptions';

/** The ids `useSequenceTools` keys its tools by. */
export type SequenceToolId =
  | 'diagram.sequence.participant' | 'diagram.sequence.message' | 'diagram.sequence.note' | 'diagram.sequence.fragment'
  | 'diagram.sequence.mark';

/** The sequence authoring tools: lifelines, messages, notes, fragments, and lifeline marks. */
export const SEQUENCE_TOOLS: ToolSet<SequenceToolId> = toolSet('sequence', [
  'diagram.sequence.participant', 'diagram.sequence.message', 'diagram.sequence.note', 'diagram.sequence.fragment',
  'diagram.sequence.mark',
], { label: 'Sequence' });

/** Options for {@link sequenceTools} and {@link useSequenceTools}. What each tool adds is its options
 *  (`SEQUENCE_PARTICIPANT_OPTIONS` and the rest), which a host keeps in the `toolOptionValues` dep. */
export type SequenceToolsOptions = SequenceAuthorOptions;

const ON_SEQUENCE = `affordance:${SEQUENCE_AFFORDANCE_KIND}` as const;

/** `kind` bound to `actionId`, plain and on the sequence layer. */
function both(tool: string, kind: 'click' | 'drag', actionId: string): GestureBinding[] {
  const at = (id: string) => ({ id: `${tool}.${id}` });
  return [
    { spec: { kind }, actionId, opts: at(kind) },
    { spec: { kind, target: ON_SEQUENCE }, actionId, opts: at(`${kind}.onSequence`) },
  ];
}

/**
 * Every tool in {@link SEQUENCE_TOOLS}, keyed by id, for `<SceneCanvas tools>`:
 * Participant clicks a lifeline in where the click falls (or starts a sequence
 * on empty canvas), Message drags from one lifeline to another at the row of
 * the press, Note clicks or drags across lifelines, Fragment drags across
 * rows to wrap them, and Mark clicks an activation's start or end, a
 * creation, or a destruction onto a lifeline. Each commits one undo entry
 * through `commit`. What the Participant, Message, Fragment, and Mark tools add
 * is their options, the same form as their actions' last-operation panel.
 */
export function sequenceTools(opts: SequenceToolsOptions = {}): Record<SequenceToolId, Tool> {
  const participant = 'diagram.sequence.participant';
  const message = 'diagram.sequence.message';
  const note = 'diagram.sequence.note';
  const fragment = 'diagram.sequence.fragment';
  const mark = 'diagram.sequence.mark';
  return {
    [participant]: defineTool({
      id: participant, hookName: 'useSequenceTools', cursor: 'copy',
      presentation: { label: 'Participant', icon: icon('umlActor'), group: 'sequence' },
      actions: [createAddParticipantAction(opts)],
      options: SEQUENCE_PARTICIPANT_OPTIONS,
      bindings: both(participant, 'click', ADD_PARTICIPANT_ACTION_ID),
    }),
    [message]: defineTool({
      id: message, hookName: 'useSequenceTools', cursor: 'crosshair',
      presentation: { label: 'Message', icon: icon('core:arrow'), group: 'sequence' },
      actions: [createDrawMessageAction(opts)],
      options: SEQUENCE_MESSAGE_OPTIONS,
      bindings: both(message, 'drag', DRAW_MESSAGE_ACTION_ID),
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
      options: SEQUENCE_FRAGMENT_OPTIONS,
      bindings: both(fragment, 'drag', WRAP_FRAGMENT_ACTION_ID),
    }),
    [mark]: defineTool({
      id: mark, hookName: 'useSequenceTools', cursor: 'copy',
      presentation: { label: 'Mark', icon: icon('task'), group: 'sequence' },
      actions: [createAddMarkAction(opts)],
      options: SEQUENCE_MARK_OPTIONS,
      bindings: both(mark, 'click', ADD_MARK_ACTION_ID),
    }),
  } as Record<SequenceToolId, Tool>;
}

/**
 * {@link sequenceTools}, built once per change of what draws an edit. The
 * commit and `start` are read through a ref, so a host can pass fresh closures
 * every render.
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
  }), [latest, measure, theme, custom, starts]);
}

/**
 * A sequence diagram as plain data: participants left to right, and the steps
 * between them top to bottom, one row each.
 */
import type { NodeStyle } from '../dataTypes';
import type { Outline } from '../outline';

/** One column: a head drawn at the top, and the lifeline under it. */
export interface SeqParticipant {
  /** Messages, notes, and boxes name it by this. */
  id: string;
  /** What its head says. Default its id. */
  label?: string;
  /** Default `'rect'`. `actor`, `boundary`, `control`, `entity`, `cylinder`, `collections`, and `queue` are the UML figures. */
  outline?: Outline;
  /** The theme role its head is drawn in. */
  style?: string;
  /** Colors of its own, over its role's. */
  colors?: Partial<NodeStyle>;
}

/** A message from one lifeline to another, or to itself. */
export interface SeqMessage {
  kind: 'message';
  id: string;
  from: string;
  to: string;
  text?: string;
  line: 'solid' | 'dashed';
  head: 'arrow' | 'open' | 'cross' | 'none';
  /** An arrowhead at the `from` end too. */
  both?: boolean;
  /** Sent without waiting for an answer. */
  async?: boolean;
  /** Starts an activation on that end, at this message. */
  activate?: 'to' | 'from';
  /** Ends the innermost activation on that end, at this message. */
  deactivate?: 'to' | 'from';
}

/** A note beside one lifeline, or over one or more. */
export interface SeqNote {
  kind: 'note';
  id: string;
  /** Participant ids. Over two, it spans from the first to the last. */
  over: readonly string[];
  /** Beside its participant rather than over it. */
  side?: 'left' | 'right';
  text: string;
}

/** A lifeline's activation starting or ending, its head created, or its lifeline ended. */
export interface SeqMark {
  kind: 'activate' | 'deactivate' | 'create' | 'destroy';
  participant: string;
}

/** A run of steps boxed together: a loop, the branches of an alt, the threads of a par. */
export interface SeqFragment {
  kind: 'fragment';
  id: string;
  /** `region` is a plain colored box, with no type tab. */
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'region';
  /** One for most types; an `alt`'s branches, a `par`'s threads, a `critical`'s options each start another. */
  sections: readonly SeqSection[];
  colors?: Partial<NodeStyle>;
}

/** One section of a fragment: its guard or title, and its steps. */
export interface SeqSection {
  label?: string;
  steps: readonly SeqStep[];
}

/** One row of a sequence, or a fragment holding a run of rows. */
export type SeqStep = SeqMessage | SeqNote | SeqMark | SeqFragment;

/** A box drawn around some participants' columns. */
export interface SeqBox {
  id: string;
  label?: string;
  /** Participant ids. */
  members: readonly string[];
  colors?: Partial<NodeStyle>;
}

/** A sequence diagram, the data `sequenceSpecs` draws. */
export interface SequenceData {
  participants: readonly SeqParticipant[];
  /** Top to bottom, one row each; a fragment holds a run. */
  steps: readonly SeqStep[];
  boxes?: readonly SeqBox[];
  /** Messages are numbered from this one. Unset, they are not numbered. */
  autonumber?: number;
}

/** A step with an id of its own: a message, a note, or a fragment. */
export type SeqIdStep = SeqMessage | SeqNote | SeqFragment;

/** Where a step stands: the list it is in (`null` the top level, else a fragment's section), and its place in it. */
export interface StepPlace {
  parent: { fragment: string; section: number } | null;
  index: number;
}

/** A run of text in a sequence an edit can set: a head's, a message's or note's, a fragment section's label, or a box's. */
export type SeqTextTarget =
  | { participant: string }
  | { step: string }
  | { fragment: string; section: number }
  | { box: string };

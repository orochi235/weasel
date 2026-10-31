/**
 * What a sequence's scene nodes carry under `data.diagram`: the root holds the
 * whole `SequenceData`, and every part drawn from it names its root and what
 * it draws.
 */
import type { SeqMessagePlace, SeqRect, SeqSlot } from './layout';
import type { SeqMarkRef, SeqTextTarget, SequenceData } from './types';

/** Where a root's parts stand, in its own frame: what a drag reads to place a drop without laying the data out again. */
export interface SequenceGeometry {
  columns: readonly { id: string; x: number }[];
  slots: readonly SeqSlot[];
  heads: readonly { id: string; box: SeqRect }[];
  messages: readonly SeqMessagePlace[];
  notes: readonly { id: string; box: SeqRect }[];
  /** Where a fragment is taken hold of: its type tab, or a region's top edge. Absent on a root drawn before fragments could be. */
  fragments?: readonly { id: string; grip: SeqRect }[];
  /** Where a box is taken hold of: the strip above its heads that holds its label. Absent as for `fragments`. */
  boxes?: readonly { id: string; grip: SeqRect }[];
  /** Where a part drawn for lifeline marks is taken hold of, by the part's id under the root: an activation bar, a
   *  destruction's cross. Absent as for `fragments`. */
  marks?: readonly { id: string; grip: SeqRect }[];
}

/** The trait on a sequence's root. */
export interface SequenceRootTrait {
  sequence: SequenceData;
  geometry: SequenceGeometry;
}

/** What a part draws. */
export type SeqPartKind =
  | 'head' | 'lifeline' | 'destroy' | 'message' | 'activation' | 'note' | 'fragment' | 'divider' | 'box' | 'number' | 'text';

/** The trait on a part of a sequence: its root, what it draws, and for text, what an edit of it sets. */
export interface SeqPartTrait {
  root: string;
  part: SeqPartKind;
  /** The participant or step it draws. */
  id?: string;
  /** For text an edit can set. */
  target?: SeqTextTarget;
  /** For an activation bar or a destruction's cross: the marks and message flags that draw it, which deleting it removes. */
  marks?: readonly SeqMarkRef[];
}

const traitOf = (node: { data: unknown }): Record<string, unknown> | null => {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>).diagram;
  return trait !== null && typeof trait === 'object' ? (trait as Record<string, unknown>) : null;
};

/** The sequence a root node holds, or `null` for any other node. */
export function sequenceRootOf(node: { data: unknown }): SequenceRootTrait | null {
  const trait = traitOf(node);
  return trait !== null && 'sequence' in trait && 'geometry' in trait ? (trait as unknown as SequenceRootTrait) : null;
}

/** The part trait a node drawn for a sequence carries, or `null`. */
export function sequencePartOf(node: { data: unknown }): SeqPartTrait | null {
  const seq = traitOf(node)?.seq;
  return seq !== null && typeof seq === 'object' && typeof (seq as SeqPartTrait).root === 'string' ? (seq as SeqPartTrait) : null;
}

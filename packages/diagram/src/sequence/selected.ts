/**
 * What a selection names in a sequence: the root it is in, and the
 * participants, messages, notes, fragments, and boxes its parts draw. What a
 * host's panel reads to offer the edits that apply to a selection.
 */
import type { Scene } from '@weasel-js/core';
import { sequencePartOf, sequenceRootOf } from './trait';
import type { SequenceData } from './types';

type AnyScene = Scene<unknown, string, unknown>;

/** A selection read as one sequence's parts. Each list is in selection order, without repeats. */
export interface SequenceSelection {
  /** The root's id. */
  root: string;
  data: SequenceData;
  participants: string[];
  messages: string[];
  notes: string[];
  fragments: string[];
  boxes: string[];
}

const LIST_OF = {
  head: 'participants', lifeline: 'participants', message: 'messages', note: 'notes', fragment: 'fragments', divider: 'fragments',
  box: 'boxes',
} as const;

/**
 * The sequence `ids` select in: the root of the first sequence part among
 * them, or a selected root, else the scene's only sequence (with nothing
 * selected in it), else `null`. Parts of any other root are left out.
 */
export function sequenceSelectionOf(scene: AnyScene, ids: readonly string[]): SequenceSelection | null {
  let root: string | null = null;
  for (const id of ids) {
    const node = scene.get(id as never);
    if (node === undefined) continue;
    const part = sequencePartOf(node);
    if (part !== null) root = part.root;
    else if (sequenceRootOf(node) !== null) root = id;
    if (root !== null) break;
  }
  if (root === null) {
    const all = scene.renderOrderNodes().filter((n) => sequenceRootOf(n) !== null);
    if (all.length !== 1) return null;
    root = all[0]!.id;
  }
  const held = sequenceRootOf(scene.get(root as never)!);
  if (held === null) return null;
  const out: SequenceSelection = { root, data: held.sequence, participants: [], messages: [], notes: [], fragments: [], boxes: [] };
  for (const id of ids) {
    const node = scene.get(id as never);
    const part = node === undefined ? null : sequencePartOf(node);
    if (part === null || part.root !== root || part.id === undefined) continue;
    const list = LIST_OF[part.part as keyof typeof LIST_OF];
    if (list !== undefined && !out[list].includes(part.id)) out[list].push(part.id);
  }
  return out;
}

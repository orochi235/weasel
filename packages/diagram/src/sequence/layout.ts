/**
 * `sequenceLayout` — where every part of a sequence diagram stands, in the
 * diagram's own frame (its top-left at the origin). Pure geometry: the specs
 * draw it, the editing reads it back to place a drop.
 */
import type { MeasureRowText } from '../body';
import { columnsOf } from './columns';
import { SEQ, seqMeasure, type SeqRect } from './metrics';
import { walkRows } from './rows';
import type { SeqFragment, SeqMarkRef, SequenceData, StepPlace } from './types';

export type { SeqRect };

/** Options for {@link sequenceLayout}. */
export interface SequenceLayoutOptions {
  /** Measures text. Default an estimate from character count. */
  measure?: MeasureRowText;
  /** The face text is set in. Default 12px sans-serif. */
  font?: { fontFamily: string; fontSize: number };
}

/** A head: at the top, or at its `create` row. */
export interface SeqHeadPlace { id: string; box: SeqRect; created: boolean }
/** A lifeline, from under its head to the foot, or to where it was destroyed: by the `destroy` mark at `destroyedBy`. */
export interface SeqLifelinePlace { id: string; x: number; y0: number; y1: number; destroyed: boolean; destroyedBy?: StepPlace }
/** A message's line from `x1` (its `from` end) to `x2`, at `y`; a self-message loops down to `loopY`. */
export interface SeqMessagePlace {
  id: string; y: number; x1: number; x2: number; loopY?: number; text?: SeqRect; number?: { n: number; box: SeqRect };
}
/** An activation bar, with what opened it and what closed it; one the diagram's end closed has no `closer`. */
export interface SeqActivationPlace { participant: string; depth: number; box: SeqRect; opener: SeqMarkRef; closer?: SeqMarkRef }
export interface SeqNotePlace { id: string; box: SeqRect }
/** A fragment's box, its type tab (none for a `region`), and each section's top and label. */
export interface SeqFragmentPlace {
  id: string; type: SeqFragment['type']; box: SeqRect; tab?: SeqRect; sections: { y: number; label?: SeqRect }[];
}
export interface SeqBoxPlace { id: string; box: SeqRect; label?: SeqRect }
/** Where a dragged step dropped at `y` would go. */
export interface SeqSlot { y: number; place: StepPlace }

/** Every part of a sequence, placed. */
export interface SequenceLayout {
  width: number;
  height: number;
  /** Lifeline x by participant, in data order. */
  columns: readonly { id: string; x: number }[];
  heads: readonly SeqHeadPlace[];
  lifelines: readonly SeqLifelinePlace[];
  messages: readonly SeqMessagePlace[];
  activations: readonly SeqActivationPlace[];
  notes: readonly SeqNotePlace[];
  fragments: readonly SeqFragmentPlace[];
  boxes: readonly SeqBoxPlace[];
  /** Every place a step can be dropped, top to bottom. */
  slots: readonly SeqSlot[];
}

/** The rect around `rects`, or `null` for none. */
export function unionRect(rects: readonly SeqRect[]): SeqRect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x, y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}

/**
 * Lays `data` out: lifelines spaced to the widest text between neighbors, a
 * row per step sized to its text, self-messages looped, heads started at
 * their `create` and lifelines ended at their `destroy`, nested activations
 * stepped right, and each fragment boxed over the lifelines its steps touch.
 */
export function sequenceLayout(data: SequenceData, opts: SequenceLayoutOptions = {}): SequenceLayout {
  const m = seqMeasure(opts.measure, opts.font);
  const boxLabelHeight = Math.max(0, ...(data.boxes ?? []).map((b) => ((b.label ?? '') === '' ? 0 : m.text(b.label!).height + 4)));
  const cols = columnsOf(data, m, SEQ.margin);
  const top = SEQ.margin + (data.boxes?.length ? SEQ.boxPad : 0) + boxLabelHeight;
  const rows = walkRows(data, m, cols, top);
  const columns = data.participants.map((p, i) => ({ id: p.id, x: cols.x[i]! }));
  const foot = rows.bottom + SEQ.footer;
  const lifelines = rows.lifelines.map((l) => ({ ...l, y1: l.y1 ?? foot, destroyed: l.y1 !== null }));
  const boxes = (data.boxes ?? []).flatMap((b): SeqBoxPlace[] => {
    const heads = rows.heads.filter((h) => b.members.includes(h.id)).map((h) => h.box);
    const around = unionRect(heads);
    if (around === null) return [];
    const label = (b.label ?? '') === '' ? null : m.text(b.label!);
    const x = around.x - SEQ.boxPad;
    const width = around.width + SEQ.boxPad * 2;
    const y = SEQ.margin;
    const box = { x, y, width, height: foot + SEQ.boxPad - y };
    return [{ id: b.id, box, ...(label ? { label: { x: x + (width - label.width) / 2, y: y + 2, ...label } } : {}) }];
  });
  const all = unionRect([
    ...rows.heads.map((h) => h.box), ...rows.notes.map((n) => n.box), ...rows.fragments.map((f) => f.box), ...boxes.map((b) => b.box),
    ...rows.messages.flatMap((msg) => (msg.text ? [msg.text] : [])),
    { x: 0, y: 0, width: cols.right, height: foot },
  ])!;
  return {
    width: Math.ceil(all.x + all.width + SEQ.margin),
    height: Math.ceil(Math.max(foot, all.y + all.height) + SEQ.margin),
    columns, heads: rows.heads, lifelines, messages: rows.messages, activations: rows.activations, notes: rows.notes,
    fragments: rows.fragments, boxes, slots: rows.slots,
  };
}

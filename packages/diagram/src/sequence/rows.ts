/**
 * The walk down a sequence's steps that gives each its row: a message its
 * text and line, a note its box, a fragment its header and sections. It
 * tracks what spans rows as it goes — open activations, heads created and
 * lifelines destroyed — and collects what each fragment's box must take in.
 */
import type { Columns } from './columns';
import type {
  SeqActivationPlace, SeqFragmentPlace, SeqHeadPlace, SeqMessagePlace, SeqNotePlace, SeqSlot,
} from './layout';
import { SEQ, type SeqMeasure, type SeqRect } from './metrics';
import type { SeqFragment, SeqMark, SeqMarkRef, SeqMessage, SeqNote, SeqStep, SequenceData, StepPlace } from './types';

/** What {@link walkRows} places; a lifeline's `y1` is `null` when it runs to the foot. */
export interface Rows {
  heads: SeqHeadPlace[];
  lifelines: Lifeline[];
  messages: SeqMessagePlace[];
  activations: SeqActivationPlace[];
  notes: SeqNotePlace[];
  fragments: SeqFragmentPlace[];
  slots: SeqSlot[];
  /** Below the last row. */
  bottom: number;
}

/** A lifeline as the walk tracks it; `y1` is `null` while it runs to the foot. */
type Lifeline = { id: string; x: number; y0: number; y1: number | null; destroyedBy?: StepPlace };

const spanOf = (rects: readonly SeqRect[]) => {
  const x0 = Math.min(...rects.map((r) => r.x));
  return { x0, x1: Math.max(...rects.map((r) => r.x + r.width)) };
};

class RowWalk {
  readonly out: Rows = { heads: [], lifelines: [], messages: [], activations: [], notes: [], fragments: [], slots: [], bottom: 0 };
  readonly index: Map<string, number>;
  readonly created: Set<string>;
  readonly lifeline = new Map<string, Lifeline>();
  readonly bars = new Map<string, { y: number; opener: SeqMarkRef }[]>();
  /** Lifelines a `destroy` ends at the next message to them, each with where it ends if none comes. */
  readonly destroying = new Map<string, number | null>();
  readonly frames: SeqRect[][] = [];
  last: { y: number; ends: readonly string[] } | null = null;
  number: number | undefined;
  y: number;

  constructor(readonly data: SequenceData, readonly m: SeqMeasure, readonly cols: Columns, top: number) {
    this.index = new Map(data.participants.map((p, i) => [p.id, i]));
    this.created = new Set(flatMarks(data.steps, 'create'));
    this.number = data.autonumber;
    const shown = data.participants.filter((p) => !this.created.has(p.id));
    const tall = Math.max(SEQ.headMinHeight, ...shown.map((p) => cols.heads[this.index.get(p.id)!]!.height));
    for (const p of shown) this.placeHead(p.id, top + tall - cols.heads[this.index.get(p.id)!]!.height, false);
    for (const l of this.lifeline.values()) l.y0 = top + tall;
    this.y = top + tall;
  }

  cx(id: string): number { return this.cols.x[this.index.get(id)!]!; }

  headRect(id: string): SeqRect {
    const size = this.cols.heads[this.index.get(id)!]!;
    return { x: this.cx(id) - size.width / 2, y: 0, width: size.width, height: 0 };
  }

  placeHead(id: string, y: number, created: boolean): number {
    const size = this.cols.heads[this.index.get(id)!]!;
    this.out.heads.push({ id, box: { x: this.cx(id) - size.width / 2, y, width: size.width, height: size.height }, created });
    const line = { id, x: this.cx(id), y0: y + size.height, y1: null };
    this.lifeline.set(id, line);
    this.out.lifelines.push(line);
    return y + size.height;
  }

  /** Into every open fragment's reach. */
  touch(rect: SeqRect): void {
    for (const f of this.frames) f.push(rect);
  }

  /** Where a line meets `id`'s lifeline from `side`: the edge of its innermost open activation. */
  endX(id: string, side: 1 | -1): number {
    const depth = this.bars.get(id)?.length ?? 0;
    if (depth === 0) return this.cx(id);
    return this.cx(id) + side * (SEQ.barWidth / 2) + (depth - 1) * SEQ.barStep;
  }

  open(id: string, y: number, opener: SeqMarkRef): void {
    const stack = this.bars.get(id) ?? [];
    stack.push({ y, opener });
    this.bars.set(id, stack);
  }

  close(id: string, y: number, closer?: SeqMarkRef): void {
    const stack = this.bars.get(id);
    const bar = stack?.pop();
    if (bar === undefined) return;
    const start = bar.y;
    const depth = stack!.length;
    const x = this.cx(id) - SEQ.barWidth / 2 + depth * SEQ.barStep;
    const box = { x, y: start, width: SEQ.barWidth, height: Math.max(y, start + 8) - start };
    this.out.activations.push({ participant: id, depth, box, opener: bar.opener, ...(closer ? { closer } : {}) });
  }

  steps(list: readonly SeqStep[], parent: StepPlace['parent']): void {
    list.forEach((step, index) => {
      this.out.slots.push({ y: this.y, place: { parent, index } });
      if (step.kind === 'message') this.message(step);
      else if (step.kind === 'note') this.note(step);
      else if (step.kind === 'fragment') this.fragment(step);
      else this.mark(step, { parent, index });
    });
    this.out.slots.push({ y: this.y, place: { parent, index: list.length } });
  }

  message(s: SeqMessage): void {
    if (!this.index.has(s.from) || !this.index.has(s.to)) return;
    this.y += SEQ.rowGap;
    const text = (s.text ?? '') === '' ? null : this.m.text(s.text!);
    const lineY = this.y + Math.max(text === null ? 0 : text.height + SEQ.textGap, 6);
    if (s.activate !== undefined) this.open(s[s.activate], lineY, { message: s.id, flag: 'activate' });
    const self = s.from === s.to;
    const dir = self ? 1 : Math.sign(this.cx(s.to) - this.cx(s.from)) as 1 | -1;
    const x1 = this.endX(s.from, dir);
    const x2 = self ? x1 : this.endX(s.to, -dir as 1 | -1);
    const place: SeqMessagePlace = { id: s.id, y: lineY, x1, x2 };
    if (self) place.loopY = lineY + SEQ.loopHeight;
    if (text !== null) {
      const x = self ? x1 + SEQ.textGap + 2 : (x1 + x2) / 2 - text.width / 2;
      place.text = { x, y: lineY - SEQ.textGap - text.height, ...text };
      this.touch(place.text);
    }
    if (this.number !== undefined) {
      const n = this.m.text(String(this.number), { fontSize: Math.max(8, this.m.font.fontSize - 2) });
      const d = Math.max(16, n.width + 6);
      place.number = { n: this.number++, box: { x: x1 - d / 2, y: lineY - d / 2, width: d, height: d } };
    }
    this.out.messages.push(place);
    this.touch(this.headRect(s.from));
    this.touch(this.headRect(s.to));
    if (self) this.touch({ x: x1, y: lineY, width: SEQ.loopWidth, height: 0 });
    if (s.deactivate !== undefined) this.close(s[s.deactivate], self ? place.loopY! : lineY, { message: s.id, flag: 'deactivate' });
    for (const id of new Set([s.from, s.to])) {
      if (!this.destroying.delete(id)) continue;
      const line = this.lifeline.get(id);
      if (line !== undefined) line.y1 = self ? place.loopY! : lineY;
    }
    this.y = place.loopY ?? lineY;
    this.last = { y: this.y, ends: [s.from, s.to] };
  }

  note(s: SeqNote): void {
    const over = s.over.filter((id) => this.index.has(id));
    if (over.length === 0) return;
    this.y += SEQ.rowGap;
    const t = this.m.text(s.text);
    const width = Math.max(SEQ.noteMinWidth, t.width + SEQ.notePad * 2);
    const height = t.height + SEQ.notePad * 2;
    const xs = over.map((id) => this.cx(id));
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    const x = s.side === 'right' ? lo + SEQ.barWidth / 2 + SEQ.noteGap
      : s.side === 'left' ? lo - SEQ.barWidth / 2 - SEQ.noteGap - width
      : lo === hi ? lo - width / 2
      : Math.min(lo - SEQ.noteOverhang, (lo + hi) / 2 - width / 2);
    const box = { x, y: this.y, width: s.side === undefined && lo !== hi ? Math.max(width, hi - lo + SEQ.noteOverhang * 2) : width, height };
    this.out.notes.push({ id: s.id, box });
    this.touch(box);
    for (const id of over) this.touch(this.headRect(id));
    this.y += height;
    this.last = null;
  }

  mark(s: SeqMark, at: StepPlace): void {
    if (!this.index.has(s.participant)) return;
    this.touch(this.headRect(s.participant));
    const y = this.last?.ends.includes(s.participant) ? this.last.y : this.y + SEQ.rowGap / 2;
    if (s.kind === 'activate') this.open(s.participant, y, { place: at });
    else if (s.kind === 'deactivate') this.close(s.participant, y, { place: at });
    else if (s.kind === 'destroy') {
      this.destroying.set(s.participant, this.last?.ends.includes(s.participant) ? this.last.y : null);
      const line = this.lifeline.get(s.participant);
      if (line !== undefined) line.destroyedBy = at;
    } else if (this.out.heads.every((h) => h.id !== s.participant)) {
      this.y = this.placeHead(s.participant, this.y + SEQ.rowGap, true);
      this.last = null;
    }
  }

  fragment(s: SeqFragment): void {
    this.y += SEQ.rowGap;
    const top = this.y;
    const tabText = s.type === 'region' ? null : this.m.text(s.type, { bold: true });
    const tab = tabText === null ? null : { width: tabText.width + SEQ.tabPad * 2, height: tabText.height + SEQ.tabPad };
    const labels = s.sections.map((sec) => ((sec.label ?? '') === '' ? null : this.m.text(sec.label!)));
    this.y += Math.max(tab?.height ?? 0, (labels[0]?.height ?? 0) + 4, 8);
    const frame: SeqRect[] = [];
    this.frames.push(frame);
    const sections: { y: number; height: number }[] = [];
    s.sections.forEach((sec, k) => {
      if (k > 0) {
        this.y += SEQ.rowGap / 2;
        sections.push({ y: this.y, height: 0 });
        this.y += (labels[k]?.height ?? 0) + 4;
      } else sections.push({ y: top, height: 0 });
      this.steps(sec.steps, { fragment: s.id, section: k });
      this.last = null;
    });
    this.frames.pop();
    this.y += SEQ.rowGap / 2;
    const reach = frame.length > 0 ? spanOf(frame) : { x0: this.cols.x[0] ?? 0, x1: this.cols.x.at(-1) ?? 0 };
    const minWidth = (tab?.width ?? 0) + (labels[0]?.width ?? 0) + SEQ.tabPad * 4;
    const x0 = reach.x0 - SEQ.fragmentPad / 2;
    const width = Math.max(reach.x1 - reach.x0 + SEQ.fragmentPad, minWidth);
    const box = { x: x0, y: top, width, height: this.y - top };
    const place: SeqFragmentPlace = {
      id: s.id, type: s.type, box,
      sections: sections.map((sec, k) => {
        const l = labels[k];
        if (l === null || l === undefined) return { y: sec.y };
        const label = k === 0
          ? { x: x0 + (tab?.width ?? 0) + SEQ.tabPad * 2, y: top + 2, ...l }
          : { x: x0 + width / 2 - l.width / 2, y: sec.y + 2, ...l };
        return { y: sec.y, label };
      }),
    };
    if (tab !== null) place.tab = { x: x0, y: top, ...tab };
    this.out.fragments.push(place);
    this.touch({ x: box.x - SEQ.fragmentNest, y: top, width: box.width + SEQ.fragmentNest * 2, height: 0 });
  }
}

/** The participants every `kind` mark names, in order. */
function flatMarks(steps: readonly SeqStep[], kind: SeqMark['kind']): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.kind === kind) out.push((s as SeqMark).participant);
    if (s.kind === 'fragment') for (const sec of s.sections) out.push(...flatMarks(sec.steps, kind));
  }
  return out;
}

/** Each step's row, from `top` down, under heads placed at `top`. */
export function walkRows(data: SequenceData, m: SeqMeasure, cols: Columns, top: number): Rows {
  const walk = new RowWalk(data, m, cols, top);
  walk.steps(data.steps, null);
  const bottom = walk.y + SEQ.rowGap;
  for (const [id, fallback] of walk.destroying) {
    const line = walk.lifeline.get(id);
    if (line !== undefined) line.y1 = fallback ?? bottom;
  }
  for (const [id, stack] of walk.bars) while (stack.length > 0) walk.close(id, bottom + SEQ.footer);
  walk.out.bottom = bottom;
  return walk.out;
}

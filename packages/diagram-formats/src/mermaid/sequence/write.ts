/** `writeMermaidSequence` — a sequence page as a Mermaid `sequenceDiagram`. */
import type { SeqParticipant, SeqStep, SequenceData } from '@weasel-js/diagram';
import type { ExportResult, SequencePage } from '../../document';
import { Warnings } from '../../graphRead';
import { mermaidIds } from '../common/text';
import { arrowOf, leadingColor, mermaidSeqText, typeOf } from './syntax';

const SECTION_WORDS = { loop: null, alt: 'else', opt: null, par: 'and', critical: 'option', break: null, region: null } as const;

/** Words a sequence reads as a statement when a line opens with one, however the line goes on. */
const SEQUENCE_WORDS = ['title', 'accTitle', 'accDescr', 'link', 'links', 'properties', 'details'];

/** Every participant id `data` names: declared, and named by a step. */
function namedIds(data: SequenceData): string[] {
  const ids = new Set(data.participants.map((p) => p.id));
  const visit = (steps: readonly SeqStep[]) => {
    for (const s of steps) {
      if (s.kind === 'message') ids.add(s.from).add(s.to);
      else if (s.kind === 'note') for (const id of s.over) ids.add(id);
      else if (s.kind === 'fragment') for (const sec of s.sections) visit(sec.steps);
      else ids.add(s.participant);
    }
  };
  visit(data.steps);
  return [...ids];
}

class SequenceWriter {
  readonly lines: string[] = ['sequenceDiagram'];
  readonly warnings = new Warnings();
  readonly ids: Map<string, string>;

  constructor(readonly data: SequenceData) {
    this.ids = mermaidIds(namedIds(data), { unicode: true, reserved: SEQUENCE_WORDS });
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  out(depth: number, text: string): void {
    this.lines.push(`${'  '.repeat(depth)}${text}`);
  }

  /** A participant's declaration: its type, its label, and `create` before it where its head is created. */
  declaration(p: SeqParticipant, create: boolean): string {
    let type = typeOf(p.outline);
    if (type === null) {
      this.warnings.list('Outlines Mermaid has no participant type for, written as plain participants:', String(p.outline));
      type = 'participant';
    }
    if (p.colors !== undefined || p.style !== undefined) this.warnings.add('Participants\' colors and roles were dropped.');
    const id = this.id(p.id);
    const head = type === 'participant' || type === 'actor' ? `${type} ${id}` : `participant ${id}@{ "type" : "${type}" }`;
    if (p.label !== undefined && p.label.trim() === '') this.warnings.add('Blank participant labels were dropped; those participants show their ids.');
    const text = p.label !== undefined && p.label.trim() !== '' ? p.label : p.id;
    const label = text !== id && text.trim() !== '' ? ` as ${mermaidSeqText(text)}` : '';
    return `${create ? 'create ' : ''}${head}${label}`;
  }

  /** Declares the participants, each box's members together where its first one stands. */
  participants(created: ReadonlySet<string>): void {
    type Box = NonNullable<SequenceData['boxes']>[number];
    const boxOf = new Map<string, Box>();
    for (const b of this.data.boxes ?? []) for (const m of b.members) if (!boxOf.has(m)) boxOf.set(m, b);
    const declared = new Map(this.data.participants.map((p) => [p.id, p]));
    const named = new Set(this.ids.keys());
    for (const [m] of boxOf) if (created.has(m)) this.warnings.add('Participants a step creates were written outside their boxes.');
    for (const [m] of boxOf) if (!named.has(m)) this.warnings.add('Box members that name no participant were dropped.');
    const kept = (id: string) => named.has(id) && !created.has(id);
    const written: string[] = [];
    const done = new Set<string>();
    const declare = (p: SeqParticipant, depth: number) => {
      this.out(depth, this.declaration(p, false));
      written.push(p.id);
    };
    const writeBox = (box: Box) => {
      if (done.has(box.id)) return;
      done.add(box.id);
      const members = new Set(box.members.filter((m) => boxOf.get(m) === box && kept(m)));
      if (members.size === 0) return;
      if (box.colors !== undefined && Object.keys(box.colors).some((k) => k !== 'fill')) this.warnings.add('Box colors other than the fill were dropped.');
      const label = box.label === undefined ? undefined : mermaidSeqText(box.label);
      const color = this.fill(box.colors?.fill) ?? (label !== undefined && leadingColor(label) !== undefined ? 'transparent' : undefined);
      this.out(1, ['box', color, label].filter((t) => t !== undefined).join(' '));
      for (const q of this.data.participants) if (members.has(q.id)) declare(q, 2);
      for (const m of members) if (!declared.has(m)) declare({ id: m }, 2);
      this.out(1, 'end');
    };
    for (const p of this.data.participants) {
      if (created.has(p.id)) continue;
      const box = boxOf.get(p.id);
      if (box === undefined) declare(p, 1);
      else writeBox(box);
    }
    for (const b of this.data.boxes ?? []) writeBox(b);
    const order = this.data.participants.map((p) => p.id).filter((id) => !created.has(id));
    const moved = written.filter((id) => declared.has(id));
    if (order.some((id, k) => moved[k] !== id)) this.warnings.add('Mermaid declares a box\'s members together; members declared apart were moved beside each other.');
  }

  /** A box's or a rect's fill as Mermaid reads one back, or none, with a warning, for a fill it would not. */
  fill(fill: string | undefined): string | undefined {
    if (fill === undefined || leadingColor(fill) === fill) return fill;
    this.warnings.add('Mermaid box and rect colors are hex, rgb(), hsl(), or a color name; others were dropped.');
    return undefined;
  }

  steps(steps: readonly SeqStep[], depth: number): void {
    for (const s of steps) {
      if (s.kind === 'message') {
        const { arrow, dropsBoth } = arrowOf(s);
        if (dropsBoth) this.warnings.add('A second head on a message whose head is not an arrow was dropped.');
        const mark = s.activate === 'to' ? '+' : s.deactivate === 'from' ? '-' : '';
        const [from, to] = [this.id(s.from), this.id(s.to)];
        this.out(depth, `${from}${arrow}${mark}${to}: ${mermaidSeqText(s.text ?? '')}`.trimEnd());
        if (s.activate === 'from') this.out(depth, `activate ${from}`);
        if (s.deactivate === 'to') this.out(depth, `deactivate ${to}`);
        if (s.activate === 'to' && s.deactivate === 'from') this.out(depth, `deactivate ${from}`);
      } else if (s.kind === 'note') {
        const place = s.side === 'left' ? 'left of' : s.side === 'right' ? 'right of' : 'over';
        this.out(depth, `Note ${place} ${s.over.map((id) => this.id(id)).join(',')}: ${mermaidSeqText(s.text)}`);
      } else if (s.kind === 'create') {
        const p = this.data.participants.find((q) => q.id === s.participant);
        if (p !== undefined) this.out(depth, this.declaration(p, true));
      } else if (s.kind === 'fragment') {
        const label = (k: number) => (s.sections[k]?.label === undefined ? '' : ` ${mermaidSeqText(s.sections[k]!.label!)}`);
        if (s.type === 'region') {
          if (s.sections.some((sec) => sec.label !== undefined)) this.warnings.add('Labels on colored regions were dropped.');
          this.out(depth, `rect ${this.fill(s.colors?.fill) ?? 'rgba(128, 128, 128, 0.1)'}`);
        } else {
          if (s.colors !== undefined) this.warnings.add('Colors on loops, alts, and other fragments were dropped.');
          this.out(depth, `${s.type}${label(0)}`);
        }
        s.sections.forEach((sec, k) => {
          if (k > 0) {
            const word = SECTION_WORDS[s.type];
            if (word === null) this.warnings.add(`A ${s.type} holds one section; the others were written into its first.`);
            else this.out(depth, `${word}${label(k)}`);
          }
          this.steps(sec.steps, depth + 1);
        });
        this.out(depth, 'end');
      } else {
        this.out(depth, `${s.kind} ${this.id(s.participant)}`);
      }
    }
  }
}

/** Every participant a `create` step heads, at any depth. */
function createdIn(steps: readonly SeqStep[], out = new Set<string>()): Set<string> {
  for (const s of steps) {
    if (s.kind === 'create') out.add(s.participant);
    if (s.kind === 'fragment') for (const sec of s.sections) createdIn(sec.steps, out);
  }
  return out;
}

/** Writes a sequence page as Mermaid. Its name is the diagram's title. */
export function writeMermaidSequence(page: SequencePage): ExportResult {
  const w = new SequenceWriter(page.data);
  // A colon after `title` is read as part of the keyword, so one opening the name is spelled out.
  if (page.name !== undefined) w.out(1, `title ${mermaidSeqText(page.name.trim()).replace(/^:/, '#58;')}`);
  const n = page.data.autonumber;
  if (n !== undefined && !Number.isFinite(n)) w.warnings.add('Mermaid numbers messages from a number; an autonumber start that is not one was written as 1.');
  if (n !== undefined) w.out(1, n === 1 || !Number.isFinite(n) ? 'autonumber' : `autonumber ${n}`);
  w.participants(createdIn(page.data.steps));
  w.steps(page.data.steps, 1);
  return { text: `${w.lines.join('\n')}\n`, warnings: w.warnings.all() };
}

/** `writeMermaidSequence` — a sequence page as a Mermaid `sequenceDiagram`. */
import type { SeqParticipant, SeqStep, SequenceData } from '@weasel-js/diagram';
import type { ExportResult, SequencePage } from '../../document';
import { Warnings } from '../../graphRead';
import { arrowOf, mermaidSeqText, typeOf } from './syntax';

const SECTION_WORDS = { loop: null, alt: 'else', opt: null, par: 'and', critical: 'option', break: null, region: null } as const;

class SequenceWriter {
  readonly lines: string[] = ['sequenceDiagram'];
  readonly warnings = new Warnings();

  constructor(readonly data: SequenceData) {}

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
    const head = type === 'participant' || type === 'actor' ? `${type} ${p.id}` : `participant ${p.id}@{ "type" : "${type}" }`;
    const label = p.label !== undefined && p.label !== p.id ? ` as ${mermaidSeqText(p.label)}` : '';
    return `${create ? 'create ' : ''}${head}${label}`;
  }

  participants(created: ReadonlySet<string>): void {
    const boxOf = new Map<string, NonNullable<SequenceData['boxes']>[number]>();
    for (const b of this.data.boxes ?? []) for (const m of b.members) if (!boxOf.has(m)) boxOf.set(m, b);
    let open: string | null = null;
    for (const p of this.data.participants) {
      if (created.has(p.id)) continue;
      const box = boxOf.get(p.id);
      if (open !== null && open !== box?.id) {
        this.out(1, 'end');
        open = null;
      }
      if (box !== undefined && open !== box.id) {
        const color = box.colors?.fill;
        if (box.colors !== undefined && Object.keys(box.colors).some((k) => k !== 'fill')) this.warnings.add('Box colors other than the fill were dropped.');
        this.out(1, ['box', color, box.label === undefined ? undefined : mermaidSeqText(box.label)].filter((s) => s !== undefined).join(' '));
        open = box.id;
      }
      this.out(open === null ? 1 : 2, this.declaration(p, false));
    }
    if (open !== null) this.out(1, 'end');
  }

  steps(steps: readonly SeqStep[], depth: number): void {
    for (const s of steps) {
      if (s.kind === 'message') {
        const { arrow, dropsBoth } = arrowOf(s);
        if (dropsBoth) this.warnings.add('A second head on a message whose head is not an arrow was dropped.');
        const mark = s.activate === 'to' ? '+' : s.deactivate === 'from' ? '-' : '';
        this.out(depth, `${s.from}${arrow}${mark}${s.to}: ${mermaidSeqText(s.text ?? '')}`.trimEnd());
        if (s.activate === 'from') this.out(depth, `activate ${s.from}`);
        if (s.deactivate === 'to') this.out(depth, `deactivate ${s.to}`);
        if (s.activate === 'to' && s.deactivate === 'from') this.out(depth, `deactivate ${s.from}`);
      } else if (s.kind === 'note') {
        const place = s.side === 'left' ? 'left of' : s.side === 'right' ? 'right of' : 'over';
        this.out(depth, `Note ${place} ${s.over.join(',')}: ${mermaidSeqText(s.text)}`);
      } else if (s.kind === 'create') {
        const p = this.data.participants.find((q) => q.id === s.participant);
        if (p !== undefined) this.out(depth, this.declaration(p, true));
      } else if (s.kind === 'fragment') {
        const label = (k: number) => (s.sections[k]?.label === undefined ? '' : ` ${mermaidSeqText(s.sections[k]!.label!)}`);
        if (s.type === 'region') {
          if (s.sections.some((sec) => sec.label !== undefined)) this.warnings.add('Labels on colored regions were dropped.');
          this.out(depth, `rect ${s.colors?.fill ?? 'rgba(128, 128, 128, 0.1)'}`);
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
        this.out(depth, `${s.kind} ${s.participant}`);
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
  if (page.name !== undefined) w.out(1, `title ${mermaidSeqText(page.name)}`);
  if (page.data.autonumber !== undefined) w.out(1, page.data.autonumber === 1 ? 'autonumber' : `autonumber ${page.data.autonumber}`);
  w.participants(createdIn(page.data.steps));
  w.steps(page.data.steps, 1);
  return { text: `${w.lines.join('\n')}\n`, warnings: w.warnings.all() };
}

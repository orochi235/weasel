/**
 * `readMermaidSequence` — a Mermaid `sequenceDiagram` as a one-page document
 * holding a sequence page. Its title is the page's name.
 */
import { sequenceLayout, type NodeStyle, type SeqBox, type SeqFragment, type SeqParticipant, type SeqStep, type SequenceData } from '@weasel-js/diagram';
import type { ImportResult, SequencePage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { PAGE_MARGIN } from '../../pageLayout';
import { FRAGMENTS, parseSequence, type SeqStmt } from './parse';
import { TYPE_OUTLINES, plainText } from './syntax';

type Draft = SeqFragment & { sections: { label?: string; steps: SeqStep[] }[] };
type Open = { kind: 'fragment'; frag: Draft; line: number } | { kind: 'box'; box: SeqBox & { members: string[] }; line: number };

/** A box's or a rect's color, and the box's label after it. */
function colorAndLabel(rest: string): { color?: string; label?: string } {
  const color = /^(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|transparent\b|[a-z]+(?=\s|$))/i.exec(rest)?.[0];
  const isColor = color !== undefined && (!/^[a-z]+$/i.test(color) || CSS_NAMES.has(color.toLowerCase().replace(/gr[ae]y/, 'gray')));
  const label = (isColor ? rest.slice(color!.length) : rest).trim();
  return { ...(isColor && color!.toLowerCase() !== 'transparent' ? { color } : {}), ...(label !== '' ? { label: plainText(label) } : {}) };
}

/** The CSS color names Mermaid takes as a box's first word, each gray among them in its "a" spelling, as a name is matched. */
const CSS_NAMES = new Set((
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse '
  + 'chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkkhaki darkmagenta '
  + 'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkturquoise darkviolet '
  + 'deeppink deepskyblue dimgray dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green '
  + 'greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral '
  + 'lightcyan lightgoldenrodyellow lightgray lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray '
  + 'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple '
  + 'mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite '
  + 'navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink '
  + 'plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue '
  + 'slateblue slategray snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' '));

class SequenceReader {
  readonly warnings = new Warnings();
  readonly participants = new Map<string, SeqParticipant>();
  readonly root: SeqStep[] = [];
  readonly boxes: SeqBox[] = [];
  readonly open: Open[] = [];
  readonly counts = { m: 0, n: 0, f: 0, b: 0 };
  autonumber: number | undefined;
  title: string | undefined;

  id(prefix: keyof SequenceReader['counts']): string {
    return `${prefix}${++this.counts[prefix]}`;
  }

  /** The list a step goes in: the innermost open fragment's last section, else the top level. */
  get list(): SeqStep[] {
    for (let i = this.open.length - 1; i >= 0; i--) {
      const o = this.open[i]!;
      if (o.kind === 'fragment') return o.frag.sections.at(-1)!.steps;
    }
    return this.root;
  }

  /** `id`, declared now if it was not: Mermaid draws a participant a message first names. */
  named(id: string): string {
    if (!this.participants.has(id)) this.participants.set(id, { id });
    return id;
  }

  declare(s: Extract<SeqStmt, { kind: 'participant' }>): void {
    if (!(s.type in TYPE_OUTLINES)) this.warnings.list('Participant types Mermaid has but this reader draws as a box:', s.type);
    const outline = TYPE_OUTLINES[s.type];
    const label = s.label === undefined ? undefined : plainText(s.label);
    const had = this.participants.get(s.id);
    this.participants.set(s.id, {
      ...had, id: s.id, ...(outline !== undefined ? { outline } : {}), ...(label !== undefined && label !== s.id ? { label } : {}),
    });
    const box = this.open.at(-1);
    if (box?.kind === 'box' && !box.box.members.includes(s.id)) box.box.members.push(s.id);
    if (s.create) this.list.push({ kind: 'create', participant: s.id });
  }

  stmt(s: SeqStmt): void {
    switch (s.kind) {
      case 'participant': return this.declare(s);
      case 'message': return this.message(s);
      case 'note': {
        const side = s.place === 'over' ? undefined : s.place === 'left of' ? 'left' as const : 'right' as const;
        const over = s.over.map((id) => this.named(id));
        this.list.push({ kind: 'note', id: this.id('n'), over, ...(side ? { side } : {}), text: plainText(s.text) });
        return;
      }
      case 'activate': case 'deactivate': case 'destroy':
        this.list.push({ kind: s.kind, participant: this.named(s.participant) });
        return;
      case 'fragment': {
        const frag: Draft = { kind: 'fragment', id: this.id('f'), type: s.word, sections: [{ ...(s.label ? { label: plainText(s.label) } : {}), steps: [] }] };
        this.list.push(frag);
        this.open.push({ kind: 'fragment', frag, line: s.line });
        return;
      }
      case 'rect': {
        const { color } = colorAndLabel(s.color);
        const frag: Draft = { kind: 'fragment', id: this.id('f'), type: 'region', sections: [{ steps: [] }], ...(color ? { colors: { fill: color } } : {}) };
        this.list.push(frag);
        this.open.push({ kind: 'fragment', frag, line: s.line });
        return;
      }
      case 'section': return this.section(s);
      case 'box': {
        if (this.open.length > 0) throw lineError('Mermaid', s.line, 'a box must be at the top level');
        const { color, label } = colorAndLabel(s.rest);
        const box = { id: this.id('b'), members: [] as string[], ...(label ? { label } : {}), ...(color ? { colors: { fill: color } as Partial<NodeStyle> } : {}) };
        this.boxes.push(box);
        this.open.push({ kind: 'box', box, line: s.line });
        return;
      }
      case 'end':
        if (this.open.pop() === undefined) throw lineError('Mermaid', s.line, '"end" closes nothing');
        return;
      case 'autonumber': return this.numbering(s.args, s.line);
      case 'title': this.title = plainText(s.text); return;
      case 'dropped': this.warnings.add(s.what);
    }
  }

  message(s: Extract<SeqStmt, { kind: 'message' }>): void {
    const { arrow } = s;
    this.list.push({
      kind: 'message', id: this.id('m'), from: this.named(s.from), to: this.named(s.to), line: arrow.line, head: arrow.head,
      ...(arrow.both ? { both: true } : {}), ...(arrow.async ? { async: true } : {}),
      ...(s.text.trim() !== '' ? { text: plainText(s.text) } : {}),
      ...(s.mark === '+' ? { activate: 'to' as const } : s.mark === '-' ? { deactivate: 'from' as const } : {}),
    });
  }

  section(s: Extract<SeqStmt, { kind: 'section' }>): void {
    const top = this.open.at(-1);
    if (top?.kind !== 'fragment' || FRAGMENTS[top.frag.type as keyof typeof FRAGMENTS] !== s.word) {
      throw lineError('Mermaid', s.line, `"${s.word}" is not inside ${s.word === 'else' ? 'an alt' : s.word === 'and' ? 'a par' : 'a critical'}`);
    }
    top.frag.sections.push({ ...(s.label ? { label: plainText(s.label) } : {}), steps: [] });
  }

  numbering(args: readonly string[], line: number): void {
    if (args[0]?.toLowerCase() === 'off') {
      this.autonumber = undefined;
      return;
    }
    const [start = 1, step = 1] = args.map(Number);
    if (!Number.isFinite(start) || !Number.isFinite(step)) throw lineError('Mermaid', line, `"autonumber ${args.join(' ')}" is not a start and a step`);
    if (step !== 1) this.warnings.add('Autonumber steps other than 1 were dropped; messages count up by one.');
    this.autonumber = start;
  }
}

/** Reads a Mermaid sequence diagram. Throws, naming the line, on text that is not one. */
export function readMermaidSequence(text: string): ImportResult {
  const parsed = parseSequence(text);
  const r = new SequenceReader();
  for (const d of parsed.dropped) r.warnings.add(d);
  for (const s of parsed.stmts) r.stmt(s);
  const unclosed = r.open.at(-1);
  if (unclosed !== undefined) throw lineError('Mermaid', unclosed.line, `this ${unclosed.kind === 'box' ? 'box' : unclosed.frag.type} is never closed with "end"`);
  const data: SequenceData = {
    participants: [...r.participants.values()], steps: r.root,
    ...(r.boxes.length > 0 ? { boxes: r.boxes } : {}), ...(r.autonumber !== undefined ? { autonumber: r.autonumber } : {}),
  };
  const title = r.title ?? parsed.title;
  const size = sequenceLayout(data);
  const page: SequencePage = {
    kind: 'sequence', id: 'page-1', ...(title !== undefined ? { name: title } : {}),
    width: size.width + PAGE_MARGIN * 2, height: size.height + PAGE_MARGIN * 2, data,
  };
  return { document: { pages: [page] }, warnings: r.warnings.all() };
}

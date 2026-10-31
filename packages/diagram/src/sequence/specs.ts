/**
 * `sequenceSpecs` — a sequence diagram as scene specs: one root holding the
 * `SequenceData`, and every part drawn from it as a child the root owns. The
 * parts take no press of their own; an edit replaces the root's data and
 * builds them again.
 */
import { RIGID_POSE_COMPOSITION, localizeWorldPoses, type PoseComposition, type RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { MeasureRowText } from '../body';
import { withColors } from '../dataColors';
import type { DiagramSceneData, DiagramSpec, NodeStyle } from '../dataTypes';
import { contentBox, type Outline } from '../outline';
import { diagramThemeFrom, roleEdgeStyle, roleStyle, themeFont } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import { sequenceLayout, type SequenceLayout } from './layout';
import { SEQ, type SeqRect } from './metrics';
import type { SeqPartKind, SeqPartTrait, SequenceGeometry } from './trait';
import type { SeqMarkRef, SeqStep, SeqTextTarget, SequenceData } from './types';
import { flatSteps } from './columns';

/** The theme role each kind of part is drawn in, where its data names none. */
export const SEQUENCE_ROLES = { note: 'warning', number: 'accent' } as const;

/** Options for {@link sequenceSpecs}. */
export interface SequenceSpecsOptions<TLayer extends string = 'main'> {
  /** The root's id; every part's id starts with it. */
  id: string;
  /** Where the diagram's top-left corner stands. Default the origin. */
  at?: Vec2;
  /** Default `'main'`. */
  layer?: TLayer;
  /** Default the night theme. */
  theme?: DiagramTheme;
  /** Default the theme's face. */
  font?: { fontFamily: string; fontSize: number };
  /** Measures text. Default an estimate from character count. */
  measure?: MeasureRowText;
  /** How the scene folds a child's pose into its parent's. Default `RIGID_POSE_COMPOSITION`. */
  composition?: PoseComposition<RectPose>;
}

const DASH = [6, 4];
const LIFELINE_DASH = [4, 4];
const MARKERS = { arrow: 'arrow', open: 'arrow-open', cross: null, none: null } as const;

type Font = { fontFamily: string; fontSize: number };

class PartSpecs {
  readonly specs: DiagramSpec[] = [];

  constructor(readonly root: string, readonly at: Vec2, readonly font: Font) {}

  place(r: SeqRect): RectPose {
    return { x: this.at.x + r.x, y: this.at.y + r.y, width: r.width, height: r.height };
  }

  push(id: string, seq: Omit<SeqPartTrait, 'root'>, r: SeqRect, data: Omit<DiagramSceneData, 'diagram'> & { diagram?: object }): void {
    this.specs.push({
      id: `${this.root}/${id}` as never, kind: 'mark', layer: 'main', parent: this.root as never, pickable: false, pose: this.place(r),
      data: { ...data, diagram: { ...data.diagram, seq: { root: this.root, ...seq } } } as DiagramSceneData,
    });
  }

  body(id: string, part: SeqPartKind, of: string | undefined, r: SeqRect, outline: Outline, style: NodeStyle, dash?: number[]): void {
    const lines = dash ?? style.dash;
    this.push(id, { part, ...(of !== undefined ? { id: of } : {}) }, r, {
      diagram: { outline },
      fill: { paint: { color: style.fill } },
      stroke: { paint: { color: style.stroke }, width: style.strokeWidth ?? 1.5, ...(lines !== undefined && lines.length > 0 ? { dash: lines } : {}) },
    });
  }

  line(id: string, part: SeqPartKind, of: string | undefined, r: SeqRect, d: string, stroke: DiagramSceneData['stroke'], fill?: string): void {
    this.push(id, { part, ...(of !== undefined ? { id: of } : {}) }, r, {
      diagram: { mark: { d } }, stroke, ...(fill !== undefined ? { fill: { paint: { color: fill } } } : {}),
    });
  }

  /** The marks the part just pushed draws, onto its trait. */
  marks(refs: readonly SeqMarkRef[]): void {
    const seq = (this.specs.at(-1)!.data as { diagram: { seq: SeqPartTrait } }).diagram.seq;
    seq.marks = refs;
  }

  text(id: string, r: SeqRect, text: string, color: string, target?: SeqTextTarget, face: { fontSize?: number; fontWeight?: number } = {}, centered = true): void {
    // A hair wider than measured, so the painter never breaks a line the layout kept whole.
    const box = { ...r, x: r.x - 1, width: r.width + 2 };
    this.push(id, { part: 'text', ...(target ? { target } : {}) }, box, {
      text, style: { ...this.font, ...(centered ? { align: 'center' as const } : {}), ...face }, verticalAlign: 'center', fill: { paint: { color } },
    });
  }
}

/** The head and lifeline of each participant, and the X where one was destroyed. */
function participantSpecs(out: PartSpecs, data: SequenceData, layout: SequenceLayout, theme: DiagramTheme): void {
  for (const l of layout.lifelines) {
    const p = data.participants.find((q) => q.id === l.id)!;
    const style = withColors(roleStyle(theme, p.style), p.colors);
    out.line(`life:${l.id}`, 'lifeline', l.id, { x: l.x - 1, y: l.y0, width: 2, height: Math.max(l.y1 - l.y0, 0) }, 'M0.5 0V1',
      { paint: { color: style.stroke }, width: 1, dash: LIFELINE_DASH });
    if (l.destroyed) {
      const c = SEQ.cross;
      out.line(`destroy:${l.id}`, 'destroy', l.id, { x: l.x - c / 2, y: l.y1 - c / 2, width: c, height: c }, 'M0 0L1 1M1 0L0 1',
        { paint: { color: style.stroke }, width: 2 });
      if (l.destroyedBy) out.marks([{ place: l.destroyedBy }]);
    }
  }
  for (const [i, a] of layout.activations.entries()) {
    const p = data.participants.find((q) => q.id === a.participant)!;
    out.body(`act:${i}`, 'activation', a.participant, a.box, 'rect', withColors(roleStyle(theme, p.style), p.colors));
    out.marks(a.closer ? [a.opener, a.closer] : [a.opener]);
  }
}

function headSpecs(out: PartSpecs, data: SequenceData, layout: SequenceLayout, theme: DiagramTheme): void {
  for (const h of layout.heads) {
    const p = data.participants.find((q) => q.id === h.id)!;
    const style = withColors(roleStyle(theme, p.style), p.colors);
    const outline = p.outline ?? 'rect';
    out.body(`head:${p.id}`, 'head', p.id, h.box, outline, style);
    out.text(`head:${p.id}/text`, contentBox(outline, h.box), p.label ?? p.id, style.text, { participant: p.id });
  }
}

function messageSpecs(out: PartSpecs, steps: readonly SeqStep[], layout: SequenceLayout, theme: DiagramTheme): void {
  const byId = new Map(layout.messages.map((m) => [m.id, m]));
  const edge = roleEdgeStyle(theme);
  const width = edge.width ?? 1.5;
  for (const msg of flatSteps(steps)) {
    const at = msg.kind === 'message' ? byId.get(msg.id) : undefined;
    if (at === undefined || msg.kind !== 'message') continue;
    const s = msg;
    const marker = MARKERS[msg.head];
    const stroke = {
      paint: { color: edge.stroke }, width, ...(msg.line === 'dashed' ? { dash: DASH } : {}),
      ...(marker !== null ? { markerEnd: marker } : {}), ...(marker !== null && msg.both ? { markerStart: marker } : {}),
    };
    if (at.loopY !== undefined) {
      out.line(`msg:${s.id}`, 'message', s.id, { x: at.x1, y: at.y, width: SEQ.loopWidth, height: at.loopY - at.y }, 'M0 0H1V1H0', stroke);
    } else {
      const d = at.x2 >= at.x1 ? 'M0 0H1' : 'M1 0H0';
      out.line(`msg:${s.id}`, 'message', s.id, { x: Math.min(at.x1, at.x2), y: at.y, width: Math.abs(at.x2 - at.x1), height: 0 }, d, stroke);
    }
    if (msg.head === 'cross') {
      const c = SEQ.cross * 0.8;
      const end = { x: at.x2, y: at.loopY ?? at.y };
      out.line(`msg:${s.id}/cross`, 'message', s.id, { x: end.x - c / 2, y: end.y - c / 2, width: c, height: c }, 'M0 0L1 1M1 0L0 1',
        { paint: { color: edge.stroke }, width });
    }
    if (at.text) out.text(`msg:${s.id}/text`, at.text, msg.text ?? '', edge.label ?? edge.stroke, { step: s.id }, {}, msg.from !== msg.to);
    if (at.number) {
      const style = roleStyle(theme, SEQUENCE_ROLES.number);
      out.body(`msg:${s.id}/number`, 'number', s.id, at.number.box, 'ellipse', style);
      out.text(`msg:${s.id}/number/text`, at.number.box, String(at.number.n), style.text, undefined, { fontSize: Math.max(8, out.font.fontSize - 2) });
    }
  }
}

function noteSpecs(out: PartSpecs, steps: readonly SeqStep[], layout: SequenceLayout, theme: DiagramTheme): void {
  const byId = new Map(layout.notes.map((n) => [n.id, n]));
  const style = roleStyle(theme, SEQUENCE_ROLES.note);
  for (const s of flatSteps(steps)) {
    const at = s.kind === 'note' ? byId.get(s.id) : undefined;
    if (at === undefined || s.kind !== 'note') continue;
    out.body(`note:${s.id}`, 'note', s.id, at.box, 'note', style);
    out.text(`note:${s.id}/text`, contentBox('note', at.box), s.text, style.text, { step: s.id });
  }
}

function fragmentSpecs(out: PartSpecs, steps: readonly SeqStep[], layout: SequenceLayout, theme: DiagramTheme, boxesOnly: boolean): void {
  const byId = new Map(layout.fragments.map((f) => [f.id, f]));
  for (const s of flatSteps(steps)) {
    const at = s.kind === 'fragment' ? byId.get(s.id) : undefined;
    if (at === undefined || s.kind !== 'fragment') continue;
    const style = withColors({ ...theme.container, ...(s.type === 'region' ? {} : { fill: 'transparent' }) }, s.colors);
    if (boxesOnly) {
      out.body(`frag:${s.id}`, 'fragment', s.id, at.box, 'rect', { ...style, strokeWidth: 1 }, []);
      continue;
    }
    at.sections.forEach((sec, k) => {
      if (k > 0) {
        out.line(`frag:${s.id}/divider:${k}`, 'divider', s.id, { x: at.box.x, y: sec.y, width: at.box.width, height: 0 }, 'M0 0H1',
          { paint: { color: style.stroke }, width: 1, dash: DASH });
      }
      if (sec.label) out.text(`frag:${s.id}/label:${k}`, sec.label, s.sections[k]!.label ?? '', style.text, { fragment: s.id, section: k });
    });
    if (at.tab) {
      out.line(`frag:${s.id}/tab`, 'fragment', s.id, at.tab, 'M0 0H1V0.6L0.85 1H0Z', { paint: { color: style.stroke }, width: 1 }, theme.container.fill);
      out.text(`frag:${s.id}/type`, at.tab, s.type, style.text, undefined, { fontWeight: 700 });
    }
  }
}

function boxSpecs(out: PartSpecs, data: SequenceData, layout: SequenceLayout, theme: DiagramTheme): void {
  for (const b of layout.boxes) {
    const own = data.boxes?.find((q) => q.id === b.id);
    const style = withColors(theme.container, own?.colors);
    out.body(`box:${b.id}`, 'box', b.id, b.box, 'rect', { ...style, strokeWidth: 1 }, []);
    if (b.label) out.text(`box:${b.id}/text`, b.label, own?.label ?? '', style.text, { box: b.id });
  }
}

/** What a root keeps of its layout for the editing to read. */
const geometryOf = (layout: SequenceLayout): SequenceGeometry => ({
  columns: layout.columns, slots: layout.slots, messages: layout.messages, notes: layout.notes,
  heads: layout.heads.map(({ id, box }) => ({ id, box })),
  fragments: layout.fragments.map(({ id, box, tab }) => ({ id, grip: tab ?? { ...box, height: Math.min(box.height, SEQ.rowGap) } })),
  boxes: layout.boxes.map(({ id, box, label }) => ({ id, grip: { ...box, height: (label?.height ?? 0) + SEQ.boxPad } })),
  marks: [
    ...layout.activations.map((a, i) => ({ id: `act:${i}`, grip: a.box })),
    ...layout.lifelines.flatMap((l) => (l.destroyedBy === undefined ? [] : [{ id: `destroy:${l.id}`, grip: crossGrip(l.x, l.y1) }])),
  ],
});

/** A destruction's cross, grown to a size a pointer can take. */
const crossGrip = (x: number, y: number): SeqRect => {
  const c = Math.max(SEQ.cross, 12);
  return { x: x - c / 2, y: y - c / 2, width: c, height: c };
};

/**
 * The root and parts of a sequence diagram: its root at `at`, sized to the
 * layout, holding `data`; boxes, fragments, lifelines, activations, messages,
 * notes, and heads drawn over one another in that order, each from the
 * theme's roles, its own colors over them.
 */
export function sequenceSpecs<TLayer extends string = 'main'>(data: SequenceData, opts: SequenceSpecsOptions<TLayer>): DiagramSpec<TLayer>[] {
  const theme = opts.theme ?? diagramThemeFrom(undefined);
  const font = opts.font ?? themeFont(theme);
  const layout = sequenceLayout(data, { font, ...(opts.measure ? { measure: opts.measure } : {}) });
  const at = opts.at ?? { x: 0, y: 0 };
  const out = new PartSpecs(opts.id, at, font);
  out.specs.push({
    id: opts.id as never, kind: 'mark', layer: 'main', pose: out.place({ x: 0, y: 0, width: layout.width, height: layout.height }),
    data: { diagram: { sequence: data, geometry: geometryOf(layout) } } as DiagramSceneData,
  });
  boxSpecs(out, data, layout, theme);
  fragmentSpecs(out, data.steps, layout, theme, true);
  participantSpecs(out, data, layout, theme);
  messageSpecs(out, data.steps, layout, theme);
  noteSpecs(out, data.steps, layout, theme);
  headSpecs(out, data, layout, theme);
  fragmentSpecs(out, data.steps, layout, theme, false);
  const layer = (opts.layer ?? 'main') as TLayer;
  return localizeWorldPoses(out.specs, opts.composition ?? RIGID_POSE_COMPOSITION).map((s) => ({ ...s, layer })) as DiagramSpec<TLayer>[];
}

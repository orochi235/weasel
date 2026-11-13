import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { MARK_COLOR_LEAF, MARK_SIZE_LEAF, MARK_WIDTH_LEAF } from './options';
import { MARK_COLOR, MARK_TEXT_SIZE, MARK_WIDTH } from './paint';
import type { Annotation, AnnotationKind } from './types';

/** A style field the palette edits on a selection. */
export type MarkStyleField = 'width' | 'color' | 'fontSize';

const FIELDS: readonly {
  field: MarkStyleField;
  leaf: PrefLeaf;
  fallback: unknown;
  on: (k: AnnotationKind) => boolean;
}[] = [
  {
    field: 'width',
    leaf: MARK_WIDTH_LEAF,
    fallback: MARK_WIDTH,
    on: (k) => k !== 'text' && k !== 'point',
  },
  { field: 'fontSize', leaf: MARK_SIZE_LEAF, fallback: MARK_TEXT_SIZE, on: (k) => k === 'text' },
  { field: 'color', leaf: MARK_COLOR_LEAF, fallback: MARK_COLOR, on: () => true },
];

/** Whether `field` is one a mark of `kind` draws with. */
export function markHasField(kind: AnnotationKind, field: MarkStyleField): boolean {
  return FIELDS.find((f) => f.field === field)?.on(kind) ?? false;
}

/** What the palette draws for a selection: the fields any selected mark has, each one's value where every mark that
 *  has it agrees, and the fields where they do not. Null for no marks. */
export interface SelectionStyle {
  schema: PrefGroup;
  values: Record<string, unknown>;
  mixed: ReadonlySet<string>;
}

export function selectionStyle(marks: readonly Annotation[]): SelectionStyle | null {
  if (marks.length === 0) return null;
  const children: Record<string, PrefLeaf> = {};
  const values: Record<string, unknown> = {};
  const mixed = new Set<string>();
  for (const f of FIELDS) {
    const having = marks.filter((m) => f.on(m.kind));
    if (having.length === 0) continue;
    children[f.field] = f.leaf;
    const seen = new Set(having.map((m) => m[f.field] ?? f.fallback));
    if (seen.size === 1) values[f.field] = [...seen][0];
    else mixed.add(f.field);
  }
  return { schema: { name: 'Selection', as: 'bar', children }, values, mixed };
}

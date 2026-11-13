import { describe, expect, it } from 'vitest';
import { MARK_COLOR, MARK_WIDTH } from './paint';
import { markHasField, selectionStyle } from './selectionStyle';
import type { Annotation, AnnotationKind } from './types';

const mark = (kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation => ({
  id: `t/${Math.random()}`,
  target: 't',
  kind,
  frac: { x: 0, y: 0, w: 0.1, h: 0.1 },
  ...extra,
});

describe('selectionStyle', () => {
  it('is null for no marks', () => {
    expect(selectionStyle([])).toBeNull();
  });

  it("reads one mark's style, defaults included", () => {
    const s = selectionStyle([mark('rect', { width: 6 })]);
    expect(Object.keys(s?.schema.children ?? {})).toEqual(['width', 'color']);
    expect(s?.values).toEqual({ width: 6, color: MARK_COLOR });
    expect(s?.mixed.size).toBe(0);
  });

  it('marks a field mixed where the marks disagree, counting a default as a value', () => {
    const s = selectionStyle([
      mark('line', { width: MARK_WIDTH }),
      mark('arrow'),
      mark('rect', { color: '#0090ff' }),
    ]);
    expect(s?.values.width).toBe(MARK_WIDTH);
    expect([...(s?.mixed ?? [])]).toEqual(['color']);
  });

  it('offers size for text and width for lines, color for both', () => {
    const s = selectionStyle([mark('text', { fontSize: 20 }), mark('stroke')]);
    expect(Object.keys(s?.schema.children ?? {})).toEqual(['width', 'fontSize', 'color']);
    expect(s?.values).toMatchObject({ fontSize: 20, width: MARK_WIDTH });
  });

  it('knows which fields a kind draws with', () => {
    expect(markHasField('text', 'width')).toBe(false);
    expect(markHasField('text', 'fontSize')).toBe(true);
    expect(markHasField('ellipse', 'color')).toBe(true);
  });
});

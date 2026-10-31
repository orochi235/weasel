import { describe, expect, it } from 'vitest';
import { polylineFromPoints } from '@weasel-js/core';
import { END_LABEL_PLACEMENT, endLabelIdOf } from './edgeLabel';
import { diagramScene } from './fromData';
import { labelCenter } from './labels/station';

const DATA = {
  nodes: [{ id: 'a', at: { x: 0, y: 0 } }, { id: 'b', at: { x: 300, y: 0 } }],
  edges: [{ id: 'ab', from: 'a', to: 'b', label: 'has', endLabels: { from: '1', to: '0..*' } }],
};

describe('end labels', () => {
  it('draws each end\'s text as a label at that end, beside the edge\'s own', () => {
    const specs = diagramScene(DATA, { layout: 'none' });
    const label = (id: string) => specs.find((s) => s.id === id)?.data as { text: string; diagram: { label: unknown } } | undefined;
    expect(label(endLabelIdOf('ab', 'from'))).toMatchObject({ text: '1', diagram: { label: END_LABEL_PLACEMENT } });
    expect(label(endLabelIdOf('ab', 'to'))).toMatchObject({ text: '0..*', diagram: { label: { ...END_LABEL_PLACEMENT, at: 'end' } } });
    expect(label('ab/label')?.text).toBe('has');
  });

  it('draws none for an end with no text', () => {
    const specs = diagramScene({ ...DATA, edges: [{ ...DATA.edges[0]!, endLabels: { to: 'n' } }] }, { layout: 'none' });
    expect(specs.some((s) => s.id === endLabelIdOf('ab', 'from'))).toBe(false);
    expect(specs.some((s) => s.id === endLabelIdOf('ab', 'to'))).toBe(true);
  });
});

describe('a label inset from an end', () => {
  const route = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  const size = { width: 20, height: 10 };

  it('stands its near side `inset` along the route from the end it is at', () => {
    expect(labelCenter(route, { at: 'start', inset: 4 }, size)).toEqual({ x: 14, y: 0 });
    expect(labelCenter(route, { at: 'end', inset: 4 }, size)).toEqual({ x: 86, y: 0 });
  });

  it('is ignored away from the ends, and once placement has moved the label', () => {
    expect(labelCenter(route, { at: 'mid', inset: 4 }, size)).toEqual({ x: 50, y: 0 });
    expect(labelCenter(route, { at: 'start', inset: 4, placed: { at: 0.5, offset: 0 } }, size)).toEqual({ x: 50, y: 0 });
  });
});

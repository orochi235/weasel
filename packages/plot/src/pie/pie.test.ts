import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compilePie, pieAngles, piePercent } from './compile';
import { pieValueOf, setPieLabel, setPieValue } from './edit';
import { pieEditor } from './editor';
import type { PieData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 600, height: 400 };

const PETS: PieData = {
  kind: 'pie',
  title: 'Pets',
  showData: true,
  slices: [
    { label: 'Dogs', value: 386 },
    { label: 'Cats', value: 85.9 },
    { label: 'Birds', value: 0 },
    { label: 'Rats', value: 3 },
  ],
};

const byKey = (data: PieData) => {
  const { marks, layout } = compilePie(data, SIZE, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compilePie', () => {
  it('cuts a slice per value clockwise from twelve o\'clock, each its share of a turn', () => {
    const angles = pieAngles(PETS);
    const total = 386 + 85.9 + 3;
    expect(angles[0]).toEqual({ start: 0, end: (386 / total) * 2 * Math.PI });
    expect(angles[1]!.start).toBe(angles[0]!.end);
    expect(angles[2]!.start).toBe(angles[2]!.end);
    expect(angles[3]!.end).toBeCloseTo(2 * Math.PI);
  });

  it('draws each slice in its series color, keyed by its index, and nothing for a zero', () => {
    const { get, layout } = byKey(PETS);
    const dogs = get('slice:0')!;
    expect(dogs.data.plotMark).toEqual({ kind: 'arc', datum: { slice: 0 } });
    expect(dogs.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
    expect(get('slice:3')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 3));
    expect(get('slice:2')).toBeUndefined();
    expect(dogs.pose.y).toBeCloseTo(layout.center.y - layout.radius);
  });

  it('writes each share as Mermaid rounds it where it fits, and none on a slice too thin', () => {
    expect(piePercent(85.9, 474.9)).toBe('18%');
    const { get } = byKey(PETS);
    expect(get('percent:0')!.data.text).toBe('81%');
    expect(get('percent:1')!.data.text).toBe('18%');
    expect(get('percent:3')).toBeUndefined();
  });

  it('lists every slice in a legend at the right, its value shown with showData, a zero too', () => {
    const { get, layout } = byKey(PETS);
    const label = get('legend:label:2')!;
    expect(label.data.text).toBe('Birds');
    expect(label.data.plotMark.datum).toEqual({ edit: 'label', slice: 2 });
    expect(label.pose.x).toBeGreaterThan(layout.center.x + layout.radius);
    expect(get('legend:value:1')!.data.text).toBe('[85.9]');
    expect(get('legend:value:1')!.data.plotMark.datum).toEqual({ edit: 'value', slice: 1 });
    expect(get('legend:swatch:2')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 2));
    expect(byKey({ ...PETS, showData: false }).get('legend:value:1')).toBeUndefined();
  });

  it('draws its title, and nothing but that for no slices or a tiny box', () => {
    expect(byKey(PETS).get('title')!.data.text).toBe('Pets');
    expect(compilePie({ kind: 'pie', slices: [] }, SIZE, PLOT_THEME, measure).marks).toEqual([]);
    expect(() => compilePie(PETS, { width: 4, height: 4 }, PLOT_THEME, measure)).not.toThrow();
  });
});

describe('pie edits', () => {
  it('setPieValue and setPieLabel replace one slice\'s field', () => {
    const next = setPieValue(PETS, 1, 90);
    expect(next.slices[1]).toEqual({ label: 'Cats', value: 90 });
    expect(next.slices[0]).toBe(PETS.slices[0]);
    expect(setPieValue(PETS, 0, 386)).toBe(PETS);
    expect(setPieLabel(PETS, 3, 'Mice').slices[3]!.label).toBe('Mice');
    expect(() => setPieValue(PETS, 9, 1)).toThrow(/no slice 9/);
  });

  it('reads a typed value with or without its brackets, and nothing negative', () => {
    expect(pieValueOf('[42.96]')).toBe(42.96);
    expect(pieValueOf(' 7 ')).toBe(7);
    expect(pieValueOf('-1')).toBeNull();
    expect(pieValueOf('lots')).toBeNull();
  });

  it('the editor takes no drag, and sets the title, a label and a value typed in place', () => {
    const { get } = byKey(PETS);
    const slice = get('slice:0')!;
    expect(pieEditor.handle(PETS, { trait: slice.data.plotMark, pose: slice.pose })).toBeNull();
    expect(pieEditor.text!(PETS, { edit: 'title' }, 'Animals').title).toBe('Animals');
    expect(pieEditor.text!(PETS, { edit: 'label', slice: 1 }, 'Kittens').slices[1]!.label).toBe('Kittens');
    expect(pieEditor.text!(PETS, { edit: 'value', slice: 1 }, '[100]').slices[1]!.value).toBe(100);
    expect(pieEditor.text!(PETS, { edit: 'value', slice: 1 }, 'many')).toBe(PETS);
    expect(pieEditor.text!(PETS, { edit: 'value', slice: 1 }, '-3')).toBe(PETS);
    expect(pieEditor.text!(PETS, { edit: 'label', slice: 1 }, '  ')).toBe(PETS);
  });
});

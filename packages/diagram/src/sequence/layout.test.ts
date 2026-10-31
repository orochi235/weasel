import { describe, expect, it } from 'vitest';
import { SEQ_FIXTURE as data } from './fixture';
import { sequenceLayout } from './layout';
import { SEQ } from './metrics';
import type { SequenceData } from './types';

const msg = (id: string, from: string, to: string, text = '') =>
  ({ kind: 'message', id, from, to, text, line: 'solid', head: 'arrow' }) as const;

describe('sequenceLayout', () => {
  const layout = sequenceLayout(data);
  const col = (id: string) => layout.columns.find((c) => c.id === id)!.x;
  const m = (id: string) => layout.messages.find((q) => q.id === id)!;

  it('spaces lifelines left to right so the widest text between neighbors fits', () => {
    expect(col('a')).toBeLessThan(col('b'));
    expect(col('b')).toBeLessThan(col('c'));
    expect(m('m1').text!.width).toBeLessThan(col('b') - col('a'));
  });

  it('gives each message a row, top to bottom in step order', () => {
    const ys = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => m(id).y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('loops a self-message and puts its text right of the lifeline', () => {
    const self = m('m4');
    expect(self.loopY).toBeGreaterThan(self.y);
    expect(self.x2).toBe(self.x1);
    expect(self.text!.x).toBeGreaterThan(col('b'));
  });

  it('ends a message at an open activation\'s edge, and closes the bar where it is deactivated', () => {
    const bar = layout.activations.find((a) => a.participant === 'b')!;
    expect(m('m1').x2).toBeCloseTo(col('b') - SEQ.barWidth / 2);
    expect(bar.box.y).toBeCloseTo(m('m1').y);
    expect(bar.box.y + bar.box.height).toBeCloseTo(m('m4').loopY!);
  });

  it('boxes a fragment over the lifelines its steps touch, with a divider per later section', () => {
    const f = layout.fragments[0]!;
    expect(f.box.x).toBeLessThan(col('a'));
    expect(f.box.x + f.box.width).toBeGreaterThan(col('b'));
    expect(f.box.x + f.box.width).toBeLessThan(col('c'));
    expect(f.sections).toHaveLength(2);
    expect(f.sections[1]!.y).toBeGreaterThan(m('m2').y);
    expect(f.sections[1]!.y).toBeLessThan(m('m3').y);
    expect(f.tab!.width).toBeGreaterThan(0);
  });

  it('lists drop slots for the top level and for each section', () => {
    expect(layout.slots.filter((s) => s.place.parent === null)).toHaveLength(data.steps.length + 1);
    expect(layout.slots.some((s) => s.place.parent?.section === 1)).toBe(true);
  });

  it('starts a created head at its row and ends a destroyed lifeline at its message', () => {
    const d: SequenceData = {
      participants: [{ id: 'a' }, { id: 'b' }],
      steps: [msg('m0', 'a', 'a', 'x'), { kind: 'create', participant: 'b' }, msg('m1', 'a', 'b', 'new'), { kind: 'destroy', participant: 'b' }, msg('m2', 'a', 'b', 'bye')],
    };
    const l = sequenceLayout(d);
    const head = l.heads.find((h) => h.id === 'b')!;
    expect(head.created).toBe(true);
    expect(head.box.y).toBeGreaterThan(l.heads.find((h) => h.id === 'a')!.box.y);
    const life = l.lifelines.find((x) => x.id === 'b')!;
    expect(life.destroyed).toBe(true);
    expect(life.y1).toBeCloseTo(l.messages.find((q) => q.id === 'm2')!.y);
  });

  it('steps a nested activation right', () => {
    const d: SequenceData = {
      participants: [{ id: 'a' }, { id: 'b' }],
      steps: [msg('m0', 'a', 'b'), { kind: 'activate', participant: 'b' }, msg('m1', 'a', 'b'), { kind: 'activate', participant: 'b' }],
    };
    const bars = sequenceLayout(d).activations.filter((a) => a.participant === 'b');
    expect(bars.map((b) => b.depth).sort()).toEqual([0, 1]);
    const [outer, inner] = [...bars].sort((p, q) => p.depth - q.depth);
    expect(inner!.box.x - outer!.box.x).toBe(SEQ.barStep);
  });

  it('numbers messages from autonumber and boxes participants', () => {
    const d: SequenceData = {
      participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], autonumber: 3,
      steps: [msg('m0', 'a', 'b'), msg('m1', 'b', 'c')],
      boxes: [{ id: 'x', label: 'Front', members: ['a', 'b'] }],
    };
    const l = sequenceLayout(d);
    expect(l.messages.map((q) => q.number?.n)).toEqual([3, 4]);
    const box = l.boxes[0]!.box;
    expect(box.x).toBeLessThan(l.columns[0]!.x);
    expect(box.x + box.width).toBeLessThan(l.columns[2]!.x);
    expect(l.boxes[0]!.label).toBeDefined();
  });
});

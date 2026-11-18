import { describe, it, expect, beforeEach } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { solid, solidStroke } from '@weasel-js/paint';
import { findNodeShape, type SceneNode as Node } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n',
    kind: 'mark',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('kit:text painter — rich runs', () => {
  const pose = { x: 10, y: 20, width: 100, height: 40 };
  const paintText = (data: unknown): DrawCommand[] => {
    const n = { ...node(data), pose };
    return findNodeShape(n)!.paint(n, pose);
  };

  it('paints a plain-text node as one unstyled run', () => {
    const [cmd] = paintText({ text: 'hi', style: { fontSize: 16 } });
    expect(cmd.kind).toBe('text');
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs).toHaveLength(1);
    expect(text.runs[0].text).toBe('hi');
  });

  it('paints the node\'s runs when it has them, not the flattened string', () => {
    // Without this the run algebra is write-only in the default scene layer:
    // a styled range commits to `data.runs` and paints as if it were never
    // styled, because the painter re-flattened `data.text`.
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 16 },
      runs: [{ text: 'a', bold: true }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs.map((r) => r.text)).toEqual(['a', 'b']);
    expect(text.runs[0].fontWeight).toBeGreaterThan(text.runs[1].fontWeight);
  });

  it('carries run-level decoration and tracking through to the command', () => {
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 16 },
      runs: [{ text: 'a', underline: true, letterSpacing: 2 }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs[0].underline).toBe(true);
    expect(text.runs[0].letterSpacing).toBe(2);
    expect(text.runs[1].underline).toBe(false);
  });

  it('falls back to the plain string when `runs` is empty', () => {
    const [cmd] = paintText({ text: 'hi', style: { fontSize: 16 }, runs: [] });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs.map((r) => r.text)).toEqual(['hi']);
  });

  // `kit:shape` and `kit:path` read the same `data.fill` / `data.stroke`.
  // Text reading them too is what makes a consumer's one set of paint
  // controls mean the same thing on a text node as on a rect, instead of
  // silently doing nothing.
  describe('kit-native paint fields', () => {
    it('paints the glyphs from data.fill', () => {
      const [cmd] = paintText({ text: 'hi', fill: { paint: solid('#7fb069') } });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs.every((r) => r.fill)).toEqual(true);
      expect(text.runs[0].fill).toEqual({ paint: solid('#7fb069') });
    });

    it('paints no glyph fill with no data.fill', () => {
      const [cmd] = paintText({ text: 'hi' });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs[0].fill ?? null).toBeNull();
    });

    it('a run fill overrides the node fill', () => {
      const [cmd] = paintText({
        text: 'ab',
        fill: { paint: solid('#7fb069') },
        runs: [{ text: 'a' }, { text: 'b', fill: { paint: solid('#d4a574') } }],
      });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs.map((r) => r.fill)).toEqual([{ paint: solid('#7fb069') }, { paint: solid('#d4a574') }]);
    });

    it('forwards data.verticalAlign onto the command, alongside the box height', () => {
      const [cmd] = paintText({ text: 'hi', verticalAlign: 'center' });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.verticalAlign).toBe('center');
      expect(text.height).toBe(pose.height);
    });

    it('leaves verticalAlign unset when the node does not name one', () => {
      const [cmd] = paintText({ text: 'hi' });
      expect((cmd as Extract<DrawCommand, { kind: 'text' }>).verticalAlign).toBeUndefined();
    });

    it('lifts data.stroke onto the runs whole', () => {
      const stroke = { paint: { color: '#f00' }, width: 3, cap: 'round' as const };
      const [cmd] = paintText({ text: 'hi', stroke });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs[0].stroke).toEqual(stroke);
    });

    it('takes solidStroke() for the color-and-width case', () => {
      const [cmd] = paintText({ text: 'hi', stroke: solidStroke('#f00') });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs[0].stroke).toEqual({ paint: { color: '#f00' }, width: 1 });
    });

    it('leaves the runs unstroked for stroke: null or no stroke at all', () => {
      for (const data of [
        { text: 'hi', stroke: null },
        { text: 'hi' },
      ]) {
        const [cmd] = paintText(data);
        expect((cmd as Extract<DrawCommand, { kind: 'text' }>).runs[0].stroke).toBeUndefined();
      }
    });

    it('a run stroke replaces the node stroke rather than merging', () => {
      const explicit = { paint: { color: '#00f' }, width: 8, join: 'round' as const };
      const [cmd] = paintText({
        text: 'ab',
        stroke: solidStroke('#f00', 3),
        runs: [{ text: 'a' }, { text: 'b', stroke: explicit }],
      });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs[1].stroke).toEqual(explicit);
    });

    it('reaches runs-form text too', () => {
      const [cmd] = paintText({
        text: 'ab', stroke: solidStroke('#f00', 2), runs: [{ text: 'a' }, { text: 'b' }],
      });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs.every((r) => r.stroke?.width === 2)).toBe(true);
    });
  });

  // A `TextDrawCommand`'s `y` is the top of the first line box — `layoutRuns`
  // walks *down* from it to the baseline (`common.base * scale`), and
  // `verticalAlign` aligns the block within `[y, y + height]`. The painter
  // used to pass `pose.y + fontSize`, as if `y` were a baseline, which put
  // every kit:text node's baseline about two ems below its box top and hung
  // the descenders outside the pose entirely. It also disagreed with
  // `createTextLayer` and with the DOM editing overlay, both of which anchor
  // on `pose.y` — so text jumped a whole line on commit.
  it('anchors the command on the pose box top, not a baseline', () => {
    for (const fontSize of [16, 48]) {
      const [cmd] = paintText({ text: 'hi', style: { fontSize } });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.x).toBe(pose.x);
      expect(text.y).toBe(pose.y);
      // The box forwarded for vertical alignment is the pose's own box.
      expect(text.height).toBe(pose.height);
    }
  });

  it('anchors runs-form text on the pose box top too', () => {
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 48 },
      runs: [{ text: 'a' }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.y).toBe(pose.y);
  });

  it('aligns within the pose width and wraps there only when the style says so', () => {
    const [cmd] = paintText({ text: 'hi', style: { fontSize: 16, align: 'center' } });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.width).toBe(pose.width);
    expect(text.maxWidth).toBe(Infinity);
    const [wrapped] = paintText({ text: 'hi', style: { fontSize: 16, wrap: true } });
    expect((wrapped as Extract<DrawCommand, { kind: 'text' }>).maxWidth).toBe(pose.width);
  });
});

describe('kit:text needs a rect pose', () => {
  const circleNode = <TData>(data: TData) =>
    ({ id: 'c', kind: 'mark', layer: 'default', pose: { cx: 0, cy: 0, r: 5 }, data, parent: null }) as never;

  it('does not hand a circle-posed text node to the text painter', () => {
    expect(findNodeShape(circleNode({ text: 'hi' }))?.id).not.toBe('kit:text');
  });

  it('re-matches when the same data gets a different kind of pose', () => {
    const data = { text: 'hi' };
    expect(findNodeShape(node(data))?.id).toBe('kit:text');
    expect(findNodeShape(circleNode(data))?.id).not.toBe('kit:text');
  });
});

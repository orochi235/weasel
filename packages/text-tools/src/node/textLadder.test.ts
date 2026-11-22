/** `kit:text` drops its glyphs, then itself, as it shrinks on screen: the engine picks the rung. */
import { describe, expect, it } from 'vitest';
import { createLodState, createLodWalk, defaultDrawOne, type SceneNode as Node } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import { withTextPainter } from '../testing/textPainter';
import { INHERIT } from '@weasel-js/paint';
import type { TextNodeData } from './textPainter';
import { paintGreekText } from './textLadder';

withTextPainter();

const node = {
  id: 't', kind: 'mark', layer: 'main', parent: null,
  pose: { x: 0, y: 0, width: 200, height: 60 },
  data: { text: 'Hello\nworld', style: { fontSize: 20 } },
} as unknown as Node<TextNodeData, string, RectPose>;

const view = (s: number) => ({ x: 0, y: 0, scale: { x: s, y: s } });

/** The rung chosen at `scale`, and what `defaultDrawOne` draws for it. */
function drawnAt(scale: number) {
  const walk = createLodWalk<typeof node, RectPose>({ dpr: 1 });
  const pick = walk.pick(node, node.pose, view(scale));
  const cmds = defaultDrawOne(node, node.pose, view(scale), { rung: pick?.rung, pixelScale: scale });
  return { rung: pick?.rung, kinds: JSON.stringify(cmds).match(/"kind":"(text|path|group)"/g) ?? [] };
}

describe('kit:text ladder', () => {
  it('draws nothing below 3 px of font size, bars to 6, and glyphs from there', () => {
    expect(drawnAt(0.1)).toEqual({ rung: 'none', kinds: [] });
    const greek = drawnAt(0.2);
    expect(greek.rung).toBe('greek');
    expect(greek.kinds).not.toContain('"kind":"text"');
    expect(greek.kinds.filter((k) => k === '"kind":"path"')).toHaveLength(2);
    const full = drawnAt(1);
    expect(full.rung).toBe('full');
    expect(full.kinds).toContain('"kind":"text"');
  });

  it('keeps its rung through a zoom parked on a threshold', () => {
    const state = createLodState();
    const rungs = new Set<string | undefined>();
    for (let f = 0; f < 100; f++) {
      const walk = createLodWalk<typeof node, RectPose>({ dpr: 1, state });
      // 20 units × 0.3 = 6 px, ±10%.
      rungs.add(walk.pick(node, node.pose, view(0.3 * (f % 2 === 0 ? 1.1 : 0.9)))?.rung);
      walk.end();
    }
    expect(rungs).toEqual(new Set(['full']));
  });

  it('keeps text sized in screen pixels in full at every zoom', () => {
    const px = { ...node, data: { ...node.data, style: { fontSize: { px: 12 } } } } as typeof node;
    const walk = createLodWalk<typeof node, RectPose>({ dpr: 1 });
    expect(walk.pick(px, px.pose, view(0.01))?.rung).toBe('full');
  });
});

describe('paintGreekText', () => {
  const solid = (color: string) => ({ fill: { paint: { kind: 'solid' as const, color } }, stroke: null });
  const barColors = (cmds: unknown) => JSON.stringify(cmds).match(/"color":"[^"]+"/g);

  it('repaints its bars when the paint it inherits changes', () => {
    const n = { data: { text: 'Hi', fill: INHERIT } };
    const pose = { x: 0, y: 0, width: 100, height: 40 };
    expect(barColors(paintGreekText(n, pose, solid('#ff0000')))).toEqual(['"color":"#ff0000"']);
    expect(barColors(paintGreekText(n, pose, solid('#0000ff')))).toEqual(['"color":"#0000ff"']);
  });
});

describe('paintGreekText frame', () => {
  it('draws the shadow and edge the full rung draws under its lines', () => {
    const d = {
      text: 'Hi', background: { paint: { kind: 'solid' as const, color: '#ffe680' } },
      edge: { width: 2, shade: 0.2 }, shadow: { x: 0, y: 4, blur: 8, alpha: 0.3 },
    };
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const cmds = paintGreekText({ data: d }, pose);
    expect(cmds.some((c) => c.kind === 'path' && c.stroke !== undefined)).toBe(true);
    expect(cmds[0]!.kind).toBe('group');
    expect(cmds).toHaveLength(4);
  });
});

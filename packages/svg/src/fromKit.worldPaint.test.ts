import { describe, it, expect } from 'vitest';
import { poseFrameOf, type Paint } from '@weasel-js/core';
import { svgLeafFromKit } from './fromKit';
import { applyMatrix } from './transform';
import type { SvgPathNode, SvgTextNode } from './types';

const world: Paint = {
  kind: 'linear-gradient', units: 'world', from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
  stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
} as Paint;
const rect = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } as const;
const BOX = { x: 10, y: 20, width: 100, height: 50 };

describe('a world-units paint on a posed leaf', () => {
  it('stays where the canvas holds it under a rotation', () => {
    const node = svgLeafFromKit({ path: rect, fill: { paint: world }, stroke: { paint: world, width: 2 } }, { ...BOX, rotation: Math.PI / 3 }) as SvgPathNode;
    expect(node.rotation ?? 0).toBe(0);
    expect(node.fill).toEqual({ kind: 'gradient', paint: world });
    expect(node.stroke?.paint).toEqual({ kind: 'gradient', paint: world });
  });

  it('stays where the canvas holds it under a skewing transform', () => {
    const node = svgLeafFromKit({ path: rect, fill: { paint: world } }, { ...BOX, transform: [1, 0.5, 0, 1] }) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'gradient', paint: world });
  });

  it('on text is taken back through the frame the text element is written under', () => {
    const pose = { ...BOX, rotation: Math.PI / 3, transform: [1.5, 0, 0, 1.5] as const };
    const node = svgLeafFromKit({ text: 'Hi', fill: { paint: world } }, pose) as SvgTextNode;
    const frame = poseFrameOf(pose)!;
    const p = (node.fill as { paint: { from: { x: number; y: number }; to: { x: number; y: number } } }).paint;
    const from = applyMatrix(frame, p.from.x, p.from.y);
    const to = applyMatrix(frame, p.to.x, p.to.y);
    expect(from.x).toBeCloseTo(0, 6);
    expect(from.y).toBeCloseTo(0, 6);
    expect(to.x).toBeCloseTo(100, 6);
    expect(to.y).toBeCloseTo(0, 6);
  });
});

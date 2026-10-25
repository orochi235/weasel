import { expect, vi } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import { contentBox, outlinePath } from '../outline';
import { stencilBuild, type DiagramStencil } from '../stencil';

type Box = { x: number; y: number; width: number; height: number };
type Built = { id: string; parent?: string | null; pose: Box; data: { diagram?: { outline?: unknown } } };

const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6
  && inner.x + inner.width <= outer.x + outer.width + 1e-6
  && inner.y + inner.height <= outer.y + outer.height + 1e-6;

/** The body and rows `stencil` builds on a click at the origin, as inserted nodes. */
export function builtNodes(stencil: DiagramStencil): Built[] {
  let n = 0;
  const { ops } = stencilBuild(stencil, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'main', newId: () => `${stencil.id}${++n}` });
  return ops.map((op) => (op.args as { node: Built }).node);
}

/** Every stencil names a registered outline, places at its own size, and lays its rows inside its content box. */
export function expectStencilsBuild(stencils: readonly DiagramStencil[]): void {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const stencil of stencils) {
    const [body, ...rows] = builtNodes(stencil);
    expect(body!.data.diagram?.outline, stencil.id).toBe(stencil.outline);
    expect(body!.pose, stencil.id).toMatchObject(stencil.size);
    const content = contentBox(stencil.outline, body!.pose);
    expect(rows.length, stencil.id).toBeGreaterThan(0);
    for (const row of rows) expect(inside(row.pose, content), `${stencil.id}'s row`).toBe(true);
    outlinePath(stencil.outline, body!.pose);
  }
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
}

/** The drawing of a figure stencil stands wholly above the strip its label lays out in. */
export function expectLabelUnder(stencil: DiagramStencil): void {
  const [body] = builtNodes(stencil);
  const drawn = boundsOfPath(outlinePath(stencil.outline, body!.pose));
  const content = contentBox(stencil.outline, body!.pose);
  expect(drawn.y + drawn.height, stencil.id).toBeLessThanOrEqual(content.y + 1e-6);
  expect(content.y + content.height, stencil.id).toBeCloseTo(body!.pose.y + body!.pose.height, 6);
}

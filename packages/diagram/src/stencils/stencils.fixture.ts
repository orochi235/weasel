/** The checks every stencil group's test runs on each of its stencils. */
import { expect, vi } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import type { MeasureRowText } from '../body';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import { contentBox, outlinePath } from '../outline';
import { resolveOutline } from '../outlines/table';
import { stencilBuild, type DiagramStencil } from '../stencil';

type Box = { x: number; y: number; width: number; height: number };
type Built = { id: string; parent?: string | null; pose: Box; data: { diagram?: { outline?: unknown }; text?: string } };

/** Roughly a 12px sans-serif's advance, and `canvasMeasure`'s line height, so a row too narrow for its text shows. */
export const measure: MeasureRowText = (text, s) => {
  const size = s.fontSize ?? 12;
  return { width: Math.ceil(text.length * size * (s.bold === true ? 0.62 : 0.56)), height: Math.ceil(size * 1.2) };
};

const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6
  && inner.x + inner.width <= outer.x + outer.width + 1e-6
  && inner.y + inner.height <= outer.y + outer.height + 1e-6;

/** The body and rows `stencil` builds on a click at the origin, as inserted nodes. */
export function builtNodes(stencil: DiagramStencil): Built[] {
  let n = 0;
  const { ops } = stencilBuild(stencil, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'main', newId: () => `${stencil.id}${++n}`, measure });
  return ops.map((op) => (op.args as { node: Built }).node);
}

/** Every shape stencil names a registered outline, places at its own size, and lays one node per text row
 *  inside its content box and wide enough for its text, with no warning on the way and a palette glyph. */
export function expectStencilsBuild(group: StencilGroup): void {
  const shapes = group.stencils.filter((s): s is DiagramStencil => !('role' in (s as ContainerStencil)));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const stencil of shapes) {
    const { outline } = stencil;
    if (typeof outline === 'string' && outline !== 'rect') {
      expect(resolveOutline(outline), `${stencil.id}: '${outline}' is registered`).not.toBe(resolveOutline('rect'));
    }
    const [body, ...rows] = builtNodes(stencil);
    expect(body!.data.diagram?.outline, stencil.id).toBe(outline);
    expect(body!.pose, stencil.id).toMatchObject(stencil.size);
    const textRows = (stencil.rows ?? [{ kind: 'label' }]).filter((r) => r.kind === 'label' || r.kind === 'field');
    expect(rows.length, `${stencil.id} builds one node per text row`).toBe(textRows.length);
    const content = contentBox(outline, body!.pose);
    for (const row of rows) {
      expect(inside(row.pose, content), `${stencil.id}'s row`).toBe(true);
      expect(measure(row.data.text ?? '', {}).width, `${stencil.id}'s row text`).toBeLessThanOrEqual(row.pose.width);
    }
    expect(stencil.icon, `${stencil.id}'s glyph`).toBeDefined();
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

/** The checks every stencil group's test runs on each of its stencils. */
import { expect } from 'vitest';
import { layoutBody, measureBody } from '../body';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import { contentBox } from '../outline';
import { resolveOutline } from '../outlines/table';
import { stencilBuild, type DiagramStencil } from '../stencil';

const DEFAULT_ROWS = [{ kind: 'label', text: '' }] as const;

/** Each shape stencil's outline names a registered outline, and its rows fit inside its content box at its
 *  default size, measured with the headless fallback; and `stencilBuild` makes its body and one node per row. */
export function expectStencilsBuild(group: StencilGroup): void {
  const shapes = group.stencils.filter((s): s is DiagramStencil => !('role' in (s as ContainerStencil)));
  for (const stencil of shapes) {
    const { outline } = stencil;
    if (typeof outline === 'string' && outline !== 'rect') {
      expect(resolveOutline(outline), `${stencil.id}: '${outline}' is registered`).not.toBe(resolveOutline('rect'));
    }
    const spec = { outline, rows: stencil.rows ?? DEFAULT_ROWS };
    const floor = measureBody(spec);
    expect(floor.minWidth, `${stencil.id} width`).toBeLessThanOrEqual(stencil.size.width);
    expect(floor.minHeight, `${stencil.id} height`).toBeLessThanOrEqual(stencil.size.height);
    let n = 0;
    const built = stencilBuild(stencil, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'shapes', newId: () => `n${n++}` });
    expect(built.ops.length, `${stencil.id} builds a body and its text rows`).toBe(1 + spec.rows.filter((r) => r.kind === 'label' || r.kind === 'field').length);
    const box = { x: 0, y: 0, ...stencil.size };
    const content = contentBox(outline, box);
    for (const row of layoutBody(spec, box)) {
      expect(row.x, `${stencil.id} row ${row.index}`).toBeGreaterThanOrEqual(content.x - 1e-9);
      expect(row.y, `${stencil.id} row ${row.index}`).toBeGreaterThanOrEqual(content.y - 1e-9);
      expect(row.x + row.width, `${stencil.id} row ${row.index}`).toBeLessThanOrEqual(content.x + content.width + 1e-9);
      expect(row.y + row.height, `${stencil.id} row ${row.index}`).toBeLessThanOrEqual(content.y + content.height + 1e-9);
    }
  }
}

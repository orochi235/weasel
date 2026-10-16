import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { balanceHandlesAction, equalizeHandlesAction } from '../balance/handleBalance';
import { SIMPLIFY_BRUSH_TOOL, simplifyBrushToolAction } from './simplifyBrush';

const run = (a: { invoker?: unknown }, deps: unknown) => (a.invoker as ImmediateInvoker).run(deps as never, undefined);

describe('the Simplify brush as a path-edit tool', () => {
  it('toggles the brush on and off from the anchors group', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    expect(simplifyBrushToolAction.id).toBe('pathEditTool.simplifyBrush');
    expect(simplifyBrushToolAction.group).toBe('anchors');
    run(simplifyBrushToolAction, deps);
    expect(dep.tool).toBe(SIMPLIFY_BRUSH_TOOL);
    run(simplifyBrushToolAction, deps);
    expect(dep.tool).toBeNull();
  });

  it('takes the balance grips out of the way while it is on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    dep.setTool(SIMPLIFY_BRUSH_TOOL);
    for (const a of [balanceHandlesAction, equalizeHandlesAction]) expect(a.enabled?.(deps), a.id).not.toBe(true);
    dep.setTool(null);
    for (const a of [balanceHandlesAction, equalizeHandlesAction]) expect(a.enabled?.(deps), a.id).toBe(true);
  });
});

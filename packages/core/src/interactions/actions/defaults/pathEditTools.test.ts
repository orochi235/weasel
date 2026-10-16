import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { editAnchorsAction } from '../edit-anchors/action';
import { bendSegmentAction } from './bendSegment';
import { marqueeAnchorsAction, selectAnchorAction } from './anchorEditing';
import { exitPathEditToolAction, pathEditToolAction } from './pathEditTools';
import { simplifyBrushToolAction } from './simplifyBrush';

const run = (a: { invoker?: unknown }, deps: unknown) => (a.invoker as ImmediateInvoker).run(deps as never, undefined);

describe('path-edit tools', () => {
  it('toggles its tool on and off, and reads as pressed while on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    expect(simplifyBrushToolAction.id).toBe('pathEditTool.simplifyBrush');
    expect(simplifyBrushToolAction.group).toBe('anchors');
    expect(simplifyBrushToolAction.active?.(deps)).toBe(false);
    run(simplifyBrushToolAction, deps);
    expect(dep.tool).toBe('simplifyBrush');
    expect(simplifyBrushToolAction.active?.(deps)).toBe(true);
    run(simplifyBrushToolAction, deps);
    expect(dep.tool).toBeNull();
  });

  it('switches from one tool straight to another', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const lengthen = pathEditToolAction('lengthen', 'Lengthen');
    run(simplifyBrushToolAction, { editAnchors: dep });
    run(lengthen, { editAnchors: dep });
    expect(dep.tool).toBe('lengthen');
  });

  it('puts the tool down on Escape, and lets Escape through with none on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    expect(exitPathEditToolAction.enabled?.(deps)).not.toBe(true);
    dep.setTool('simplifyBrush');
    expect(exitPathEditToolAction.enabled?.(deps)).toBe(true);
    run(exitPathEditToolAction, deps);
    expect(dep.tool).toBeNull();
  });

  it('takes plain anchor editing out of the way while a tool is on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    const plain = [editAnchorsAction, bendSegmentAction, marqueeAnchorsAction, selectAnchorAction];
    dep.setTool('simplifyBrush');
    for (const a of plain) expect(a.enabled?.(deps), a.id).not.toBe(true);
    dep.setTool(null);
    for (const a of [editAnchorsAction, marqueeAnchorsAction, selectAnchorAction]) {
      expect(a.enabled?.(deps), a.id).toBe(true);
    }
  });
});

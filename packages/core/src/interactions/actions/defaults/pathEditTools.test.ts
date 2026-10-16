import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { editAnchorsAction } from '../edit-anchors/action';
import { bendSegmentAction } from './bendSegment';
import { marqueeAnchorsAction, selectAnchorAction } from './anchorEditing';
import { exitPathEditToolAction, pathEditToolAction } from './pathEditTools';

const run = (a: { invoker?: unknown }, deps: unknown) => (a.invoker as ImmediateInvoker).run(deps as never, undefined);
const brush = pathEditToolAction('brush', 'Brush');

describe('path-edit tools', () => {
  it('toggles its tool on and off, and reads as pressed while on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    expect(brush.id).toBe('pathEditTool.brush');
    expect(brush.active?.(deps)).toBe(false);
    run(brush, deps);
    expect(dep.tool).toBe('brush');
    expect(brush.active?.(deps)).toBe(true);
    run(brush, deps);
    expect(dep.tool).toBeNull();
  });

  it('switches from one tool straight to another', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const lengthen = pathEditToolAction('lengthen', 'Lengthen');
    run(brush, { editAnchors: dep });
    run(lengthen, { editAnchors: dep });
    expect(dep.tool).toBe('lengthen');
  });

  it('puts the tool down on Escape, and lets Escape through with none on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    expect(exitPathEditToolAction.enabled?.(deps)).not.toBe(true);
    dep.setTool('brush');
    expect(exitPathEditToolAction.enabled?.(deps)).toBe(true);
    run(exitPathEditToolAction, deps);
    expect(dep.tool).toBeNull();
  });

  it('takes plain anchor editing out of the way while a tool is on', () => {
    const dep = makeEditAnchorsDep({ editingId: 'p1' });
    const deps = { editAnchors: dep } as never;
    const plain = [editAnchorsAction, bendSegmentAction, marqueeAnchorsAction, selectAnchorAction];
    dep.setTool('brush');
    for (const a of plain) expect(a.enabled?.(deps), a.id).not.toBe(true);
    dep.setTool(null);
    for (const a of [editAnchorsAction, marqueeAnchorsAction, selectAnchorAction]) {
      expect(a.enabled?.(deps), a.id).toBe(true);
    }
  });
});

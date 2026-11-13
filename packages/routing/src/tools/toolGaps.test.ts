import { describe, expect, it } from 'vitest';
import { defineTool } from './defineTool';
import { toolGaps } from './toolGaps';

const COMPLETE = {
  id: 'box', hookName: 'useBoxTool', cursor: 'crosshair',
  presentation: { label: 'Box', icon: 'core:rect' as never, group: 'shape' },
  bindings: [{ spec: { kind: 'drag' as const }, actionId: 'insert', opts: { id: 'box.drag' } }],
};

describe('toolGaps', () => {
  it('finds nothing missing from a complete tool', () => {
    expect(toolGaps(defineTool(COMPLETE))).toEqual([]);
  });

  it('names each field a tool leaves out', () => {
    const gaps = toolGaps(defineTool({ id: 'bare', bindings: [{ spec: { kind: 'click' }, actionId: 'x' }] }));
    expect(gaps).toEqual([
      'no presentation.label', 'no presentation.icon', 'no presentation.group', 'no cursor', 'no hookName',
      'a click binding to x has no id',
    ]);
    expect(toolGaps(defineTool({ id: 'idle' }))).toContain('no bindings');
  });

  it('asks no icon, group or cursor of a tool kept off palettes', () => {
    const held = defineTool({ ...COMPLETE, cursor: undefined, presentation: { label: 'Held', hide: true } });
    expect(toolGaps(held)).toEqual([]);
  });

  it('names a binding whose action is neither the tool\'s own nor registered', () => {
    const tool = defineTool(COMPLETE);
    expect(toolGaps(tool, () => false)).toEqual(['binding box.drag names unregistered action insert']);
    const own = defineTool({ ...COMPLETE, actions: [{ id: 'insert', label: 'Insert' }] });
    expect(toolGaps(own, () => false)).toEqual([]);
  });
});

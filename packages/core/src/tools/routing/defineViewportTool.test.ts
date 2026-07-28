import { describe, it, expect } from 'vitest';
import { defineViewportTool } from './defineViewportTool';
import type { ToolCtx } from '../types';

const CTX = { scratch: null } as unknown as ToolCtx<null>;

/**
 * `defineViewportTool` used to narrow the phase-table shape (no click routes,
 * drag restricted to the function form) and lift it back before delegating —
 * which is what the deleted half of this file exercised. With one grammar
 * there is nothing to narrow, so it delegates and survives as an authoring
 * signal that a tool moves the camera rather than the scene.
 */
describe('defineViewportTool', () => {
  it('produces a Tool with id', () => {
    expect(defineViewportTool({ id: 'hand' }).id).toBe('hand');
  });

  it('carries bindings and cursor through, same as defineTool', () => {
    const bindings = [{ spec: { kind: 'drag' as const }, actionId: 'viewport.dragPan' }];
    const tool = defineViewportTool<null>({ id: 'hand', cursor: 'grab', bindings });
    expect(tool.bindings).toBe(bindings);
    expect((tool.cursor as (c: ToolCtx<null>) => string)(CTX)).toBe('grab');
  });

  it('applies the same id validation', () => {
    expect(() => defineViewportTool({ id: 'initial' })).toThrow(/reserved phase keyword/);
  });
});

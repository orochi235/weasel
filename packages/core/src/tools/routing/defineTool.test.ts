// src/tools/routing/defineTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { defineTool } from './defineTool';
import type { RenderLayer } from '../../core/layers/render';
import type { ToolCtx } from '../types';

const CTX = { scratch: null } as unknown as ToolCtx<null>;

/**
 * `defineTool` used to be a compiler: it translated `initial` / `engaged`
 * phase tables of hit-keyed route handlers into the imperative pointer / drag
 * / keyboard / wheel channels the tool-routing dispatcher called, and most of
 * this file tested that translation — begin/hold/commit/cancel, engaged-phase
 * routing, `claimsAll`, per-target lookup. All of it went with the grammar.
 *
 * What's left is the id check, the cursor normalization, and pass-through.
 */
describe('defineTool', () => {
  it('produces a Tool with id and presentation', () => {
    const tool = defineTool({
      id: 'test',
      presentation: { label: 'Test', group: 'select' },
    });
    expect(tool.id).toBe('test');
    expect(tool.presentation?.label).toBe('Test');
  });

  it('normalizes a string cursor to the function form', () => {
    const tool = defineTool<null>({ id: 'test', cursor: 'crosshair' });
    expect(typeof tool.cursor).toBe('function');
    expect((tool.cursor as (c: ToolCtx<null>) => string)(CTX)).toBe('crosshair');
  });

  it('passes a function cursor through', () => {
    const tool = defineTool<null>({ id: 'test', cursor: () => 'grab' });
    expect((tool.cursor as (c: ToolCtx<null>) => string)(CTX)).toBe('grab');
  });

  it('resolves to the empty string when no cursor is declared', () => {
    const tool = defineTool<null>({ id: 'test' });
    expect((tool.cursor as (c: ToolCtx<null>) => string)(CTX)).toBe('');
  });

  it('forwards def.initScratch onto Tool.initScratch', () => {
    const scratch = { seen: true };
    const tool = defineTool({ id: 'test', initScratch: () => scratch });
    expect(tool.initScratch!()).toBe(scratch);
  });

  it('defaults initScratch to a null thunk', () => {
    const tool = defineTool<null>({ id: 'test' });
    expect(tool.initScratch!()).toBeNull();
  });

  it('forwards bindings, actions and overlay', () => {
    const overlay = { id: 'ov', draw: () => [] } as unknown as RenderLayer<unknown>;
    const action = { id: 'test.act', label: 'act', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    const bindings = [{ spec: { kind: 'click' as const }, actionId: 'test.act' }];
    const tool = defineTool({ id: 'test', overlay, actions: [action], bindings });
    expect(tool.overlay).toBe(overlay);
    expect(tool.actions).toEqual([action]);
    expect(tool.bindings).toBe(bindings);
  });

  it('attaches the authored def for reflection', () => {
    const def = { id: 'test', hookName: 'useTestTool' };
    const tool = defineTool(def);
    expect(tool.def).toBe(def);
  });

  describe('id validation', () => {
    it('rejects an empty id', () => {
      expect(() => defineTool({ id: '' })).toThrow(/may not be empty/);
    });

    it('rejects an id starting with a reserved sigil', () => {
      expect(() => defineTool({ id: '&self' })).toThrow(/reserved sigil/);
    });

    it('rejects an id that collides with a phase keyword', () => {
      expect(() => defineTool({ id: 'engaged' })).toThrow(/reserved phase keyword/);
    });
  });
});

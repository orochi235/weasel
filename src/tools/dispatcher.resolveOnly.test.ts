import { describe, it, expect } from 'vitest';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import { defineTool, claim } from './routing';
import type { AnyTool } from './types';
import type { HitResult } from './routing/hitResult';

function makeSelectTool(): AnyTool {
  return defineTool({
    id: 'select',
    presentation: { label: 'Select' },
    initial: {
      click: {
        rect: (_ctx) => claim(),
        '*': (_ctx) => claim(),
      },
    },
  }) as AnyTool;
}

function makeDispatcher(active: AnyTool | null, ambient: AnyTool[] = []): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => ({ hotkey: null, active, ambient }),
    getCtx: () => ({} as never),
  });
}

describe('ToolsDispatcher.resolveOnly', () => {
  it('returns the matched declarative route for an active tool', () => {
    const select = makeSelectTool();
    const d = makeDispatcher(select);
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1' as never, pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial',
      gesture: 'click',
      hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toEqual({
      toolId: 'select',
      slot: 'active',
      gesture: 'click',
      phase: 'initial',
      matchedKey: 'rect',
    });
  });

  it('walks slots in precedence order (hotkey > active > ambient)', () => {
    const hotkeyTool = defineTool({
      id: 'hand',
      presentation: { label: 'Hand' },
      initial: { click: { '*': (_c) => claim() } },
    }) as AnyTool;
    const active = makeSelectTool();
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: hotkeyTool, active, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1' as never, pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('hand');
    expect(result?.slot).toBe('hotkey');
    expect(result?.matchedKey).toBe('*');
  });

  it('falls through to ambient when active does not match', () => {
    const active = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: { text: (_c) => claim() } },
    }) as AnyTool;
    const ambient = makeSelectTool();
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active, ambient: [ambient] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1' as never, pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('select');
    expect(result?.slot).toBe('ambient');
  });

  it('returns null when no slot matches', () => {
    const active = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: { text: (_c) => claim() } },
    }) as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1' as never, pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toBeNull();
  });

  it('ignores tools without an attached def (imperative-only)', () => {
    const imperative: AnyTool = {
      id: 'imperative',
      pointer: { onClick: () => 'claim' as const },
    } as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: imperative, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1' as never, pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toBeNull();
  });

  it('honors engaged-phase tables when phase=engaged', () => {
    const pen = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: {} },
      engaged: { click: { '*': (_c) => claim() } },
    }) as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: pen, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'empty', kind: 'empty' };
    const result = d.resolveOnly({
      phase: 'engaged', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('pen');
    expect(result?.matchedKey).toBe('*');
  });
});

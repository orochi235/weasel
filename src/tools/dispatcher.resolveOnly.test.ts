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
});

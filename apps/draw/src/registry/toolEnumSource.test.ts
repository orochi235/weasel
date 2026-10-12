import { describe, expect, it } from 'vitest';
import type { ToolsApi } from '@weasel-js/core';
import { toolEnumSources } from './toolEnumSource';

const tools = {
  registry: {
    rect: { id: 'rect', presentation: { label: 'Rectangle', group: 'shape' } },
    hand: { id: 'hand' },
    ghost: { id: 'ghost', presentation: { hide: true } },
  },
} as unknown as ToolsApi;

describe('toolEnumSources', () => {
  it('lists each visible tool under its palette label, falling back to the id', () => {
    expect(toolEnumSources(tools).tools?.()).toEqual([
      { value: 'rect', label: 'Rectangle' },
      { value: 'hand', label: 'hand' },
    ]);
  });

  it('applies the pref filter to the tool', () => {
    expect(toolEnumSources(tools).tools?.((t) => (t as { id: string }).id === 'hand')).toEqual([
      { value: 'hand', label: 'hand' },
    ]);
  });

  it('has no source before the canvas has built its tools', () => {
    expect(toolEnumSources(null)).toEqual({});
  });
});

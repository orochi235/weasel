import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createToolOptionValues, setToolOption, toolOptionParams, toolOptionSlot } from '@weasel-js/routing';
import { toolOptionPaint, useRectTool } from '@weasel-js/core';
import { useStickyTool } from './sticky/useStickyTool';
import { useTextTool } from './text/useTextTool';

const tools = () => renderHook(() => ({
  rect: useRectTool(), text: useTextTool(), sticky: useStickyTool(),
})).result.current;

describe('the text tools’ style options', () => {
  it('keep a fill of text’s own kind, so a white shape fill never sets white text', () => {
    const t = tools();
    const values = createToolOptionValues();
    expect(toolOptionSlot('text', t.text.options!, 'fill')).toEqual({ owner: 'shared', key: 'textFill' });
    setToolOption('rect', t.rect.options!, values, 'fill', { color: '#ffffff' });
    expect(toolOptionParams('text', t.text.options!, values).fill).toEqual({ color: '#000000' });
  });

  it('default their colors in the one spelling every tool uses, black for the ink', () => {
    const t = tools();
    for (const [id, tool] of Object.entries({ text: t.text, sticky: t.sticky })) {
      for (const [key, leaf] of Object.entries(tool.options!.prefs.children)) {
        if ((leaf as { kind?: string }).kind !== 'paint') continue;
        const value = (leaf as { default: Parameters<typeof toolOptionPaint>[0] }).default;
        expect(value, `${id}.${key}`).toEqual(toolOptionPaint(value));
      }
    }
    const black = { color: '#000000' };
    expect(toolOptionParams('text', t.text.options!, undefined).fill).toEqual(black);
    expect(toolOptionParams('sticky', t.sticky.options!, undefined).ink).toEqual(black);
  });
});

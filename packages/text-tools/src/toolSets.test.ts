import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { TEXT_TOOLS, useTextToolsTools } from './toolSets';

describe('the text tool set', () => {
  it('groups text and the sticky note as type, which a palette places after the built-in groups', () => {
    expect(TEXT_TOOLS.id).toBe('type');
    expect(TEXT_TOOLS.members).toEqual(['text', 'sticky']);
    const { result } = renderHook(() => useTextToolsTools());
    expect(Object.values(result.current).map((t) => t.presentation?.group)).toEqual(['type', 'type']);
  });
});

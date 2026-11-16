import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStickyTool } from './sticky/useStickyTool';
import { useTextTool } from './text/useTextTool';

describe('text tool capabilities', () => {
  const cases: Array<[string, () => { eligibility?: { capabilities?: readonly string[] } }]> = [
    ['text', () => useTextTool()],
    ['sticky', () => useStickyTool()],
  ];

  for (const [name, hook] of cases) {
    it(`${name} declares capabilities: [creates-text]`, () => {
      const { result } = renderHook(hook);
      expect(result.current.eligibility?.capabilities).toEqual(['creates-text']);
    });
  }
});

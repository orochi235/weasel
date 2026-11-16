import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tool } from '@weasel-js/core';
import { anchorsTool } from './pathEdit/anchorsTool';
import { usePenTool } from './pen/usePenTool';
import { usePencilTool } from './pencil/usePencilTool';
import { useSliceTool } from './slice/useSliceTool';

describe('path-tools tool capabilities', () => {
  const cases: Array<[string, () => Tool, readonly string[]]> = [
    ['anchors', () => anchorsTool, ['edits-anchors']],
    ['pen', () => usePenTool(), ['creates-paths']],
    ['pencil', () => usePencilTool(), ['creates-paths']],
    ['slice', () => useSliceTool(), ['edits-page']],
  ];

  for (const [name, hook, expected] of cases) {
    it(`${name} declares capabilities: [${expected.join(', ')}]`, () => {
      const { result } = renderHook(hook);
      expect(result.current.eligibility?.capabilities).toEqual(expected);
    });
  }
});

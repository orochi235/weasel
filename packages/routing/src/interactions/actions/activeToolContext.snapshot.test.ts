import { describe, expect, it } from 'vitest';
import { ToolNode } from './activeToolContext';

describe('ToolNode.snapshot', () => {
  it('returns the same value on each call when no node in its chain owns a tool', () => {
    const node = new ToolNode(null, true, false, null);
    expect(node.snapshot()).toBe(node.snapshot());
  });
});

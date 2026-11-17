import { describe, expect, it } from 'vitest';
import { ConfigGroup, f, NumberNode } from './index';

describe('config node classes', () => {
  it('are exported as values', () => {
    expect(typeof NumberNode).toBe('function');
    expect(typeof ConfigGroup).toBe('function');
    expect(f.number(1)).toBeInstanceOf(NumberNode);
    expect(f.group({ n: f.number(1) })).toBeInstanceOf(ConfigGroup);
  });

  it('can be extended', () => {
    class Mine extends NumberNode {}
    const node = new Mine(2);
    expect(node).toBeInstanceOf(NumberNode);
    expect(node.default).toBe(2);
  });
});

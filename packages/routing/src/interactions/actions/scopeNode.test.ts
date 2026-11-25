import { describe, expect, it } from 'vitest';
import { ScopeNode } from './scopeNode';

class Node extends ScopeNode<Node> {}

describe('ScopeNode.leaf', () => {
  it('passes over an active yoke whose last canvas left, as it does one never pressed', () => {
    const root = new Node(null, true);
    const yoke = new Node(root, true);
    yoke.mount();
    const a = new Node(yoke, false);
    const leaveA = a.mount();
    const b = new Node(root, false);
    b.mount();
    a.activate();
    expect(root.leaf()).toBe(a);
    leaveA();
    expect(root.leaf()).toBe(b);
  });
});

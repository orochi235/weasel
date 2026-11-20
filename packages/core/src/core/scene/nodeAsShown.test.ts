import { describe, expect, it } from 'vitest';
import { nodeAsShown } from './nodeAsShown';
import { asNodeId } from './types';

const ID = asNodeId('n1');

describe('nodeAsShown', () => {
  const entry = { data: (stored: never) => ({ ...(stored as object), draft: true }) };
  const overrides = { read: () => entry };

  it('follows a pose or flag written onto the stored node in place', () => {
    const node: { id: typeof ID; data: object; pose: { x: number }; hidden?: boolean } = {
      id: ID, data: { label: 'a' }, pose: { x: 0 },
    };
    const first = nodeAsShown(overrides, node);
    expect(nodeAsShown(overrides, node)).toBe(first);
    node.pose = { x: 5 };
    expect(nodeAsShown(overrides, node).pose).toEqual({ x: 5 });
    node.hidden = true;
    expect(nodeAsShown(overrides, node).hidden).toBe(true);
    delete node.hidden;
    expect('hidden' in nodeAsShown(overrides, node)).toBe(false);
  });
});

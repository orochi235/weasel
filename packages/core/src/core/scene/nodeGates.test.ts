/**
 * The one answer to "is this node shown, and is it in reach": its own and its
 * ancestors' flags, and its layer's.
 */
import { describe, expect, it } from 'vitest';
import { isNodeHidden, isNodeLocked, nodeGates, type GateSource } from './nodeGates';
import { asNodeId } from './types';

interface N { id: string; layer: string; parent: string | null; hidden?: boolean; locked?: boolean }

function source(nodes: N[], layers: GateSource['layers'] = [{ id: 'a' }, { id: 'b' }]): GateSource {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { layers, get: (id) => byId.get(id) };
}

const id = asNodeId;

describe('nodeGates — hidden', () => {
  it('a node is shown by default', () => {
    const s = source([{ id: 'x', layer: 'a', parent: null }]);
    expect(isNodeHidden(s, id('x'))).toBe(false);
  });

  it('its own flag hides it', () => {
    const s = source([{ id: 'x', layer: 'a', parent: null, hidden: true }]);
    expect(isNodeHidden(s, id('x'))).toBe(true);
  });

  it('a hidden container hides its whole subtree', () => {
    const s = source([
      { id: 'g', layer: 'a', parent: null, hidden: true },
      { id: 'h', layer: 'a', parent: 'g' },
      { id: 'k', layer: 'b', parent: 'h' },
    ]);
    expect(isNodeHidden(s, id('k'))).toBe(true);
  });

  it('a hidden layer hides the nodes tagged to it, not the children tagged elsewhere', () => {
    const s = source(
      [{ id: 'g', layer: 'a', parent: null }, { id: 'k', layer: 'b', parent: 'g' }],
      [{ id: 'a', visible: false }, { id: 'b' }],
    );
    expect(isNodeHidden(s, id('g'))).toBe(true);
    expect(isNodeHidden(s, id('k'))).toBe(false);
  });

  it('only an explicit visible: false hides a layer', () => {
    const s = source([{ id: 'x', layer: 'a', parent: null }], [{ id: 'a' }]);
    expect(isNodeHidden(s, id('x'))).toBe(false);
  });

  it('an unknown id is not hidden', () => {
    expect(isNodeHidden(source([]), id('nope'))).toBe(false);
  });
});

describe('nodeGates — locked', () => {
  it('its own flag locks it, and a locked container locks its subtree', () => {
    const s = source([
      { id: 'g', layer: 'a', parent: null, locked: true },
      { id: 'k', layer: 'b', parent: 'g' },
      { id: 'free', layer: 'b', parent: null },
    ]);
    expect(isNodeLocked(s, id('g'))).toBe(true);
    expect(isNodeLocked(s, id('k'))).toBe(true);
    expect(isNodeLocked(s, id('free'))).toBe(false);
  });

  it('a locked layer locks every node under a node tagged to it', () => {
    const s = source(
      [{ id: 'g', layer: 'a', parent: null }, { id: 'k', layer: 'b', parent: 'g' }],
      [{ id: 'a', locked: true }, { id: 'b' }],
    );
    expect(isNodeLocked(s, id('k'))).toBe(true);
  });

  it('survives a parent cycle in a partial stand-in', () => {
    const s = source([{ id: 'p', layer: 'a', parent: 'q' }, { id: 'q', layer: 'a', parent: 'p' }]);
    expect(isNodeLocked(s, id('p'))).toBe(false);
    expect(isNodeHidden(s, id('p'))).toBe(false);
  });
});

describe('nodeGates — one read', () => {
  it('answers both questions for many nodes', () => {
    const s = source([
      { id: 'g', layer: 'a', parent: null, hidden: true, locked: true },
      { id: 'k1', layer: 'a', parent: 'g' },
      { id: 'k2', layer: 'a', parent: 'g' },
      { id: 'free', layer: 'a', parent: null },
    ]);
    const gates = nodeGates(s);
    expect(['k1', 'k2', 'free'].map((n) => gates.hidden(n))).toEqual([true, true, false]);
    expect(['k1', 'k2', 'free'].map((n) => gates.locked(n))).toEqual([true, true, false]);
  });

  it('a remembered ancestor answers for nodes below it and not for nodes above it', () => {
    const s = source(
      [
        { id: 'root', layer: 'a', parent: null },
        { id: 'mid', layer: 'b', parent: 'root', hidden: true },
        { id: 'leaf', layer: 'a', parent: 'mid' },
        { id: 'leaf2', layer: 'a', parent: 'mid' },
        { id: 'aunt', layer: 'a', parent: 'root' },
        { id: 'cousin', layer: 'a', parent: 'aunt' },
      ],
      [{ id: 'a' }, { id: 'b', locked: true }],
    );
    const gates = nodeGates(s);
    const order = ['leaf', 'cousin', 'aunt', 'leaf2', 'mid', 'root'];
    expect(order.map((n) => gates.hidden(n))).toEqual([true, false, false, true, true, false]);
    expect(order.map((n) => gates.locked(n))).toEqual([true, false, false, true, true, false]);
  });

  it('survives a parent cycle', () => {
    const s = source([
      { id: 'p', layer: 'a', parent: 'q' },
      { id: 'q', layer: 'a', parent: 'p', locked: true },
      { id: 'r', layer: 'a', parent: 'p' },
    ]);
    const gates = nodeGates(s);
    expect(['p', 'q', 'r'].map((n) => gates.hidden(n))).toEqual([false, false, false]);
    expect(['p', 'q', 'r'].map((n) => gates.locked(n))).toEqual([true, true, true]);
  });

  it('takes the node a walk holds as readily as its id, without looking it up', () => {
    const nodes: N[] = [
      { id: 'g', layer: 'a', parent: null, hidden: true, locked: true },
      { id: 'k', layer: 'b', parent: 'g' },
      { id: 'm', layer: 'b', parent: null },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let reads = 0;
    const gates = nodeGates({ layers: [{ id: 'a' }, { id: 'b' }], get: (n) => { reads++; return byId.get(n); } });
    expect([gates.hidden(byId.get('m')!), gates.locked(byId.get('m')!)]).toEqual([false, false]);
    expect(reads).toBe(0);
    expect([gates.hidden(byId.get('k')!), gates.locked(byId.get('k')!)]).toEqual([true, true]);
    expect([gates.hidden('k'), gates.locked('k')]).toEqual([true, true]);
  });
});

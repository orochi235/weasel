import { describe, it, expect } from 'vitest';
import type {
  HitResult,
  EmptyHit as _EmptyHit,
  NodeHit as _NodeHit,
  AffordanceHit as _AffordanceHit,
  NodeRef as _NodeRef,
  NodeRefHit,
} from './hitResult';
import { asNodeId } from '../../core/scene/types';

describe('HitResult shapes', () => {
  it('EmptyHit narrows by category', () => {
    const h: HitResult = { category: 'empty', kind: 'empty' };
    if (h.category === 'empty') {
      const _kind: 'empty' = h.kind;
      expect(_kind).toBe('empty');
    }
  });

  it('NodeHit carries id / pose / data', () => {
    const h: HitResult = {
      category: 'node',
      kind: 'rect',
      id: asNodeId('a'),
      pose: { x: 0, y: 0, width: 1, height: 1 },
      data: { fill: 'red' },
    };
    if (h.category === 'node') {
      expect(h.id).toBe('a');
      expect(h.kind).toBe('rect');
    }
  });

  it('AffordanceHit carries id pointing at the affected node', () => {
    const h: HitResult = {
      category: 'affordance',
      kind: 'handle:bottom-right',
      id: asNodeId('a'),
      pose: { x: 0, y: 0, width: 1, height: 1 },
      data: { fill: 'red' },
      meta: { handle: 'bottom-right' },
    };
    if (h.category === 'affordance') {
      expect(h.id).toBe('a');
      expect(h.meta?.handle).toBe('bottom-right');
    }
  });

  it('NodeRefHit alias covers node + affordance, excludes empty', () => {
    const node: NodeRefHit = {
      category: 'node',
      kind: 'rect',
      id: asNodeId('a'),
      pose: {},
      data: {},
    };
    const aff: NodeRefHit = {
      category: 'affordance',
      kind: 'handle:bottom-right',
      id: asNodeId('a'),
      pose: {},
      data: {},
    };
    expect(node.id).toBe('a');
    expect(aff.id).toBe('a');
  });
});

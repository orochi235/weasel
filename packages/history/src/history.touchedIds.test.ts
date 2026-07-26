import { describe, it, expect } from 'vitest';
import { createHistory, touchedIdsFromOps } from './history';
import type { Op } from './op';

// ---------------------------------------------------------------------------
// Minimal op factories for tests — carry id/node.id in args so touchedIds
// extraction can find them, but don't need a real adapter.
// ---------------------------------------------------------------------------

function idOp(id: string): Op {
  return {
    name: 'test:idOp',
    args: { id },
    apply: () => {},
    invert: () => idOp(id),
  };
}

function nodeOp(id: string): Op {
  return {
    name: 'test:nodeOp',
    args: { node: { id }, index: 0 },
    apply: () => {},
    invert: () => nodeOp(id),
  };
}

function noIdOp(): Op {
  return {
    name: 'test:noId',
    args: { value: 42 },
    apply: () => {},
    invert: noIdOp,
  };
}

// ---------------------------------------------------------------------------
// touchedIdsFromOps unit tests
// ---------------------------------------------------------------------------

describe('touchedIdsFromOps', () => {
  it('extracts id from ops with args.id', () => {
    const result = touchedIdsFromOps([idOp('a'), idOp('b')]);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('extracts id from ops with args.node.id', () => {
    const result = touchedIdsFromOps([nodeOp('x')]);
    expect(result.has('x')).toBe(true);
  });

  it('ignores ops with no recognisable id field', () => {
    const result = touchedIdsFromOps([noIdOp()]);
    expect(result.size).toBe(0);
  });

  it('handles mixed op batches', () => {
    const result = touchedIdsFromOps([idOp('a'), noIdOp(), nodeOp('b')]);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('deduplicates the same id from multiple ops', () => {
    const result = touchedIdsFromOps([idOp('a'), idOp('a')]);
    expect(result.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// History.entries() touchedIds integration tests
// ---------------------------------------------------------------------------

describe('History entries touchedIds', () => {
  it('entries.undo includes touchedIds computed from ops', () => {
    const h = createHistory({});
    h.applyOps([idOp('node-1'), idOp('node-2')], 'Move two');
    const { undo } = h.entries();
    expect(undo).toHaveLength(1);
    expect(undo[0].touchedIds?.has('node-1')).toBe(true);
    expect(undo[0].touchedIds?.has('node-2')).toBe(true);
  });

  it('recordEntry also populates touchedIds', () => {
    const h = createHistory({});
    h.recordEntry([idOp('n'), nodeOp('m')], 'batch');
    const { undo } = h.entries();
    expect(undo[0].touchedIds?.has('n')).toBe(true);
    expect(undo[0].touchedIds?.has('m')).toBe(true);
  });

  it('entries without recognisable ids have an empty touchedIds set', () => {
    const h = createHistory({});
    h.applyOps([noIdOp()], 'no-id batch');
    const { undo } = h.entries();
    expect(undo[0].touchedIds?.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { drawKindLabel, effectNodeName } from './nodeKinds';

describe('effectNodeName', () => {
  it('names a known effect by its settings section', () => {
    expect(effectNodeName({ pathEffect: { kind: 'zigzag' } })).toBe(drawKindLabel('zigzag'));
  });

  it('answers undefined for an effect kind this build does not know, rather than throwing', () => {
    expect(effectNodeName({ pathEffect: { kind: 'fromTheFuture' } })).toBeUndefined();
  });

  it('does not take a settings leaf that is not an effect section as an effect name', () => {
    expect(effectNodeName({ pathEffect: { kind: 'zigzags' } })).toBeUndefined();
    expect(drawKindLabel('zigzags')).toBe('Zigzags');
  });

  it('does not find an Object.prototype member as an effect name', () => {
    expect(effectNodeName({ pathEffect: { kind: 'toString' } })).toBeUndefined();
    expect(effectNodeName({ pathEffect: { kind: 'constructor' } })).toBeUndefined();
  });

  it('answers undefined for a node with no effect', () => {
    expect(effectNodeName({ label: 'x' })).toBeUndefined();
  });
});

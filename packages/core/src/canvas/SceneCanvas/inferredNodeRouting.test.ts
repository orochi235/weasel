import { describe, it, expect } from 'vitest';
import { inferredNodeRouting, defaultNodeRouting } from './defaultNodeRouting';
import { createNodeRouting } from 'core/scene/NodeRouting';

describe('inferredNodeRouting', () => {
  function classify(data: unknown): string {
    const r = createNodeRouting();
    for (const k of inferredNodeRouting) r.register(k);
    return r.classify(data);
  }

  it('infers "text" from data.text string', () => {
    expect(classify({ text: 'hello' })).toBe('text');
  });

  it('infers "path" from data.path presence', () => {
    expect(classify({ path: { kind: 'polygon' } })).toBe('path');
  });

  it('text wins over path when both present (SVG import with text fallback)', () => {
    expect(classify({ text: 'hi', path: { kind: 'polygon' } })).toBe('text');
  });

  it('infers "image" from data.image presence', () => {
    expect(classify({ image: { src: 'foo.png' } })).toBe('image');
  });

  it('returns "unknown" for unrecognized data shape', () => {
    expect(classify({ color: '#fff' })).toBe('unknown');
  });

  it('does not match objects with text === null/undefined', () => {
    expect(classify({ text: null })).toBe('unknown');
    expect(classify({ text: undefined })).toBe('unknown');
  });

  it('defaultNodeRouting still matches by data.kind tag', () => {
    const r = createNodeRouting();
    for (const k of defaultNodeRouting) r.register(k);
    expect(r.classify({ kind: 'rect' })).toBe('rect');
    expect(r.classify({ kind: 'pen' })).toBe('pen');
  });
});

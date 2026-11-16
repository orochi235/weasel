import { describe, it, expect } from 'vitest';
import { createNodeRouting, inferredNodeRouting } from '@weasel-js/core';
import { textNodeRouting } from './presets';

/** The routing a canvas given `textPreset` classifies by: text ahead of the canvas's own. */
function classify(data: unknown, node?: { kind: string; children?: string[] }): string {
  const r = createNodeRouting();
  for (const k of [textNodeRouting, ...inferredNodeRouting]) r.register(k);
  return r.classify(data, node as never);
}

describe('textNodeRouting', () => {
  it('routes a node whose data.text is a string as "text"', () => {
    expect(classify({ text: 'hello' })).toBe('text');
    expect(classify({ text: '' })).toBe('text');
  });

  it('wins over path when both are present (SVG import with text fallback)', () => {
    expect(classify({ text: 'hi', path: { kind: 'polygon' } })).toBe('text');
  });

  it('does not match text that is null or undefined', () => {
    expect(classify({ text: null })).toBe('unknown');
    expect(classify({ text: undefined })).toBe('unknown');
  });

  it('routes a mark with children by its text', () => {
    expect(classify({ text: 'hi' }, { kind: 'mark', children: ['c'] })).toBe('text');
  });

  it('routes a container as a group whatever its data', () => {
    expect(classify({ text: 'hi' }, { kind: 'group' })).toBe('group');
  });
});

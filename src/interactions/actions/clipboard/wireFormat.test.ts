import { describe, expect, it } from 'vitest';
import { WEASEL_CLIPBOARD_MIME, buildWeaselClipboardText, sniffWeaselClipboardText, parseWeaselClipboardText } from './wireFormat';

describe('weasel clipboard wire format', () => {
  it('round-trips items through build/parse', () => {
    const items = [{ id: 'a', pose: { x: 1 }, data: { fill: '#fff' } }];
    const text = buildWeaselClipboardText(items);
    expect(text.includes(WEASEL_CLIPBOARD_MIME)).toBe(false); // MIME is a header value, not wire content
    expect(sniffWeaselClipboardText(text)).toBe(true);
    expect(parseWeaselClipboardText(text)).toEqual(items);
  });

  it('applies replacer and reviver', () => {
    const items = [{ id: 'a', buf: new Float32Array([1, 2]) }];
    const replacer = (_k: string, v: unknown) =>
      v instanceof Float32Array ? { $f32: Array.from(v) } : v;
    const reviver = (_k: string, v: unknown) =>
      v && typeof v === 'object' && '$f32' in (v as object)
        ? new Float32Array((v as { $f32: number[] }).$f32) : v;
    const text = buildWeaselClipboardText(items, replacer);
    const out = parseWeaselClipboardText(text, reviver) as Array<{ buf: Float32Array }>;
    expect(out[0].buf).toBeInstanceOf(Float32Array);
    expect(Array.from(out[0].buf)).toEqual([1, 2]);
  });

  it('sniff rejects near-misses', () => {
    expect(sniffWeaselClipboardText('{"nodes":[]}')).toBe(false);              // no marker
    expect(sniffWeaselClipboardText('the word weaselClipboard in prose')).toBe(false); // not JSON
    expect(sniffWeaselClipboardText('{"weaselClipboard":2,"nodes":[]}')).toBe(false);  // wrong version
    expect(parseWeaselClipboardText('{"weaselClipboard":1}')).toBeNull();      // nodes missing
  });

  it('drops function-valued fields (e.g. a container clipFromPose) and still parses back without them', () => {
    const items = [
      { id: 'a', kind: 'container', clipFromPose: (p: unknown) => p, data: { fill: '#fff' } },
    ];
    const text = buildWeaselClipboardText(items);
    expect(sniffWeaselClipboardText(text)).toBe(true);
    const parsed = parseWeaselClipboardText(text) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect('clipFromPose' in parsed[0]).toBe(false);
    expect(parsed[0]).toEqual({ id: 'a', kind: 'container', data: { fill: '#fff' } });
  });
});

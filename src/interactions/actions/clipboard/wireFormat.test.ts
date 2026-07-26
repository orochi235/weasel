import { describe, expect, it } from 'vitest';
import {
  WEASEL_CLIPBOARD_MIME,
  buildWeaselClipboardText,
  sniffWeaselClipboardText,
  parseWeaselClipboardText,
  embedWeaselMetadataInSvg,
  extractWeaselClipboardFromSvg,
} from './wireFormat';

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

  describe('embedWeaselMetadataInSvg / extractWeaselClipboardFromSvg', () => {
    const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

    it('round-trips a payload containing <, &, and unicode', () => {
      const payload = buildWeaselClipboardText([
        { id: 'a', data: { label: '<b>&amp; — ünïcode ✂️</b>' } },
      ]);
      const embedded = embedWeaselMetadataInSvg(SVG, payload);
      expect(extractWeaselClipboardFromSvg(embedded)).toBe(payload);
    });

    it('round-trips a payload containing a literal ]]> (CDATA split + rejoin)', () => {
      const payload = buildWeaselClipboardText([{ id: 'a', data: { label: 'end]]>of cdata' } }]);
      expect(payload).toContain(']]>');
      const embedded = embedWeaselMetadataInSvg(SVG, payload);
      // The split discipline: no raw ]]> may terminate a CDATA section early.
      expect(embedded).toContain(']]]]><![CDATA[>');
      expect(extractWeaselClipboardFromSvg(embedded)).toBe(payload);
    });

    it('inserts the metadata element immediately after the opening <svg ...> tag', () => {
      const payload = buildWeaselClipboardText([{ id: 'a' }]);
      const embedded = embedWeaselMetadataInSvg(SVG, payload);
      expect(embedded.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><metadata>')).toBe(true);
      expect(embedded.endsWith('<rect width="10" height="10"/></svg>')).toBe(true);
    });

    it('returns tagless input unchanged (decline path)', () => {
      const payload = buildWeaselClipboardText([{ id: 'a' }]);
      expect(embedWeaselMetadataInSvg('not an svg at all', payload)).toBe('not an svg at all');
      expect(embedWeaselMetadataInSvg('<svgg bogus="1">', payload)).toBe('<svgg bogus="1">');
    });

    it('extract returns null for SVG without metadata', () => {
      expect(extractWeaselClipboardFromSvg(SVG)).toBeNull();
    });

    it('extract returns null for metadata without the weasel marker', () => {
      const svg = '<svg xmlns="x"><metadata><rdf:RDF>dublin core stuff</rdf:RDF></metadata></svg>';
      expect(extractWeaselClipboardFromSvg(svg)).toBeNull();
      const cdata = '<svg xmlns="x"><metadata><![CDATA[{"nodes":[]}]]></metadata></svg>';
      expect(extractWeaselClipboardFromSvg(cdata)).toBeNull();
    });

    it('extract returns null for non-SVG text', () => {
      expect(extractWeaselClipboardFromSvg('plain prose')).toBeNull();
      expect(extractWeaselClipboardFromSvg(buildWeaselClipboardText([{ id: 'a' }]))).toBeNull();
    });

    it('extract rejoins multiple CDATA sections into one payload', () => {
      const svg = '<svg><metadata><![CDATA[{"weaselClipboard":1,]]><![CDATA["nodes":[]}]]></metadata></svg>';
      expect(extractWeaselClipboardFromSvg(svg)).toBe('{"weaselClipboard":1,"nodes":[]}');
    });

    it('extract tolerates plain (non-CDATA) metadata content, still gated by the sniff', () => {
      const payload = '{"weaselClipboard":1,"nodes":[]}';
      const svg = `<svg><metadata>${payload}</metadata></svg>`;
      expect(extractWeaselClipboardFromSvg(svg)).toBe(payload);
    });
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

import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg } from './index';
import * as F from './__fixtures__/fixtures';

describe('round-trip', () => {
  it('generic namespace pass-through: two declared namespaces stay isolated', () => {
    const namespaces = {
      foo: 'https://example.com/foo',
      bar: 'https://example.com/bar',
    };
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces });
    expect(first.warnings).toEqual([]);

    // Document-level: each prefix has its own attrs bucket.
    expect(first.documentMeta?.foo?.attrs?.rootAttr).toBe('alpha');
    expect(first.documentMeta?.bar?.attrs?.rootAttr).toBe('beta');
    // Document-level: foo has a <registry> element with two <item> children;
    // bar has no document-level elements.
    expect(first.documentMeta?.foo?.elements?.registry).toBeDefined();
    expect(first.documentMeta?.foo?.elements!.registry[0].children?.item).toHaveLength(2);
    expect(first.documentMeta?.foo?.elements!.registry[0].children!.item[0].attrs.id).toBe('a');
    expect(first.documentMeta?.bar?.elements).toBeUndefined();

    // Per-element: <g> has foo:group + bar:tag; the inner <path> has foo:annotation.
    const g = first.nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    expect(g.meta?.foo?.attrs?.group).toBe('g1');
    expect(g.meta?.bar?.attrs?.tag).toBe('left');
    const leaf = g.children[0];
    expect(leaf.meta?.foo?.attrs?.annotation).toBe('leaf');

    // Serialize back: prefixes survive, attribute values survive, the
    // <registry> sub-tree comes back. Undeclared namespaces would be
    // silently dropped — but we declared both.
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:foo="https://example.com/foo"');
    expect(out).toContain('xmlns:bar="https://example.com/bar"');
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).toContain('bar:rootAttr="beta"');
    expect(out).toContain('foo:group="g1"');
    expect(out).toContain('bar:tag="left"');
    expect(out).toContain('foo:annotation="leaf"');
    expect(out).toContain('<foo:registry>');
    expect(out).toContain('<foo:item id="a" name="Alpha"');

    // Second parse equals first parse on every namespaced field.
    const second = parseSvg(out, { namespaces });
    expect(second.documentMeta).toEqual(first.documentMeta);
    const g2 = second.nodes[0];
    if (g2.kind !== 'group') throw new Error('expected group');
    expect(g2.meta).toEqual(g.meta);
    expect(g2.children[0].meta).toEqual(leaf.meta);
  });

  it('document-level metadata: viewBox, wd:paperSize, wd:units, title', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.WEASELDRAW_MINIMAL_SVG, { namespaces });
    expect(first.viewBox).toEqual({ x: 0, y: 0, width: 816, height: 1056 });
    expect(first.documentMeta?.wd?.attrs?.paperSize).toBe('letter');
    expect(first.documentMeta?.wd?.attrs?.units).toBe('px');
    expect(first.title).toBe('My Doc');

    const out = serializeSvg(first.nodes, {
      viewBox: first.viewBox,
      width: first.viewBox!.width,
      height: first.viewBox!.height,
      title: first.title,
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:wd="https://weaseldraw.app/svg-ext"');
    expect(out).toContain('width="816"');
    expect(out).toContain('height="1056"');
    expect(out).toContain('wd:paperSize="letter"');
    expect(out).toContain('wd:units="px"');
    expect(out).toContain('<title>My Doc</title>');

    const second = parseSvg(out, { namespaces });
    expect(second.viewBox).toEqual(first.viewBox);
    expect(second.documentMeta?.wd?.attrs?.paperSize).toBe('letter');
    expect(second.title).toBe('My Doc');
  });

  it('generic namespace pass-through: undeclared namespaces are dropped on serialize', () => {
    // Parse declaring only `foo`. The `bar:*` content lives in the source
    // XML DOM but is not promoted into `meta`. When we re-serialize, the
    // bar attributes vanish — there is no `meta.bar` for the writer to find.
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces: { foo: 'https://example.com/foo' } });
    expect(first.documentMeta?.foo).toBeDefined();
    expect(first.documentMeta?.bar).toBeUndefined();
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces: { foo: 'https://example.com/foo' },
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).not.toContain('bar:rootAttr');
    expect(out).not.toContain('xmlns:bar');
  });
});

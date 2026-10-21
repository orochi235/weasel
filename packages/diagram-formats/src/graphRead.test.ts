import { describe, expect, it } from 'vitest';
import { Membership, Warnings, decodeEntities, markupLines, withEdgeIds } from './graphRead';

describe('Warnings', () => {
  it('keeps each warning once, and gathers a list warning into one sentence', () => {
    const w = new Warnings();
    w.add('One.');
    w.list('Dropped', 'a');
    w.add('One.');
    w.list('Dropped', 'b');
    w.list('Dropped', 'a');
    expect(w.all()).toEqual(['One.', 'Dropped: a, b.']);
  });
});

describe('text', () => {
  it('decodes named and numbered references, and Mermaid\'s hash spelling when asked', () => {
    expect(decodeEntities('&lt;a&gt; &amp; &#65;&#x42; &bogus;')).toBe('<a> & AB &bogus;');
    expect(decodeEntities('#quot;hi#quot; #35; #9829;', true)).toBe('"hi" # ♥');
    expect(decodeEntities('#quot;', false)).toBe('#quot;');
  });

  it('reads markup as lines, breaking at <br> and dropping tags', () => {
    expect(markupLines('<b>Bold</b> text<br/>next <i>line</i>')).toEqual(['Bold text', 'next line']);
  });
});

describe('Membership', () => {
  it('keeps a node in the first cluster to name it, moving it only deeper', () => {
    const w = new Warnings();
    const m = new Membership(w, 'DOT');
    m.openCluster('outer', null);
    m.openCluster('inner', 'outer');
    m.openCluster('other', null);
    m.place('a', null);
    m.place('a', 'outer');
    m.place('a', 'inner');
    m.place('a', 'outer');
    m.place('b', 'outer');
    m.place('b', 'other');
    expect(m.members('outer')).toEqual(['b', 'inner']);
    expect(m.members('inner')).toEqual(['a']);
    expect(w.all()).toEqual(['DOT nodes in two clusters, kept in the first: b.']);
  });
});

describe('withEdgeIds', () => {
  it('names each edge by its ends, numbering repeats and skipping taken ids', () => {
    const edges = withEdgeIds([{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }], ['b-c']);
    expect(edges.map((e) => e.id)).toEqual(['a-b', 'a-b-2', 'b-c-2']);
  });
});

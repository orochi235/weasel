import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SankeyData } from '@weasel-js/plot';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { csvFields, readMermaidSankey } from './read';
import { writeMermaidSankey } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'sankey', name), 'utf8');
const plotOf = (text: string) => readMermaidSankey(text).document.pages[0] as PlotPage;
const pageOf = (data: SankeyData): PlotPage => ({ kind: 'plot', id: 'p', width: 10, height: 10, data });

describe('reading a Mermaid sankey', () => {
  it('reads each row as a link, titled by the front matter', () => {
    const { document, warnings } = readMermaidSankey(fixture('energy.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Energy flows (TWh)', width: 900, height: 540 });
    const data = page.data as SankeyData;
    expect(data.title).toBe('Energy flows (TWh)');
    expect(data.links).toHaveLength(21);
    expect(data.links[0]).toEqual({ source: 'Agricultural \'waste\'', target: 'Bio-conversion', value: 124.729 });
    expect(data.links[11]).toEqual({ source: 'District heating', target: 'Heating and cooling, commercial', value: 22.505 });
    expect(data.links[20]).toEqual({ source: 'Say "hi"', target: 'Industry', value: 0 });
    expect(warnings).toEqual([]);
  });

  it('reads RFC 4180 quoting', () => {
    expect(csvFields('a, "b, c" ,"d ""e"""', 1)).toEqual(['a', 'b, c', 'd "e"']);
    expect(csvFields('a,,1', 1)).toEqual(['a', '', '1']);
    expect(plotOf('sankey\nx,y,2').data).toEqual({ kind: 'sankey', links: [{ source: 'x', target: 'y', value: 2 }] });
  });

  it('warns on what it drops', () => {
    expect(readMermaidSankey('%%{init: {}}%%\nsankey-beta\naccDescr: flows\na,b,1').warnings).toEqual([
      'Mermaid configuration directives were dropped.',
      'Mermaid accessible descriptions were dropped.',
    ]);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidSankey('sankey-beta\n\na,b,-1')).toThrow('Mermaid, line 3: "-1" is not a flow; it is a number not below zero');
    expect(() => readMermaidSankey('sankey-beta\na,b,lots')).toThrow('Mermaid, line 2: "lots" is not a flow; it is a number not below zero');
    expect(() => readMermaidSankey('sankey-beta\na,b')).toThrow('Mermaid, line 2: a row is source,target,value; this one has 2 field(s)');
    expect(() => readMermaidSankey('sankey-beta\n"a,b,1')).toThrow('Mermaid, line 2: a quoted field is never closed');
    expect(() => readMermaidSankey('sankey-beta\n"a"x,b,1')).toThrow(/line 2: "x,b,1" follows a quoted field/);
    expect(() => readMermaidSankey('sankey-alpha')).toThrow(/line 1: "sankey-alpha" is not a sankey header/);
  });
});

describe('writing a Mermaid sankey', () => {
  it('round-trips the fixture', () => {
    const page = plotOf(fixture('energy.mmd'));
    const { text, warnings } = writeMermaidSankey(page);
    expect(warnings).toEqual([]);
    expect(plotOf(text).data).toEqual(page.data);
  });

  it('writes plainly, quoting what needs it', () => {
    const data: SankeyData = {
      kind: 'sankey', title: 'Flows',
      links: [{ source: 'a b', target: 'c, d', value: 1.5 }, { source: 'Say "hi"', target: '%% no', value: 2 }, { source: ' pad', target: 'accTitle: x', value: 0 }],
    };
    const { text } = writeMermaidSankey(pageOf(data));
    expect(text).toBe([
      '---', 'title: "Flows"', '---', 'sankey-beta', '',
      'a b,"c, d",1.5', '"Say ""hi""","%% no",2', '" pad","accTitle: x",0', '',
    ].join('\n'));
    expect(plotOf(text).data).toEqual(data);
  });

  it('warns on what Mermaid cannot hold', () => {
    const { text, warnings } = writeMermaidSankey(pageOf({ kind: 'sankey', links: [{ source: 'a', target: 'b', value: -3 }] }));
    expect(text).toBe('sankey-beta\n\na,b,0\n');
    expect(warnings).toEqual(['Mermaid holds flows of zero or more; others were written as 0.']);
    expect(() => writeMermaidSankey({ ...pageOf({ kind: 'sankey', links: [] }), data: { kind: 'pie', slices: [] } as never })).toThrow(/as a sankey only/);
  });
});

describe('the Mermaid format', () => {
  it('reads a sankey by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('energy.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('sankey');
    expect(DIAGRAM_MERMAID.detect(fixture('energy.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text).toMatch(/^---\ntitle: "Energy flows \(TWh\)"\n---\nsankey-beta\n/);
  });
});

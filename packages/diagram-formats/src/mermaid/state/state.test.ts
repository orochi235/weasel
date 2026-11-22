import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { documentSpecs } from '../../toScene';
import { parseStateDiagram } from './parse';
import { readStateDiagram } from './read';
import { writeStateDiagram } from './write';

const DOOR = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'state', 'door.mmd'), 'utf8');
const page = (text: string) => onlyPage(readStateDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id) as DataNode;
const edges = (text: string) => page(text).data.edges.map((e) => [e.from, e.to, e.label]);

describe('reading a Mermaid state diagram', () => {
  it('reads a page of notation state', () => {
    expect(page(DOOR)).toMatchObject({ name: 'Door controller', notation: 'state' });
    expect(page('stateDiagram\n[*] --> A').notation).toBe('state');
  });

  it('reads states as rounded boxes, their names and descriptions as lines', () => {
    expect(node(DOOR, 'Closed')).toEqual({ id: 'Closed', outline: 'roundRect', lines: ['Door closed'] });
    expect(node(DOOR, 'Open').lines).toEqual(['Door open', 'Light on']);
    expect(node(DOOR, 'Opening').lines).toEqual(['Opening']);
  });

  it('reads [*] as each scope\'s start and end, and forks, joins, and choices by their figures', () => {
    expect(node(DOOR, '[start]')).toMatchObject({ outline: 'start', lines: [] });
    expect(node(DOOR, '[end]')).toMatchObject({ outline: 'end' });
    expect(node(DOOR, 'Locked[start]')).toMatchObject({ outline: 'start' });
    expect(node(DOOR, 'split')).toMatchObject({ outline: 'bar', width: 80, height: 10 });
    expect(node('stateDiagram-v2\ndirection LR\nstate f <<fork>>', 'f')).toMatchObject({ width: 10, height: 80 });
    expect(node(DOOR, 'Check')).toMatchObject({ outline: 'diamond', lines: [] });
    expect(edges(DOOR)).toContainEqual(['Locked[start]', 'Armed', undefined]);
    expect(edges(DOOR)).toContainEqual(['Alarm', 'Locked[end]', undefined]);
    expect(edges(DOOR)).toContainEqual(['Closed', 'Opening', 'open']);
  });

  it('reads a composite as a container, and one divided by -- as a pool of lanes', () => {
    const { containers } = page(DOOR).data;
    expect(containers![0]).toEqual({ id: 'Locked', role: 'container', label: 'Locked', members: ['Locked[start]', 'Armed', 'Alarm', 'Locked[end]'] });
    expect(containers![1]).toEqual({
      id: 'Service', role: 'pool', label: 'Service', axis: 'y',
      lanes: [
        { id: 'Service-region-1', members: ['Service-region-1[start]', 'Diagnose', 'Service-region-1[end]'] },
        { id: 'Service-region-2', members: ['Service-region-2[start]', 'Notify', 'Service-region-2[end]'] },
      ],
    });
  });

  it('reads notes as note shapes joined to their state, and classes as colors', () => {
    expect(node(DOOR, 'note-2')).toEqual({ id: 'note-2', outline: 'note', lines: ['Sounds for', 'five minutes'] });
    expect(page(DOOR).data.edges.find((e) => e.from === 'note-1')).toMatchObject({ to: 'Locked', colors: { dash: [4, 4], markerEnd: null } });
    expect(node(DOOR, 'Alarm').colors).toEqual({ fill: '#ffdddd', stroke: '#cc0000' });
    expect(node(DOOR, 'Opening').colors).toEqual({ fill: '#ffdddd', stroke: '#cc0000' });
  });

  it('warns of what it drops', () => {
    expect(readStateDiagram(DOOR).warnings).toEqual(['Mermaid note sides were dropped.', 'Mermaid statements a diagram does not hold were dropped: hide.']);
  });

  it('names the line it cannot read', () => {
    expect(() => parseStateDiagram('stateDiagram-v2\nstate A {\nB')).toThrow('Mermaid, line 2: a composite state opened here is never closed');
    expect(() => parseStateDiagram('stateDiagram-v2\nA -> B')).toThrow(/^Mermaid, line 2: cannot read/);
    expect(() => parseStateDiagram('stateDiagram-v2\nnote right of A\nx')).toThrow('Mermaid, line 2: a note opened here has no "end note"');
    expect(() => parseStateDiagram('stateDiagram-v2\n--')).toThrow('Mermaid, line 2: "--" divides only a composite state');
  });

  it('gives a note and a concurrent region ids no state holds', () => {
    const notes = readStateDiagram('stateDiagram-v2\nnote-1 --> B\nnote right of B : hi');
    expect(page('stateDiagram-v2\nnote-1 --> B\nnote right of B : hi').data.nodes.map((n) => n.id)).toEqual(['note-1', 'B', 'note-2']);
    expect(() => documentSpecs(notes.document)).not.toThrow();
    const regions = readStateDiagram('stateDiagram-v2\nstate X {\n a\n --\n b\n}\nX-region-1 --> c');
    expect(() => documentSpecs(regions.document)).not.toThrow();
    expect(onlyPage(regions.document).data.containers?.[0]?.lanes?.map((l) => l.id)).toEqual(['X-region-2', 'X-region-3']);
  });

  it('labels a composite state with a description given before its block', () => {
    expect(page('stateDiagram-v2\nX : Big\nstate X {\n a\n}').data.containers?.[0]).toMatchObject({ id: 'X', label: 'Big' });
  });
});

describe('writing a Mermaid state diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(DOOR);
    const text = writeStateDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeStateDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes [*] inside the scope it starts or ends, regions divided by --, and forks and joins by their edges', () => {
    const text = writeStateDiagram({ pages: [page(DOOR)] }).text;
    expect(text).toContain('  state Locked {\n    Armed\n    Alarm\n    [*] --> Armed\n');
    expect(text).toContain('    --\n');
    expect(text).toContain('  state split <<fork>>');
    expect(text).toContain('  state merge <<join>>');
    expect(text).toContain('  state "Door open" as Open\n  Open : Light on');
  });

  it('warns of an edge drawn differently, which a transition cannot be', () => {
    const { warnings } = writeStateDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { dash: [2, 2] } }] },
    }] });
    expect(warnings).toContain('Mermaid draws every transition alike; their dashes and ends were dropped.');
  });

  it('keeps a state\'s line and a composite state\'s label when their ids are written cleaned', () => {
    const text = writeStateDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'my state', lines: ['my state'] }], edges: [], containers: [{ id: 'my box', role: 'container', label: 'my box', members: ['my state'] }],
    } }] }).text;
    expect(page(text).data.nodes[0]!.lines).toEqual(['my state']);
    expect(page(text).data.containers?.[0]?.label).toBe('my box');
  });

  it('writes a note line reading "end note" so it does not close the note', () => {
    const text = writeStateDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'n', outline: 'note', lines: ['end note', 'z'] }], edges: [{ from: 'n', to: 'a' }],
    } }] }).text;
    expect(page(text).data.nodes.find((n) => n.outline === 'note')!.lines).toEqual(['end note', 'z']);
  });

  const graph = (data: object) => ({ pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { edges: [], ...data } as never }] });
  const noteOf = (text: string) => page(text).data.nodes.find((n) => n.outline === 'note');

  it('writes a note\'s text from its rows', () => {
    const text = writeStateDiagram(graph({ nodes: [{ id: 'a' }, { id: 'n', outline: 'note', rows: [{ kind: 'label', text: 'hi' }] }], edges: [{ from: 'n', to: 'a' }] })).text;
    expect(text).toContain('  note right of a : hi\n');
  });

  it('writes a note joined from its state beside that state, never as a transition', () => {
    const out = writeStateDiagram(graph({ nodes: [{ id: 'A' }, { id: 'n1', outline: 'note', lines: ['x'] }], edges: [{ from: 'A', to: 'n1' }] }));
    expect(out.text).toBe('stateDiagram-v2\n  A\n  note right of A : x\n');
    expect(out.warnings).toEqual([]);
  });

  it('drops a note beside only a start or end, and a note\'s connectors past its first, with warnings, so the text reads back', () => {
    const out = writeStateDiagram(graph({
      nodes: [{ id: 's', outline: 'start' }, { id: 'A' }, { id: 'B' }, { id: 'n1', outline: 'note', lines: ['x'] }, { id: 'n2', outline: 'note', lines: ['y'] }],
      edges: [{ from: 's', to: 'A' }, { from: 'n1', to: 's' }, { from: 'n2', to: 'A' }, { from: 'n2', to: 'B' }],
    }));
    expect(out.text).not.toContain('[*] :');
    expect(out.warnings).toEqual(expect.arrayContaining([
      'Mermaid notes sit beside a state; notes beside none were dropped.',
      'Mermaid notes sit beside one state; their other connectors were dropped.',
    ]));
    expect(noteOf(out.text)!.lines).toEqual(['y']);
  });

  it('drops a transition joining a composite\'s [*] to a state outside it, with a warning, so no state changes container', () => {
    const out = writeStateDiagram(graph({
      nodes: [{ id: 'X' }, { id: 'Y' }, { id: 's', outline: 'start' }],
      edges: [{ from: 's', to: 'X' }, { from: 's', to: 'Y' }],
      containers: [{ id: 'C', role: 'container', members: ['Y', 's'] }],
    }));
    expect(out.warnings).toContain('Mermaid joins a composite\'s [*] only to states inside it; transitions joining one to a state outside were dropped.');
    const back = page(out.text);
    expect(back.data.containers?.[0]?.members).toEqual(['Y', 'C[start]']);
    expect(back.data.edges.map((e) => [e.from, e.to])).toEqual([['C[start]', 'Y']]);
  });

  it('colors a [*] given a class in a transition', () => {
    expect(node('stateDiagram-v2\n  classDef go fill:#f00\n  [*]:::go --> A', '[start]').colors).toMatchObject({ fill: '#f00' });
    expect(writeStateDiagram(graph({ nodes: [{ id: 's', outline: 'start', colors: { fill: '#f00' } }, { id: 'a' }], edges: [{ from: 's', to: 'a' }] })).warnings)
      .toEqual(['Mermaid start and end states hold no colors here; they were dropped.']);
  });
});

describe('writing start and end shapes a Mermaid state diagram cannot keep apart', () => {
  const graph = (data: object) => ({ pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { edges: [], ...data } as never }] });
  const WARNING = 'Mermaid holds one start and one end per composite, a start only leaving it and an end only arriving; other start and end shapes were merged or dropped.';
  const warnings = (data: object) => writeStateDiagram(graph(data)).warnings;

  it('warns of a second start in one scope, which reads back merged with the first', () => {
    const data = { nodes: [{ id: 's1', outline: 'start' }, { id: 's2', outline: 'start' }, { id: 'a' }, { id: 'b' }], edges: [{ from: 's1', to: 'a' }, { from: 's2', to: 'b' }] };
    expect(warnings(data)).toContain(WARNING);
    expect(page(writeStateDiagram(graph(data)).text).data.nodes.filter((n) => n.outline === 'start')).toHaveLength(1);
  });

  it('warns of a start a transition arrives at, an end one leaves, and one no transition names', () => {
    expect(warnings({ nodes: [{ id: 's', outline: 'start' }, { id: 'x' }], edges: [{ from: 'x', to: 's' }] })).toContain(WARNING);
    expect(warnings({ nodes: [{ id: 'e', outline: 'end' }, { id: 'x' }], edges: [{ from: 'e', to: 'x' }] })).toContain(WARNING);
    expect(warnings({ nodes: [{ id: 's', outline: 'start' }, { id: 'x' }] })).toContain(WARNING);
  });

  it('stays quiet for one start and one end in each scope', () => {
    expect(warnings({
      nodes: [{ id: 's', outline: 'start' }, { id: 'e', outline: 'end' }, { id: 'x' }, { id: 's2', outline: 'start' }, { id: 'y' }],
      edges: [{ from: 's', to: 'x' }, { from: 'x', to: 'e' }, { from: 's2', to: 'y' }],
      containers: [{ id: 'C', role: 'container', members: ['s2', 'y'] }],
    })).not.toContain(WARNING);
  });
});

describe('writing a Mermaid state diagram\'s shapes and notes', () => {
  const graph = (data: object) => ({ pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { edges: [], ...data } as never }] });

  it('warns that a diamond with text is written as a plain state', () => {
    const out = writeStateDiagram(graph({ nodes: [{ id: 'x', outline: 'diamond', lines: ['Valid?'] }] }));
    expect(out.warnings).toContain('Mermaid choices hold no text; diamonds with text were written as plain states.');
    expect(writeStateDiagram(graph({ nodes: [{ id: 'x', outline: 'diamond', lines: [] }] })).warnings).toEqual([]);
  });
});

describe('writing a Mermaid state note', () => {
  const graph = (data: object) => ({ pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { edges: [], ...data } as never }] });
  const noteOf = (text: string) => page(text).data.nodes.find((n) => n.outline === 'note');

  it('drops a note\'s blank lines and the spaces around its lines, with a warning, so it reads back as written', () => {
    const out = writeStateDiagram(graph({ nodes: [{ id: 'a' }, { id: 'n', outline: 'note', lines: ['a', '', '  b'] }], edges: [{ from: 'n', to: 'a' }] }));
    expect(out.warnings).toContain('Mermaid notes hold no blank lines and no spaces around a line; they were dropped.');
    expect(noteOf(out.text)!.lines).toEqual(['a', 'b']);
    expect(writeStateDiagram({ pages: [page(out.text)] }).warnings).toEqual([]);
  });
});

describe('reading a Mermaid state\'s name and description in either order', () => {
  it('keeps a description given before the state is named', () => {
    expect(node('stateDiagram-v2\n  A : waits for input\n  state "Idle" as A', 'A').lines).toEqual(['Idle', 'waits for input']);
    expect(node('stateDiagram-v2\n  state "Idle" as A\n  A : waits for input', 'A').lines).toEqual(['Idle', 'waits for input']);
  });
});

describe('writing a Mermaid state whose id is a statement word', () => {
  it('renames a state whose id is accTitle or accDescr, so its description reads back as its own', () => {
    for (const id of ['accTitle', 'accDescr']) {
      const doc = { pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { nodes: [{ id, lines: ['Name', 'desc'] }, { id: 'b' }], edges: [{ id: 'e', from: id, to: 'b' }] } as never }] };
      const back = page(writeStateDiagram(doc).text);
      expect(back.data.nodes.find((n) => n.id !== 'b')?.lines, id).toEqual(['Name', 'desc']);
    }
  });
});

describe('writing what a Mermaid state pool holds outside its lanes', () => {
  it('writes a pool\'s own states and containers as a region of their own, with a warning', () => {
    const doc = { pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 's1', lines: ['One'] }, { id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [],
      containers: [
        { id: 'P', role: 'pool', label: 'P', members: ['s1', 'inner'], lanes: [{ id: 'L1', members: ['a'] }, { id: 'L2', members: ['b'] }] },
        { id: 'inner', role: 'container', label: 'Inner', members: ['c'] },
      ],
    } as never }] };
    const out = writeStateDiagram(doc);
    expect(out.warnings).toContain('Mermaid divides a state into regions only; what a pool holds outside its lanes was written as a region of its own.');
    const back = page(out.text);
    expect(back.data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 's1']);
    expect(back.data.containers?.find((k) => k.id === 'inner')).toMatchObject({ role: 'container', label: 'Inner', members: ['c'] });
    expect(back.data.containers?.find((k) => k.id === 'P')?.lanes).toHaveLength(3);
  });
});

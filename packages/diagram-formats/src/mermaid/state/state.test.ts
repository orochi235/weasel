import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
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
});

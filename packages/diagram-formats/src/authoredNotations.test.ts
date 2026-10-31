import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, GraphPage } from './document';
import { authoredScene, connect, mermaidRoundTrip, type Placement } from './testing/authoredScene';

const graph = (doc: DiagramDocument) => doc.pages[0] as GraphPage;
const outlines = (doc: DiagramDocument) => graph(doc).data.nodes.map((n) => n.outline);
const labels = (n: DataNode) => (n.rows ?? []).flatMap((r) => (r.kind === 'label' ? [r.text] : [])).concat(n.lines ?? []);

/** A chart drawn from `type`'s stencils, joined as `edges` says by placement index. */
function drawn(type: string, placements: readonly Placement[], edges: readonly [number, number][] = []) {
  const { scene, ids } = authoredScene(type, placements);
  for (const [from, to] of edges) connect(scene, ids[from]!, ids[to]!);
  return mermaidRoundTrip(scene);
}

describe('a chart drawn from a notation type\'s stencils writes that notation, and reads back the same', () => {
  it('state', () => {
    const { text, back } = drawn('state', [
      { stencil: 'state-start', at: { x: 100, y: 60 } },
      { stencil: 'state', at: { x: 100, y: 180 } },
      { stencil: 'state-choice', at: { x: 100, y: 300 } },
      { stencil: 'state-fork', at: { x: 100, y: 420 } },
      { stencil: 'state-end', at: { x: 100, y: 600 } },
      { stencil: 'state-note', at: { x: 400, y: 180 } },
      { stencil: 'state-composite', at: { x: 900, y: 300 } },
      { stencil: 'state', at: { x: 140, y: 100 }, parent: 6 },
      { stencil: 'state-concurrent', at: { x: 900, y: 800 } },
      { stencil: 'state', at: { x: 160, y: 60 }, parent: { pool: 8, lane: 0 } },
      { stencil: 'state', at: { x: 160, y: 60 }, parent: { pool: 8, lane: 1 } },
    ], [[0, 1], [1, 2], [2, 3], [3, 4], [3, 7], [5, 1]]);
    expect(text).toMatch(/^stateDiagram-v2/m);
    expect(text).toMatch(/\[\*\] --> /);
    expect(text).toMatch(/--> \[\*\]/);
    expect(text).toMatch(/<<choice>>/);
    expect(text).toMatch(/<<fork>>/);
    expect(text).toMatch(/state "State" as/);
    expect(text).toMatch(/note right of/);
    expect(text).toMatch(/^\s+--$/m);
    expect(graph(back).notation).toBe('state');
    expect(outlines(back)).toEqual(expect.arrayContaining(['start', 'end', 'diamond', 'bar', 'roundRect', 'note']));
    expect(graph(back).data.containers?.map((c) => c.role).sort()).toEqual(['container', 'pool']);
  });

  it('requirement', () => {
    const { text, back } = drawn('requirement', [
      { stencil: 'requirement', at: { x: 200, y: 100 } },
      { stencil: 'requirement-element', at: { x: 200, y: 400 } },
    ], [[1, 0]]);
    expect(text).toMatch(/^requirementDiagram/m);
    expect(text).toMatch(/requirement Requirement \{\n\s+id: 1\n\s+text: The system shall…\n\s+risk: Medium\n\s+verifymethod: Test/);
    expect(text).toMatch(/element Element \{\n\s+type: module/);
    expect(text).toMatch(/Element - traces -> Requirement/);
    expect(graph(back).data.nodes.map((n) => labels(n)[0])).toEqual(['<<requirement>>', '<<element>>']);
  });

  it('C4', () => {
    const { text, back } = drawn('c4', [
      { stencil: 'c4-system-boundary', at: { x: 600, y: 400 } },
      { stencil: 'c4-person', at: { x: 200, y: 120 } },
      { stencil: 'c4-container', at: { x: 160, y: 110 }, parent: 0 },
      { stencil: 'c4-system-db', at: { x: 200, y: 700 } },
      { stencil: 'c4-container-queue', at: { x: 600, y: 900 } },
      { stencil: 'c4-person-ext', at: { x: 1200, y: 120 } },
    ], [[1, 2]]);
    expect(text).toMatch(/^C4Context/m);
    expect(text).toMatch(/System_Boundary\(\w+, "System"\) \{\n\s+Container\(\w+, "Container", "Technology", "What it does"\)/);
    expect(text).toMatch(/Person\(\w+, "Person", "What it does"\)/);
    expect(text).toMatch(/SystemDb\(/);
    expect(text).toMatch(/ContainerQueue\(/);
    expect(text).toMatch(/Person_Ext\(/);
    expect(text).toMatch(/Rel\(/);
    expect(graph(back).notation).toBe('c4-context');
    expect(outlines(back)).toEqual(expect.arrayContaining(['person', 'roundRect', 'cylinder', 'queue']));
    expect(graph(back).data.nodes.find((n) => labels(n)[0] === '<<external_person>>')?.style).toBe('muted');
  });

  it('block', () => {
    const { text, back } = drawn('block', [
      { stencil: 'process', at: { x: 100, y: 100 } },
      { stencil: 'decision', at: { x: 300, y: 100 } },
    ], [[0, 1]]);
    expect(text).toMatch(/^block-beta/m);
    expect(graph(back).notation).toBe('block');
    expect(outlines(back)).toEqual(['rect', 'diamond']);
  });

  it('architecture', () => {
    const { text, back } = drawn('architecture', [
      { stencil: 'arch-group', at: { x: 300, y: 300 } },
      { stencil: 'arch-server', at: { x: 150, y: 100 }, parent: 0 },
      { stencil: 'arch-database', at: { x: 800, y: 300 } },
      { stencil: 'arch-junction', at: { x: 600, y: 300 } },
      { stencil: 'arch-cloud', at: { x: 800, y: 600 } },
    ], [[1, 3], [3, 2]]);
    expect(text).toMatch(/^architecture-beta/m);
    expect(text).toMatch(/group \w+\(?/);
    expect(text).toMatch(/service \w+\(server\)\[Server\] in \w+/);
    expect(text).toMatch(/service \w+\(database\)\[Database\]/);
    expect(text).toMatch(/junction \w+/);
    expect(text).not.toMatch(/-->|<--/);
    expect(graph(back).notation).toBe('architecture');
    expect(outlines(back)).toEqual(expect.arrayContaining(['server', 'cylinder', 'start', 'cloud']));
  });

  it('kanban', () => {
    const { text, back } = drawn('kanban', [
      { stencil: 'kanban-board', at: { x: 400, y: 300 } },
      { stencil: 'kanban-card', at: { x: 110, y: 100 }, parent: { pool: 0, lane: 0 } },
      { stencil: 'kanban-card', at: { x: 110, y: 100 }, parent: { pool: 0, lane: 2 } },
    ]);
    expect(text).toMatch(/^kanban/m);
    expect(text).toMatch(/\[To do\]\n\s+\S*\[Task\]@\{ assigned: 'someone' \}\n\s+\S*\[In progress\]\n\s+\S*\[Done\]\n\s+\S*\[Task\]/);
    const pool = graph(back).data.containers![0]!;
    expect(pool.lanes?.map((l) => [l.label, l.members?.length ?? 0])).toEqual([['To do', 1], ['In progress', 0], ['Done', 1]]);
  });
});

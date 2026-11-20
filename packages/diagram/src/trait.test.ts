import { describe, it, expect } from 'vitest';
import { createDiagramNodes, dataKeyReader, diagramNodeOf, type DiagramNodeLike } from './trait';

const node = (data: unknown, id = 'n1'): DiagramNodeLike => ({ id, kind: 'mark', data });

describe('dataKeyReader', () => {
  it('reads an edge as no participant at all', () => {
    // An edge carries its trait under the same `data.diagram` key a
    // participant does. Read as a participant it has no `ports`, so it
    // collects the four defaults on its own degenerate pose — four grabbable
    // ports in the middle of nowhere.
    expect(dataKeyReader(node({ diagram: { from: {}, to: {}, router: 'straight' } }))).toBeNull();
  });

  it('reads an edge label as no participant', () => {
    // Read as one, a label takes a slot in every layout and grows four ports.
    expect(dataKeyReader(node({ diagram: { label: { at: 'mid' } } }))).toBeNull();
  });

  it('still reads a participant that declares nothing', () => {
    expect(diagramNodeOf(node({ diagram: {} }))).toEqual({});
  });
});

describe('createDiagramNodes', () => {
  const read = createDiagramNodes([{ name: 'any', matches: (d) => d !== null && typeof d === 'object', trait: { ports: [] } }]);

  it('gives no kind trait to a node whose own trait takes no ports', () => {
    for (const diagram of [{ from: {}, to: {} }, { label: { at: 'mid' } }, { container: { role: 'lane' } }]) {
      expect(read(node({ diagram }))).toBeNull();
    }
  });

  it('gives its kind trait to a node with no own trait, and lets an own trait win', () => {
    expect(read(node({ title: 'x' }))).toEqual({ ports: [] });
    expect(read(node({ diagram: { pinned: true } }))).toEqual({ pinned: true });
  });
});

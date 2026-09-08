import { describe, it, expect } from 'vitest';
import { dataKeyReader, diagramNodeOf, type DiagramNodeLike } from './trait';

const node = (data: unknown, id = 'n1'): DiagramNodeLike => ({ id, kind: 'leaf', data });

describe('dataKeyReader', () => {
  it('reads an edge as no participant at all', () => {
    // An edge carries its trait under the same `data.diagram` key a
    // participant does. Read as a participant it has no `ports`, so it
    // collects the four defaults on its own degenerate pose — four grabbable
    // ports in the middle of nowhere.
    expect(dataKeyReader(node({ diagram: { from: {}, to: {}, router: 'straight' } }))).toBeNull();
  });

  it('still reads a participant that declares nothing', () => {
    expect(diagramNodeOf(node({ diagram: {} }))).toEqual({});
  });
});

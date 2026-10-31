import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import { insertSankeyLink, moveSankeyLink, removeSankeyLink, removeSankeyNode, setSankeyEnd } from './structure';
import type { SankeyData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: SankeyData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);

describe('sankey structure', () => {
  it('builds a flow from nothing, each new link carrying on from the last one\'s target', () => {
    let d = insertSankeyLink({ kind: 'sankey', links: [] }, 0);
    d = insertSankeyLink(d, 1);
    expect(d.links).toEqual([{ source: 'Node 1', target: 'Node 2', value: 1 }, { source: 'Node 2', target: 'Node 3', value: 1 }]);
    d = setSankeyEnd(d, 1, 'target', ' Sink ');
    expect(d.links[1]!.target).toBe('Sink');
    expect(() => setSankeyEnd(d, 1, 'source', ' ')).toThrow(/needs a name/);
    compiles(d);
  });

  it('moves and removes links, and removes a node with every link touching it', () => {
    const d: SankeyData = { kind: 'sankey', links: [{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'c', value: 2 }, { source: 'a', target: 'c', value: 3 }] };
    expect(moveSankeyLink(d, 0, 2).links.map((l) => l.value)).toEqual([2, 3, 1]);
    expect(removeSankeyLink(d, 1).links.map((l) => l.value)).toEqual([1, 3]);
    expect(removeSankeyNode(d, 'b').links).toEqual([{ source: 'a', target: 'c', value: 3 }]);
    expect(() => removeSankeyNode(d, 'z')).toThrow(/no node "z"/);
    compiles(removeSankeyNode(d, 'b'));
  });
});

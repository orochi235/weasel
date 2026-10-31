/** A sankey as a table of links and a table of the nodes they name; a node is added by naming it in a link. */
import { numberOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotSchema } from '../editing/schemaTypes';
import { renameSankeyNode, setSankeyValue } from './edit';
import { sankeyNodes } from './layout';
import { insertSankeyLink, moveSankeyLink, removeSankeyLink, removeSankeyNode, setSankeyEnd } from './structure';
import type { SankeyData } from './types';

const endColumn = (end: 'source' | 'target', label: string): PlotColumn<SankeyData> => ({
  key: end, label, type: { kind: 'string' },
  get: (d, _, r) => d.links[r]?.[end],
  set: (d, _, r, v) => { const t = textOf(v)?.trim(); return t ? setSankeyEnd(d, r, end, t) : d; },
});

export const sankeySchema: PlotSchema<SankeyData> = {
  fields: [titleField()],
  tables: [
    {
      key: 'links', label: 'Links', item: 'link',
      count: (d) => d.links.length,
      columns: () => [
        endColumn('source', 'From'),
        endColumn('target', 'To'),
        {
          key: 'value', label: 'Value', type: { kind: 'number', min: 0 },
          get: (d, _, r) => d.links[r]?.value,
          set: (d, _, r, v) => { const n = numberOf(v); return n !== undefined && n >= 0 ? setSankeyValue(d, r, n) : d; },
        },
      ],
      insert: (d, _, at) => insertSankeyLink(d, at),
      remove: (d, _, r) => removeSankeyLink(d, r),
      move: (d, _, from, to) => moveSankeyLink(d, from, to),
      rowLabel: (d, _, r) => `${d.links[r]?.source ?? ''} → ${d.links[r]?.target ?? ''}`,
    },
    {
      key: 'nodes', label: 'Nodes', item: 'node',
      count: (d) => sankeyNodes(d).length,
      columns: () => [{
        key: 'name', label: 'Node', type: { kind: 'string' },
        get: (d, _, r) => sankeyNodes(d)[r],
        set: (d, _, r, v) => {
          const name = textOf(v)?.trim();
          const nodes = sankeyNodes(d);
          return !name || nodes.includes(name) || nodes[r] === undefined ? d : renameSankeyNode(d, nodes[r], name);
        },
      }],
      remove: (d, _, r) => { const name = sankeyNodes(d)[r]; return name === undefined ? d : removeSankeyNode(d, name); },
      rowLabel: (d, _, r) => sankeyNodes(d)[r] ?? '',
    },
  ],
};

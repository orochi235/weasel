/** A sankey's title, link values and node labels, edited in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { typedAmountOf } from '../editing/schemaKit';
import { formatFlow } from './compile';
import { renameSankeyNode, setSankeyValue } from './edit';
import { sankeyNodes } from './layout';
import type { SankeyData } from './types';

/** Nothing is dragged; a link's value sets its flow, and a node's label renames it in every link. */
export const sankeyEditor: PlotEditor<SankeyData> = {
  handle: () => null,
  drag: () => null,
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    if (datum.edit === 'value' && typeof datum.link === 'number') {
      // The label rounds the value, so reading back the label as shown would rewrite it.
      const link = data.links[datum.link];
      if (link !== undefined && text.trim() === formatFlow(link.value)) return data;
      const v = typedAmountOf(text);
      return v === null ? data : setSankeyValue(data, datum.link, v);
    }
    if (datum.edit === 'node' && typeof datum.node === 'string') {
      const name = text.trim();
      return name === '' || name === datum.node || sankeyNodes(data).includes(name) ? data : renameSankeyNode(data, datum.node, name);
    }
    return data;
  },
};

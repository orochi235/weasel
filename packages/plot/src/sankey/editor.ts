/** A sankey's title, link values and node labels, edited in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { renameSankeyNode, setSankeyValue } from './edit';
import { sankeyNodes } from './layout';
import type { SankeyData } from './types';

/** `text` as a flow: a number not below zero, or `null`. */
const flowOf = (text: string): number | null => {
  const t = text.trim();
  const v = Number(t);
  return t !== '' && Number.isFinite(v) && v >= 0 ? v : null;
};

/** Nothing is dragged; a link's value sets its flow, and a node's label renames it in every link. */
export const sankeyEditor: PlotEditor<SankeyData> = {
  handle: () => null,
  drag: () => null,
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    if (datum.edit === 'value' && typeof datum.link === 'number') {
      const v = flowOf(text);
      return v === null ? data : setSankeyValue(data, datum.link, v);
    }
    if (datum.edit === 'node' && typeof datum.node === 'string') {
      const name = text.trim();
      return name === '' || name === datum.node || sankeyNodes(data).includes(name) ? data : renameSankeyNode(data, datum.node, name);
    }
    return data;
  },
};

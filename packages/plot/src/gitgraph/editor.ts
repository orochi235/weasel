/** A gitgraph's title and tags, edited in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { setGitTag } from './edit';
import type { GitGraphData } from './types';

/** Nothing is dragged; a commit's tag is edited in place. */
export const gitgraphEditor: PlotEditor<GitGraphData> = {
  handle: () => null,
  drag: () => null,
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    if (datum.edit === 'tag' && typeof datum.command === 'number') return setGitTag(data, datum.command, text);
    return data;
  },
};

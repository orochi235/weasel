import { shareToolOptions, toolOptionParams, withToolOptionDefault, type ActionDeps, type ToolOptions, type ToolOptionShare } from '@weasel-js/routing';
import { insertStyleOf, type InsertStyle } from 'interactions/actions/insert/style';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';

/** The pen's options: the style it draws with, shared with every shape tool, and whether closing a subpath commits
 *  it. The pen's own actions read them where they commit, so no action is tuned with them. */
export const PEN_TOOL_OPTIONS = shapeToolOptions({
  actionId: [],
  name: 'Pen',
  keys: ['fill', 'stroke', 'strokeWidth', 'fillRule'],
  style: { fill: DEFAULT_SHAPE_PAINT, stroke: DEFAULT_SHAPE_PAINT },
  own: {
    autoCommitOnClose: {
      kind: 'boolean',
      name: 'Auto-commit pen on close',
      description: "When you click the pen tool's first anchor to close a region, commit immediately so it renders with its fill. Off: keep the path in preview until you press Enter (lets you build a compound path from multiple closed subpaths).",
      default: true,
    },
  },
});

/** The pen's options at a use site: `share` laid over its own, and `autoCommitOnClose` as that option's default. */
export function penToolOptions(share: ToolOptionShare | undefined, autoCommitOnClose: boolean | undefined): ToolOptions {
  return withToolOptionDefault(shareToolOptions(PEN_TOOL_OPTIONS, share), 'autoCommitOnClose', autoCommitOnClose);
}

/** What the pen draws with now, and whether closing a subpath commits it. */
export function penOptionValues(options: ToolOptions, deps: ActionDeps): { style: InsertStyle | undefined; autoCommitOnClose: boolean } {
  const params = toolOptionParams('pen', options, deps.toolOptionValues);
  return { style: insertStyleOf(params), autoCommitOnClose: params.autoCommitOnClose !== false };
}

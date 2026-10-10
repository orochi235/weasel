import { isPrefLeaf, isPrefSection, type PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import type { SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** How wide each kind of ghost is drawn. */
export const GHOST_WIDTH = { page: 176, node: 300 } as const;

const NO_VALUES = {};
const ignore = () => {};

/** Whether `node` is drawn as an entry in the form's rail. */
export function ghostIsPage(node: SchemaNode, topLevel: boolean): boolean {
  return !isPrefLeaf(node) && !isPrefSection(node) && (node.as === 'page' || (node.as === undefined && topLevel));
}

/**
 * A dragged node near enough to how the form will draw it: a leaf as its row, a page as a rail entry, and any
 * other group as its tab, box, or heading, emptied, since what it holds comes along unseen.
 */
export function NodeGhost({ node, topLevel = false, renderers }: {
  node: SchemaNode;
  /** The node sits, or will sit, directly under the root, where a group with no `as` is a page. */
  topLevel?: boolean;
  renderers?: Record<string, PrefRenderer>;
}) {
  if (ghostIsPage(node, topLevel)) return <div className={s.ghostPage}>{node.name}</div>;
  const drawn = isPrefLeaf(node)
    ? node
    // A section is drawn as the group it would be; the form's list has no pages, so a bare group is a heading.
    : ({ name: node.name, description: node.description, as: node.as, children: {} } as PrefGroup);
  return (
    <div className={s.ghostNode}>
      <PrefsForm layout="list" schema={{ name: '', children: { ghost: drawn } }} values={NO_VALUES} onChange={ignore}
        renderers={renderers} showEmpty showHidden />
    </div>
  );
}

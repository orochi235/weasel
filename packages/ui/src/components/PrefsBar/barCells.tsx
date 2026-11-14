import type { ReactNode } from 'react';
import { pairRows } from '../SelectionPanel/model';
import { renderCells } from '../SelectionPanel/cells';
import type { LeafContext, LeafRenderer } from '../SelectionPanel/renderContext';
import type { BarCell, BarLeafNode } from './barNodes';

/** One leaf's cell as a surface draws it, before the bar knows whether it fuses with its neighbors. */
export interface BarLeafCell {
  /** The leaf's control, drawn on its own. */
  render: () => ReactNode;
  /** What a run of paired toggle flags reads and writes the leaf through, when the bar fuses the run into one
   *  segmented control. */
  ctx: LeafContext;
  /** The accessible name the leaf's control carries. Default: the leaf's name. */
  ariaLabel?: string;
}

/**
 * Neighboring leaves as a bar's cells, each drawn by `cellFor`, and each run of toggle flags that share a `pair`
 * fused into one segmented control. The bar draws no row label, so a control carries its own name rather than a
 * panel's qualified "<pair> <leaf>"; the fused control carries the pair's. A leaf `renderers` claims, by its path or
 * its kind, never fuses.
 */
export function barCells(
  leaves: readonly BarLeafNode[],
  cellFor: (node: BarLeafNode) => BarLeafCell,
  renderers?: Record<string, LeafRenderer>,
): BarCell[] {
  return pairRows(leaves).flatMap((row) => {
    const cells = row.leaves.map((leaf) => {
      const node = leaf as BarLeafNode;
      const cell = cellFor(node);
      return {
        key: node.path,
        leaf: node.leaf,
        ctx: cell.ctx,
        ariaLabel: cell.ariaLabel ?? node.leaf.name,
        render: cell.render,
        ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
      };
    });
    return renderCells(cells, renderers).map((cell) => ({ path: cell.key, content: cell.content }));
  });
}

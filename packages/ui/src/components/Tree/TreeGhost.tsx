import type { ReactNode } from 'react';
import { DragGhost } from '../DragGhost';
import { Icon } from '../../icons';
import type { TreeDragEffect, TreeDragState } from './useTreeDrag';
import s from './Tree.module.css';

/** What a caller draws beside the pointer in place of the dragged rows, and how wide. */
export interface TreeGhost {
  content: ReactNode;
  width: number;
}

/** Where a drag is when a caller is asked for its ghost. */
export interface TreeGhostWhere {
  /** The pointer is off the tree's box. */
  outside: boolean;
  effect: TreeDragEffect;
}

/** How far a caller's ghost sits from the pointer, so what is under the pointer stays visible. */
const OFFSET = 10;

/** The ghost of the drag in flight: the caller's stand-in where it gives one, else the dragged rows by label. */
export function TreeDragGhost({ state, from, labelOf, render }: {
  state: TreeDragState;
  from: Element;
  labelOf(id: string): ReactNode;
  render?: (ids: readonly string[], where: TreeGhostWhere) => TreeGhost | null;
}) {
  const { ghost, pointer, effect } = state;
  if (!ghost) return null;
  const own = pointer && render?.(ghost.ids, { outside: pointer.outside, effect });
  if (own && pointer) {
    return (
      <DragGhost at={{ left: pointer.x + OFFSET, top: pointer.y + OFFSET, width: own.width }} from={from}>
        {own.content}
      </DragGhost>
    );
  }
  return (
    <DragGhost at={ghost} from={from}>
      {ghost.ids.map((id) => (
        <div key={id} className={s.ghostRow}>
          {effect !== 'move' && <Icon name={effect === 'link' ? 'link' : 'add'} size={14} className={s.ghostEffect} />}
          {labelOf(id)}
        </div>
      ))}
    </DragGhost>
  );
}

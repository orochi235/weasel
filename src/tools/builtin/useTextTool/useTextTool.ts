import { useMemo, useRef, createElement } from 'react';
import type { Op } from 'core/ops/types';
import type { Tool } from '../../types';
import { useInsert } from 'interactions/gestures/insert/insert';
import type { InsertAdapter } from 'core/adapters/types';
import { defineDragInsertTool } from '../defineDragInsertTool';
import { type InsertOverlayStyle } from '../marquee';
import { TextIcon } from '../../../icons';

type ApplyBatch = (ops: Op[], label: string) => void;

export interface UseTextToolOptions<TNode extends { id: string }> {
  pointInsert: (point: { x: number; y: number }) => TNode | null;
  commitInsert?: InsertAdapter<TNode>['commitInsert'];
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  minBounds?: { width: number; height: number };
  marqueeStyle?: InsertOverlayStyle;
}

export function useTextTool<TNode extends { id: string }>(
  options: UseTextToolOptions<TNode>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;

  // Single ref shared between useInsert.applyOps and defineDragInsertTool's
  // capture/clear. The primitive writes ctx.applyOps into this ref on entry
  // and clears it on end/cancel; useInsert.applyOps reads through it.
  const applyOpsRef = useRef<ApplyBatch | null>(null);

  const adapter = useMemo<InsertAdapter<TNode>>(
    () => ({
      commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
      commitPaste: () => [],
      snapshotSelection: () => ({ items: [] }),
      insertNode: () => {},
      setSelection: () => {},
      getSelection: () => [],
    }),
    [commitInsert],
  );

  const controller = useInsert<TNode, { x: number; y: number; width: number; height: number }>(
    adapter,
    {
      pointInsert,
      clickOnly: !commitInsert,
      minBounds: minBounds ?? { width: 4, height: 4 },
      insertLabel: 'Insert text',
      applyOps: (ops, label) => applyOpsRef.current?.(ops, label),
    },
  );

  const { tool } = defineDragInsertTool({
    id: 'text',
    keybinding: { key: 'T' },
    cursor: 'text',
    presentation: {
      label: 'Text',
      icon: createElement(TextIcon),
      group: 'type',
    },
    controller,
    overlayId: 'text-overlay',
    overlayLabel: 'Text overlay',
    defaultStyle: { fill: 'rgba(164, 139, 212, 0.10)', stroke: '#a48bd4', dash: [3, 3], lineWidth: 1 },
    overlayStyle: marqueeStyle,
    hitExisting,
    applyOpsRef,
  });

  return tool;
}

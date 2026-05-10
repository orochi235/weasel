import { useMemo, useRef } from 'react';
import type { Op } from 'core/ops/types';
import type { Tool } from '../types';
import { useInsert } from 'interactions/gestures/insert/insert';
import type { InsertAdapter } from 'core/adapters/types';
import { defineDragInsertTool } from './defineDragInsertTool';
import { type InsertOverlayStyle } from './marquee';

type ApplyBatch = (ops: Op[], label: string) => void;

export interface UseTextToolOptions<TObject extends { id: string }> {
  pointInsert: (point: { x: number; y: number }) => TObject | null;
  commitInsert?: InsertAdapter<TObject>['commitInsert'];
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  minBounds?: { width: number; height: number };
  marqueeStyle?: InsertOverlayStyle;
}

export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;

  // Single ref shared between useInsert.applyBatch and defineDragInsertTool's
  // capture/clear. The primitive writes ctx.applyBatch into this ref on entry
  // and clears it on end/cancel; useInsert.applyBatch reads through it.
  const applyBatchRef = useRef<ApplyBatch | null>(null);

  const adapter = useMemo<InsertAdapter<TObject>>(
    () => ({
      commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
      commitPaste: () => [],
      snapshotSelection: () => ({ items: [] }),
      insertObject: () => {},
      setSelection: () => {},
      getSelection: () => [],
    }),
    [commitInsert],
  );

  const controller = useInsert<TObject, { x: number; y: number; width: number; height: number }>(
    adapter,
    {
      pointInsert,
      clickOnly: !commitInsert,
      minBounds: minBounds ?? { width: 4, height: 4 },
      insertLabel: 'Insert text',
      applyBatch: (ops, label) => applyBatchRef.current?.(ops, label),
    },
  );

  const { tool } = defineDragInsertTool({
    id: 'text',
    keybinding: 'T',
    cursor: 'text',
    controller,
    overlayId: 'text-overlay',
    overlayLabel: 'Text overlay',
    defaultStyle: { fill: 'rgba(164, 139, 212, 0.10)', stroke: '#a48bd4', dash: [3, 3], lineWidth: 1 },
    overlayStyle: marqueeStyle,
    hitExisting,
    applyBatchRef,
  });

  return tool;
}

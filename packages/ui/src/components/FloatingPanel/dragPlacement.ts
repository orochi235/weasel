import { type Corner, FLOATING_DRAG_PREFIX, type FloatingPlacement, floatingStrategy } from 'windease';

/** The strategy holds a map keyed by item id; a floating box is always a lone item. */
export const ITEM_ID = 'panel';

/** windease's strategy is stateless, so every caller can share one. */
export const STRATEGY = floatingStrategy();

/** A floating box, as windease's strategy takes it. */
export function floatingItem(size: { w: number; h: number }, snapCorners?: readonly Corner[]) {
  return { id: ITEM_ID, meta: { floating: true, ...(snapCorners ? { snapCorners: [...snapCorners] } : {}) }, natural: size };
}

/** What {@link dragPlacement} reads: the box it moves within, the box's own item, and the inset. */
export interface DragPlacementContext {
  container: { w: number; h: number };
  item: ReturnType<typeof floatingItem>;
  options: { inset: number };
}

/**
 * Where a box at `from` rests after a drag of `dx`, `dy`: kept inside the container, and caught by a corner it ends
 * near. windease's own drag step, so every floating box snaps the same way.
 */
export function dragPlacement(from: FloatingPlacement, dx: number, dy: number, { container, item, options }: DragPlacementContext): FloatingPlacement {
  return (
    STRATEGY.reduce?.(
      { at: { [ITEM_ID]: from }, inner: undefined },
      { affordanceId: `${FLOATING_DRAG_PREFIX}${ITEM_ID}`, kind: 'drag', payload: { dx, dy } },
      { container, options, items: [item] },
    ).at[ITEM_ID] ?? from
  );
}

import type {
  InsertBehavior,
  InsertPoint,
  ModifierState,
} from '../../types';

type ModKey = keyof ModifierState;

export function snapToGrid<TPose>(args: {
  spacing: number;
  bypassKey?: ModKey;
}): InsertBehavior<TPose> {
  const { spacing, bypassKey } = args;
  const round = (v: number) => Math.round(v / spacing) * spacing;
  return {
    onStart(ctx) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const id = ctx.draggedIds[0];
      const o = ctx.origin.get(id) as unknown as InsertPoint | undefined;
      if (!o) return;
      ctx.origin.set(id, { x: round(o.x), y: round(o.y) } as unknown as TPose);
    },
    onMove(ctx, { current }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      return { current: { x: round(current.x), y: round(current.y) } };
    },
  };
}

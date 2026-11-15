import type { Paint } from '@weasel-js/core';
import { useActionEdit } from '@weasel-js/ui/components/ActionEdit';
import { PaintInput } from '@weasel-js/ui/components/PaintInput';
import { nestedPaintValue, type LeafContext, type LeafRenderer } from '@weasel-js/ui/components/inspector/SelectionPanel';

/** The actions a paint leaf writes through. */
type PaintActionId = 'setFill' | 'setStroke';

/**
 * A paint leaf routed through an action, so a scrub coalesces into one undo
 * entry instead of one per tick. The control itself is the kit's `PaintInput`
 * — the app supplies only which action the writes land on.
 */
export function wdPaintRenderer(actionId: PaintActionId): LeafRenderer {
  return (ctx) => <WdPaintLeaf ctx={ctx} actionId={actionId} />;
}

/** A fill's or a stroke's paint: the paint, None, or Mixed. */
export function WdPaintLeaf({ ctx, actionId }: { ctx: LeafContext; actionId: PaintActionId }) {
  const edit = useActionEdit(actionId, (paint: Paint | null) => ({ paint }));
  return (
    <PaintInput
      subject={ctx.selectionKey}
      value={nestedPaintValue(ctx)}
      mixed={ctx.mixed}
      aria-label={ctx.pref.name}
      onInput={edit.onInput}
      onChange={edit.onChange}
    />
  );
}

export const WD_RENDERERS: Record<string, LeafRenderer> = {
  'data.fill.paint': wdPaintRenderer('setFill'),
  // The stroke's paint row inside its object leaf; the other fields render
  // from the schema. Keyed at the child path so the object rows survive.
  'data.stroke.paint': wdPaintRenderer('setStroke'),
};

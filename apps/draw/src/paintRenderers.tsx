import {
  type Paint,
  useOngoingAction
} from '@weasel-js/core';
import {
  PaintInput,
  type PropertyRenderContext,
  type PropertyRenderer
} from '@weasel-js/ui';

/** Every `Paint` variant, not just the gradients. Keyed on the union's
 *  own discriminant, so a variant added later needs no change here — the
 *  earlier `'stops' in raw` test silently downgraded patterns to the
 *  fallback color. */
export function isPaintObject(raw: unknown): raw is Paint {
  if (raw === null || typeof raw !== 'object') return false;
  return 'fill' in raw || 'stops' in raw || 'color' in raw;
}

/**
 * A paint leaf routed through an action, so a scrub coalesces into one undo
 * entry instead of one per tick. The control itself is the kit's `PaintInput`
 * — the app supplies only which action the writes land on.
 */
export function wdPaintRenderer(actionId: string): PropertyRenderer {
  return (ctx) => <WdPaintLeaf ctx={ctx} actionId={actionId} />;
}

export function WdPaintLeaf({ ctx, actionId }: { ctx: PropertyRenderContext; actionId: string }) {
  const edit = useOngoingAction(actionId);

  const fallback = ctx.pref.default;
  const raw = ctx.value;
  // `null` is an explicit "no paint" and must not fall through to the schema
  // default, or the None segment unlights itself on the next render.
  const value: Paint | null | undefined = raw === null ? null
    : isPaintObject(raw) ? raw
    : isPaintObject(fallback) ? fallback
    : undefined;

  return (
    <PaintInput
      subject={ctx.selectionKey}
      value={value}
      mixed={ctx.mixed}
      unset={ctx.unset}
      aria-label={ctx.pref.name}
      onInput={(paint) => edit.input({ paint })}
      onChange={(paint) => edit.commit({ paint })}
    />
  );
}

export const WD_RENDERERS: Record<string, PropertyRenderer> = {
  'data.fill': wdPaintRenderer('setFill'),
  // The stroke's paint row inside its object leaf; the other fields render
  // from the schema. Keyed at the child path so the object rows survive.
  'data.stroke.paint': wdPaintRenderer('setStroke'),
};

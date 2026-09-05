import { type CSSProperties, type ReactNode, type RefCallback, useEffect, useState } from 'react';
import { dlog } from '../../dlog';
import { useReorderDragList } from '../../useReorderDragList';
import { DragHandleGlyph } from '../DragHandleGlyph';
import s from './LayerStack.module.css';

/** One card in a layer stack: its identity, the label shown when collapsed,
 *  and the optional select hoisted into its header. */
export interface LayerStackItem {
  /** Stable id used for keys, onRemove, onReorder. Numeric to match
   *  common id-from-nextId conventions; string ids also work. */
  id: number | string;
  /** Short kind label rendered in the header when no primary select
   *  is hoisted (e.g. "shadow", "stroke"). */
  kind: string;
  /** When present, hoist this select into the card header so the user
   *  can switch mode/shape without expanding. */
  primaryValue?: string;
  primaryOptions?: string[];
  /** Accent CSS color used as the left border / index-badge fill. Sets
   *  --wzl-layer-stack-accent on the card, which re-binds --wzl-accent
   *  for everything inside it. */
  accent?: string;
  /** Optional badge text rendered before the primary control
   *  (e.g. tail index "1", "2", "3"). When omitted a drag handle
   *  glyph renders in its place. */
  badge?: string;
  /** Initial expanded state. Defaults to true for newly-added items. */
  defaultExpanded?: boolean;
}

/** Props for `<LayerStack>`. */
export interface LayerStackProps {
  title: string;
  items: LayerStackItem[];
  /** Kinds the user can add via the header palette. */
  paletteKinds: string[];
  onAdd: (kind: string) => void;
  onRemove: (id: number | string) => void;
  onReorder: (orderedIds: Array<number | string>) => void;
  onPrimaryChange: (id: number | string, nextValue: string) => void;
  /** Render the body controls for each item. */
  renderBody: (item: LayerStackItem) => ReactNode;
  /** Hide the title + palette row (used when an outer wrap renders its
   *  own head — see speech-balloons Tails panel). */
  hideHead?: boolean;
  /** Appended to the root element's class list. The module's own class names
   *  are hashed, so this is the supported way to reach the stack from a
   *  consumer stylesheet. */
  className?: string;
}

/** A drag-reorderable stack of expandable cards, with a palette in the header
 *  for adding more. The body of each card is the caller's to render. */
export function LayerStack({
  className,
  title,
  items,
  paletteKinds,
  onAdd,
  onRemove,
  onReorder,
  onPrimaryChange,
  renderBody,
  hideHead,
}: LayerStackProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number | string>>(
    () => new Set(items.filter((i) => i.defaultExpanded !== false).map((i) => i.id)),
  );

  useEffect(() => {
    setExpandedIds((prev) => {
      let next: Set<number | string> | null = null;
      for (const item of items) {
        if (item.defaultExpanded === false) continue;
        if (prev.has(item.id)) continue;
        if (next === null) next = new Set(prev);
        next.add(item.id);
      }
      return next ?? prev;
    });
  }, [items]);

  const dragItems = items.map((it) => ({ id: String(it.id), label: it.kind }));
  const drag = useReorderDragList({
    items: dragItems,
    selectedIds: [],
    onReorder: (ids, targetIndex) => {
      dlog('layer-stack', 'onReorder', { ids, targetIndex });
      const orig = items.map((i) => i.id);
      const moving = new Set(ids);
      const remaining = orig.filter((id) => !moving.has(String(id)));
      const movedIds = items.map((i) => i.id).filter((id) => moving.has(String(id)));
      // weasel reports targetIndex against the original list (which includes
      // the dragged row). Each moved item that originally sat before
      // targetIndex needs to shift the insertion point left by one.
      const shift = orig.filter((id, idx) => moving.has(String(id)) && idx < targetIndex).length;
      const adjusted = targetIndex - shift;
      const out = [...remaining];
      out.splice(adjusted, 0, ...movedIds);
      onReorder(out);
    },
  });

  const toggleExpanded = (id: number | string) => {
    setExpandedIds((current) => {
      const n = new Set(current);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className={className ? `${s.stack} ${className}` : s.stack}>
      {!hideHead && (
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <div className={s.palette}>
            {paletteKinds.map((k) => (
              <button
                key={k}
                type="button"
                className={s.add}
                onClick={() => {
                  dlog('layer-stack', 'onAdd', { kind: k });
                  onAdd(k);
                }}
                aria-label={`Add ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className={s.list}
        ref={drag.containerProps.ref as RefCallback<HTMLDivElement>}
      >
        {items.map((item, i) => {
          const expanded = expandedIds.has(item.id);
          const draggedId = drag.state.draggedIds?.[0];
          const isDragging = draggedId === String(item.id);
          const showHintBefore = drag.state.targetIndex === i && draggedId !== String(item.id);
          const showHintAfter = drag.state.targetIndex === items.length && i === items.length - 1;
          const cardCls = [
            s.card,
            isDragging ? s.cardDragging : '',
            item.accent ? s.cardAccented : '',
          ]
            .filter(Boolean)
            .join(' ');
          const cardStyle = item.accent
            ? ({ '--wzl-layer-stack-accent': item.accent } as CSSProperties)
            : undefined;
          const { onPointerDown } = drag.rowProps(String(item.id), i);
          return (
            <div key={item.id}>
              {showHintBefore && <div className={s.dropHint} />}
              <div className={cardCls} data-testid={`layer-card-${item.id}`} style={cardStyle}>
                <div className={s.cardHead}>
                  <button
                    type="button"
                    className={s.handle}
                    aria-label={`Drag to reorder layer ${item.id}`}
                    onPointerDown={onPointerDown}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    {item.badge ?? <DragHandleGlyph />}
                  </button>
                  {item.primaryValue !== undefined && item.primaryOptions ? (
                    <select
                      className={s.primary}
                      value={item.primaryValue}
                      aria-label={`Primary select for layer ${item.id}`}
                      onChange={(e) => onPrimaryChange(item.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.primaryOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={s.kind}>{item.kind}</span>
                  )}
                  <button
                    type="button"
                    className={s.remove}
                    aria-label="Remove layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {expanded && <div className={s.cardBody}>{renderBody(item)}</div>}
              </div>
              {showHintAfter && <div className={s.dropHint} />}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className={s.empty}>No layers — add one above.</div>
        )}
      </div>
    </div>
  );
}

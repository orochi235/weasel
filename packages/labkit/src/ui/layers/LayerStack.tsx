import { type CSSProperties, type ReactNode, type RefCallback, useState } from 'react';
import { useReorderDragList } from '../../passthrough/weasel-ui';

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
  /** Accent CSS color used as the left border / index-badge fill. */
  accent?: string;
  /** Optional badge text rendered before the primary control
   *  (e.g. tail index "1", "2", "3"). When omitted a drag handle
   *  glyph renders in its place. */
  badge?: string;
  /** Initial expanded state. Defaults to true for newly-added items. */
  defaultExpanded?: boolean;
}

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
}

export function LayerStack({
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

  const dragItems = items.map((it) => ({ id: String(it.id), label: it.kind }));
  const drag = useReorderDragList({
    items: dragItems,
    selectedIds: [],
    onReorder: (ids, targetIndex) => {
      const orig = items.map((i) => i.id);
      const moving = new Set(ids);
      const remaining = orig.filter((id) => !moving.has(String(id)));
      const movedIds = items.map((i) => i.id).filter((id) => moving.has(String(id)));
      const out = [...remaining];
      out.splice(targetIndex, 0, ...movedIds);
      onReorder(out);
    },
  });

  const toggleExpanded = (id: number | string) => {
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="lk-layer-stack">
      {!hideHead && (
        <div className="lk-layer-stack__head">
          <h2 className="lk-layer-stack__title">{title}</h2>
          <div className="lk-layer-stack__palette">
            {paletteKinds.map((k) => (
              <button
                key={k}
                type="button"
                className="lk-layer-stack__add"
                onClick={() => onAdd(k)}
                aria-label={`Add ${k}`}
              >
                + {k}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="lk-layer-stack__list"
        ref={drag.containerProps.ref as RefCallback<HTMLDivElement>}
        onPointerMove={drag.containerProps.onPointerMove}
        onPointerUp={drag.containerProps.onPointerUp}
        onPointerCancel={drag.containerProps.onPointerCancel}
      >
        {items.map((item, i) => {
          const expanded = expandedIds.has(item.id);
          const draggedId = drag.state.draggedIds?.[0];
          const isDragging = draggedId === String(item.id);
          const showHintBefore = drag.state.targetIndex === i && draggedId !== String(item.id);
          const showHintAfter = drag.state.targetIndex === items.length && i === items.length - 1;
          const cardCls = [
            'lk-layer-card',
            expanded ? 'is-expanded' : 'is-collapsed',
            isDragging ? 'is-dragging' : '',
            item.accent ? 'has-accent' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const cardStyle = item.accent
            ? ({ '--lk-layer-card-accent': item.accent } as CSSProperties)
            : undefined;
          const { onPointerDown } = drag.rowProps(String(item.id), i);
          return (
            <div key={item.id} className="lk-layer-card-wrap">
              {showHintBefore && <div className="lk-layer-stack__drop-hint" />}
              <div className={cardCls} data-testid={`lk-layer-card-${item.id}`} style={cardStyle}>
                <div className="lk-layer-card__head">
                  <button
                    type="button"
                    className="lk-layer-card__handle"
                    aria-label={`Drag to reorder layer ${item.id}`}
                    onPointerDown={onPointerDown}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    {item.badge ?? <DragHandleGlyph />}
                  </button>
                  {item.primaryValue !== undefined && item.primaryOptions ? (
                    <select
                      className="lk-layer-card__primary"
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
                    <span className="lk-layer-card__kind">{item.kind}</span>
                  )}
                  <button
                    type="button"
                    className="lk-layer-card__remove"
                    aria-label="Remove layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {expanded && <div className="lk-layer-card__body">{renderBody(item)}</div>}
              </div>
              {showHintAfter && <div className="lk-layer-stack__drop-hint" />}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="lk-layer-stack__empty">No layers — add one above.</div>
        )}
      </div>
    </div>
  );
}

function DragHandleGlyph() {
  return (
    <svg width="12" height="16" viewBox="0 0 8 16" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="3" r="1.1" />
      <circle cx="6" cy="3" r="1.1" />
      <circle cx="2" cy="8" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="2" cy="13" r="1.1" />
      <circle cx="6" cy="13" r="1.1" />
    </svg>
  );
}

import { type ReactNode, type RefCallback, useEffect, useState } from 'react';
import { dlog } from '../../dlog';
import { CloseIcon } from '../../icons';
import { useReorderDragList } from '../../useReorderDragList';
import { Button } from '../Button';
import { DragGhost } from '../DragGhost';
import { DragHandleGlyph } from '../DragHandleGlyph';
import { PropertyGroup, PropertyList } from '../Properties';
import { Select } from '../Select';
import type { StanceProps } from '../stance';
import s from './LayerStack.module.css';

/** One card in a layer stack: its identity, the label shown when collapsed,
 *  and the optional select hoisted into its header. */
export interface LayerStackItem {
  /** Stable id used for keys, onRemove, onReorder. Numeric to match
   *  common id-from-nextId conventions; string ids also work. */
  id: number | string;
  /** Short kind label rendered in the header when no primary select
   *  is hoisted (e.g. "shadow", "stroke"). Omit it for items that have no
   *  kind; `label` then names the card. */
  kind?: string;
  /** Header text, when the item's name is not its kind. Falls back to
   *  `kind`. */
  label?: string;
  /** When present, hoist this select into the card header so the user
   *  can switch mode/shape without expanding. */
  primaryValue?: string;
  primaryOptions?: string[];
  /** Which of its stack this card is: an index into the theme's tone list, or
   *  a color. Draws the card's edge and handle in it, and recolors every
   *  control inside the card. */
  tone?: StanceProps['tone'];
  /** Optional badge text rendered before the primary control
   *  (e.g. tail index "1", "2", "3"). When omitted a drag handle
   *  glyph renders in its place. */
  badge?: string;
  /** Initial expanded state. Defaults to true for newly-added items. */
  defaultExpanded?: boolean;
}

/** Props for `<LayerStack>`. */
export interface LayerStackProps {
  /** Heading above the list. Omit it, along with the palette, for a stack
   *  whose surroundings already name it. */
  title?: string;
  items: LayerStackItem[];
  /** Kinds the user can add via the header palette. Omit both this and
   *  `onAdd` for a stack the user cannot add to. */
  paletteKinds?: string[];
  onAdd?: (kind: string) => void;
  /** Omit for items the user cannot remove; the card then has no ✕. */
  onRemove?: (id: number | string) => void;
  onReorder: (orderedIds: Array<number | string>) => void;
  /** Required for `primaryValue` to render as a select — without a handler
   *  the control could not be changed. */
  onPrimaryChange?: (id: number | string, nextValue: string) => void;
  /** Render the body controls for each item. */
  renderBody: (item: LayerStackItem) => ReactNode;
  /** Shown in place of the list when `items` is empty. Defaults to a line
   *  that points at the palette, or a bare one when there is no palette. */
  emptyLabel?: ReactNode;
  /** Hide the title + palette row (used when an outer wrap renders its
   *  own head — see speech-balloons Tails panel). */
  hideHead?: boolean;
  /** Appended to the root element's class list. The module's own class names
   *  are hashed, so this is the supported way to reach the stack from a
   *  consumer stylesheet. */
  className?: string;
}

/** A drag-reorderable stack of expandable cards, with a palette in the header
 *  for adding more. The body of each card is the caller's to render.
 *
 *  Each card is a `<PropertyGroup>` in a `<PropertyList>`: its handle and
 *  remove button sit in the group's title row, a `tone` colors it, and a drag
 *  leaves the cards in place while a ghost of the dragged one follows the
 *  pointer. */
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
  emptyLabel,
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

  const dragItems = items.map((it) => ({
    id: String(it.id),
    label: it.label ?? it.kind ?? String(it.id),
  }));
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

  const palette = onAdd ? (paletteKinds ?? []) : [];
  const showHead = !hideHead && (title !== undefined || palette.length > 0);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const bindList = (el: HTMLDivElement | null) => {
    setList(el);
    (drag.containerProps.ref as RefCallback<HTMLDivElement>)(el);
  };
  const draggedId = drag.state.draggedIds?.[0];
  const target = drag.state.targetIndex;

  const titleOf = (item: LayerStackItem): ReactNode =>
    item.primaryValue !== undefined && item.primaryOptions && onPrimaryChange ? (
      <Select
        aria-label={`Primary select for layer ${item.id}`}
        width="fit"
        selectedKey={item.primaryValue}
        onSelectionChange={(value) => onPrimaryChange(item.id, String(value))}
        options={item.primaryOptions.map((o) => ({ value: o, label: o }))}
      />
    ) : (
      (item.label ?? item.kind)
    );

  const card = (item: LayerStackItem, i: number, ghost = false) => {
    const expanded = !ghost && expandedIds.has(item.id);
    const { onPointerDown } = drag.rowProps(String(item.id), i);
    const cls = [
      s.card,
      !ghost && draggedId === String(item.id) ? s.cardDragging : '',
      !ghost && target === i && draggedId !== String(item.id) ? s.dropBefore : '',
      !ghost && target === items.length && i === items.length - 1 ? s.dropAfter : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <PropertyGroup
        key={item.id}
        className={cls}
        title={titleOf(item)}
        {...(item.tone === undefined ? {} : { tone: item.tone })}
        collapsed={!expanded}
        onCollapsedChange={() => toggleExpanded(item.id)}
        leading={
          <button
            type="button"
            className={s.handle}
            aria-label={`Drag to reorder layer ${item.id}`}
            onPointerDown={ghost ? undefined : onPointerDown}
          >
            {item.badge ?? <DragHandleGlyph />}
          </button>
        }
        {...(onRemove && !ghost
          ? {
              actions: (
                <Button variant="ghost" size="sm" iconOnly ariaLabel="Remove layer" onClick={() => onRemove(item.id)}>
                  <CloseIcon size={14} />
                </Button>
              ),
            }
          : {})}
      >
        {ghost ? null : renderBody(item)}
      </PropertyGroup>
    );
  };

  return (
    <div className={className ? `${s.stack} ${className}` : s.stack}>
      {showHead && (
        <div className={s.head}>
          {title !== undefined && <h2 className={s.title}>{title}</h2>}
          <div className={s.palette}>
            {palette.map((k) => (
              <button
                key={k}
                type="button"
                className={s.add}
                onClick={() => {
                  dlog('layer-stack', 'onAdd', { kind: k });
                  onAdd?.(k);
                }}
                aria-label={`Add ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <div className={s.empty}>
          {emptyLabel ?? (palette.length > 0 ? 'No layers — add one above.' : 'No layers.')}
        </div>
      ) : (
        <PropertyList ref={bindList} className={s.list}>
          {items.map((item, i) => card(item, i))}
        </PropertyList>
      )}
      {drag.state.ghost && list ? (
        <DragGhost at={drag.state.ghost} from={list}>
          {items.filter((item) => drag.state.ghost?.ids.includes(String(item.id))).map((item) => card(item, -1, true))}
        </DragGhost>
      ) : null}
    </div>
  );
}

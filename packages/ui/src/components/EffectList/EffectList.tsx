import { useLayoutEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import { dropSide, moveItems, nudgeOf } from '@weasel-js/ui-input';
import { useReorderDragList } from '../../useReorderDragList';
import { useRemovedRowFocus } from '../../useRemovedRowFocus';
import { tintSource } from '../appearance';
import { EffectCard } from './EffectCard';
import s from './EffectList.module.css';

/** One operation in a {@link EffectList}: which kind it is, what it is called, and whether it runs. */
export interface EffectListItem {
  id: string;
  /** A key of the list's `kinds`. */
  kind: string;
  name: string;
  on: boolean;
}

/** How a {@link EffectList} draws one kind of operation. */
export interface EffectKind {
  label: string;
  /** The card's edge, tint, and number: an index into the theme's tint list, or a color source. */
  color: number | ColorSource;
  /** Drawn before the label. */
  icon?: IconRef;
}

/** Props for {@link EffectList}. */
export interface EffectListProps<T extends EffectListItem> {
  items: readonly T[];
  kinds: Readonly<Record<string, EffectKind>>;
  /** The whole list after a move, a switch, a rename, a duplicate, or a removal. */
  onChange(next: T[]): void;
  /** The id of the card that is open. */
  selected?: string | null;
  /** A press on a card's number that does not drag it: its id, or `null` when it was the open card. */
  onSelectionChange?(id: string | null): void;
  /** The open card's settings, drawn under its header. */
  renderBody?(item: T): ReactNode;
  /** A copy of `item` with an id of its own, inserted after it. Unset, cards have no duplicate button. */
  onDuplicate?(item: T): T;
  /** Cards have a remove button. Default `true`. */
  removable?: boolean;
  'aria-label'?: string;
  className?: string;
}

/**
 * An ordered list of effects or operations that run top to bottom, each drawn as a card
 * in its kind's color. A card is dragged by its number, or moved with Alt+Up / Alt+Down from anywhere in it;
 * a press on the number that does not drag opens or closes it. Each card switches on and off, is renamed in
 * place, and can be duplicated and removed. Only the open card shows its body.
 */
export function EffectList<T extends EffectListItem>({
  items,
  kinds,
  onChange,
  selected = null,
  onSelectionChange,
  renderBody,
  onDuplicate,
  removable = true,
  'aria-label': ariaLabel,
  className,
}: EffectListProps<T>) {
  const css = useColorCss();
  const reorderItems = useMemo(() => items.map((it) => ({ id: it.id, label: it.name })), [items]);
  const kindList = useMemo(() => Object.values(kinds), [kinds]);
  const drag = useReorderDragList({
    items: reorderItems,
    selectedIds: [],
    onReorder: ([id], to) => onChange(moveItems(items, [items.findIndex((it) => it.id === id)], to)),
    onPress: (id) => onSelectionChange?.(selected === id ? null : id),
  });
  const { targetIndex, draggedIds } = drag.state;
  // A card removed with focus in it hands focus to the remove button of the card that takes its place, else its number.
  const kept = useRemovedRowFocus<HTMLDivElement>(reorderItems, (id, els) => {
    const card = els.get(id);
    (card?.querySelector<HTMLElement>('[data-effect-remove]') ?? card?.querySelector<HTMLElement>(`.${s.number}`))?.focus();
  });

  // A browser drops focus from a node the reorder moves in the DOM.
  const refocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = refocus.current;
    refocus.current = null;
    if (el?.isConnected && document.activeElement !== el) el.focus();
  });

  const nudge = (e: KeyboardEvent, item: T, i: number): void => {
    // A list nested in a card's body has already moved its own card.
    if (e.defaultPrevented) return;
    const by = nudgeOf(e);
    if (by === null) return;
    e.preventDefault();
    if (drag.nudge(item.id, i, by)) refocus.current = e.target as HTMLElement;
  };
  const patch = (id: string, next: Partial<EffectListItem>): void =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...next } : it)));
  const remove = (item: T): void => {
    onChange(items.filter((it) => it.id !== item.id));
    if (selected === item.id) onSelectionChange?.(null);
  };
  const duplicate = onDuplicate
    ? (item: T, i: number): void => onChange([...items.slice(0, i + 1), onDuplicate(item), ...items.slice(i + 1)])
    : undefined;

  return (
    <div
      className={[s.list, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
      ref={drag.containerProps.ref}
    >
      {items.map((item, i) => {
        const kind = kinds[item.kind];
        const side = dropSide(targetIndex, i, items.length);
        return (
          <EffectCard
            key={item.id}
            cardRef={kept.rowRef(item.id)}
            item={item}
            index={i}
            kind={kind}
            kinds={kindList}
            color={kind ? css(tintSource(kind.color)) : undefined}
            open={selected === item.id}
            dragging={draggedIds?.includes(item.id) ?? false}
            drop={side}
            onGripDown={drag.rowProps(item.id, i).onPointerDown}
            onToggleOpen={() => onSelectionChange?.(selected === item.id ? null : item.id)}
            onKeyDown={(e) => nudge(e, item, i)}
            onPatch={(next) => patch(item.id, next)}
            onDuplicate={duplicate && (() => duplicate(item, i))}
            onRemove={removable ? () => remove(item) : undefined}
          >
            {selected === item.id ? renderBody?.(item) : undefined}
          </EffectCard>
        );
      })}
    </div>
  );
}

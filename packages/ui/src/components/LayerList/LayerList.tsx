import { type ReactNode, type RefCallback, useId, useRef, useState } from 'react';
import { dlog } from '../../dlog';
import { CloseIcon, LockIcon } from '../../icons';
import { type PressModifiers, useReorderDragList } from '../../useReorderDragList';
import { Button } from '../Button';
import { Disclosure } from '../Disclosure';
import { DragGhost } from '../DragGhost';
import { DragHandleGlyph } from '../DragHandleGlyph';
import rows from '../ItemList/ItemList.module.css';
import { PropertyGroup, PropertyList } from '../Properties';
import type { StanceProps } from '../stance';
import s from './LayerList.module.css';

/** One layer. With a body (see `renderBody`) it draws as a card that folds its
 *  body away; without one, as a one-line row. Either can hold child layers. */
export interface LayerListItem {
  id: string;
  /** The layer's name. Also what its controls are labeled by. */
  label: string;
  /** Shown in the header in place of `label` — a select that switches the
   *  layer's kind, say. */
  title?: ReactNode;
  /** Fixed-size content before the label: a color swatch, a kind icon. */
  leading?: ReactNode;
  /** Drawn in the drag handle in place of the grip — an ordinal. */
  badge?: ReactNode;
  /** Which of its list this layer is: an index into the theme's tone list, or
   *  a color. A card draws its edge and handle in it and recolors its controls. */
  tone?: StanceProps['tone'];
  /** Cannot be dragged, hidden or removed, walls off drops on either side, and
   *  selects alone rather than joining a multi-selection. */
  locked?: boolean;
  /** Shown or not, when the list has `onVisibilityChange`. Default true. */
  visible?: boolean;
  children?: LayerListItem[];
  /** Folds the body and children away until the user opens them.
   *  `collapsedIds` overrides it. */
  defaultCollapsed?: boolean;
}

/**
 * A reorder: `ids`, siblings under `parentId` (`null` at the top level), now
 * sit as one block in list order starting at `index` of the parent's children.
 * A drag never moves a layer to another parent.
 */
export interface LayerMove {
  ids: string[];
  parentId: string | null;
  index: number;
}

/** Props for `<LayerList>`. */
export interface LayerListProps {
  items: LayerListItem[];
  /** Omit for a list the user cannot reorder. */
  onReorder?: (move: LayerMove) => void;
  /** Giving both makes rows selectable: a click selects one, shift-click adds
   *  or removes one, and dragging a selected row drags its selected siblings. */
  selectedIds?: readonly string[];
  onSelect?: (ids: string[]) => void;
  /** Adds a visibility checkbox to every unlocked layer. */
  onVisibilityChange?: (id: string, visible: boolean) => void;
  /** Adds a ✕ to every unlocked layer. */
  onRemove?: (id: string) => void;
  /** A layer's controls. Returning `null` leaves that layer a one-line row. */
  renderBody?: (item: LayerListItem) => ReactNode;
  /** Ids whose body and children are folded away. Giving it makes folding
   *  controlled; `onCollapsedChange` fires either way. */
  collapsedIds?: readonly string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** Heading above the list. */
  title?: string;
  /** Kinds the user can add, as buttons beside the title. Shown only with `onAdd`. */
  addKinds?: string[];
  onAdd?: (kind: string) => void;
  /** Shown in place of the list when `items` is empty. */
  empty?: ReactNode;
  /** Appended to the root's class list — the module's own names are hashed. */
  className?: string;
}

/** Returns `items` with `move` applied, for a consumer that holds the tree as state. */
export function moveLayers(items: LayerListItem[], move: LayerMove): LayerListItem[] {
  if (move.parentId === null) return reorder(items, move);
  return items.map((item) => {
    if (item.id === move.parentId) return { ...item, children: reorder(item.children ?? [], move) };
    return item.children ? { ...item, children: moveLayers(item.children, move) } : item;
  });
}

function reorder(siblings: LayerListItem[], { ids, index }: LayerMove): LayerListItem[] {
  const moving = new Set(ids);
  const kept = siblings.filter((it) => !moving.has(it.id));
  const moved = siblings.filter((it) => moving.has(it.id));
  const at = Math.max(0, Math.min(kept.length, index));
  return [...kept.slice(0, at), ...moved, ...kept.slice(at)];
}

function collectCollapsed(
  items: LayerListItem[],
  isCollapsed: (item: LayerListItem) => boolean,
  into = new Set<string>(),
): Set<string> {
  for (const item of items) {
    if (isCollapsed(item)) into.add(item.id);
    if (item.children) collectCollapsed(item.children, isCollapsed, into);
  }
  return into;
}

function anyNested(items: LayerListItem[]): boolean {
  return items.some((it) => (it.children?.length ?? 0) > 0);
}

/** What every level of the tree reads from the list. */
interface Shared {
  props: LayerListProps;
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  press: (item: LayerListItem, mods: PressModifiers) => void;
  uid: string;
  /** Some layer has children, so every row keeps a twisty column. */
  nested: boolean;
}

/**
 * An ordered, drag-reorderable list of layers — a document's objects, a lab's
 * canvases, a fill's effects. Each layer is a one-line row or, with a body, a
 * card whose controls fold away; either can nest child layers. Selection,
 * visibility, removal and an add palette are each on when their handler is given.
 */
export function LayerList(props: LayerListProps) {
  const { items, collapsedIds, onCollapsedChange, title, addKinds, onAdd, empty, className } = props;
  // Only the user's own toggles are state; everything else reads the layer's
  // `defaultCollapsed`, so a layer added later starts the way it asks to.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const collapsed = collapsedIds
    ? new Set(collapsedIds)
    : collectCollapsed(items, (item) => toggled.get(item.id) ?? item.defaultCollapsed === true);
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!collapsedIds) setToggled((prev) => new Map(prev).set(id, next.has(id)));
    onCollapsedChange?.([...next]);
  };

  // The press arrives after the drag session ends, which can be after a render
  // the closure did not see, so it reads the selection from here.
  const live = useRef(props);
  live.current = props;
  const press = (item: LayerListItem, mods: PressModifiers) => {
    const { selectedIds = [], onSelect } = live.current;
    if (!onSelect) return;
    if (item.locked || !mods.shiftKey) {
      onSelect([item.id]);
      return;
    }
    // A leftover locked selection does not carry into a multi-selection.
    const locked = new Set(lockedIds(live.current.items));
    const kept = selectedIds.filter((id) => !locked.has(id));
    onSelect(kept.includes(item.id) ? kept.filter((id) => id !== item.id) : [...kept, item.id]);
  };

  const uid = useId();
  const shared: Shared = { props, collapsed, toggle, press, uid, nested: anyNested(items) };
  const palette = onAdd ? (addKinds ?? []) : [];
  const cls = className ? `${s.root} ${className}` : s.root;

  return (
    <div className={cls}>
      {(title !== undefined || palette.length > 0) && (
        <div className={s.head}>
          {title !== undefined && <h2 className={s.title}>{title}</h2>}
          <div className={s.palette}>
            {palette.map((kind) => (
              <button
                key={kind}
                type="button"
                className={s.add}
                aria-label={`Add ${kind}`}
                onClick={() => {
                  dlog('layer-list', 'onAdd', { kind });
                  onAdd?.(kind);
                }}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <div className={rows.empty}>
          {empty ?? (palette.length > 0 ? 'No layers — add one above.' : 'No layers.')}
        </div>
      ) : (
        <Level items={items} parentId={null} shared={shared} path="" />
      )}
    </div>
  );
}

function lockedIds(items: LayerListItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it.locked) out.push(it.id);
    if (it.children) out.push(...lockedIds(it.children));
  }
  return out;
}

interface LevelProps {
  items: LayerListItem[];
  parentId: string | null;
  shared: Shared;
  path: string;
}

/** One sibling group. Each has its own drag, so a drag stays under one parent. */
function Level({ items, parentId, shared, path }: LevelProps) {
  const { props } = shared;
  const selected = props.selectedIds ?? [];
  const drag = useReorderDragList({
    // With no `onReorder` every row is a locked one to the drag, so a press
    // still reaches `onPress` and nothing ever engages.
    items: items.map((it) => ({ id: it.id, label: it.label, locked: it.locked || !props.onReorder })),
    selectedIds: items.filter((it) => selected.includes(it.id)).map((it) => it.id),
    onReorder: (ids, target) => {
      const moving = new Set(ids);
      const inOrder = items.filter((it) => moving.has(it.id)).map((it) => it.id);
      // The hook's index counts the dragged rows; a move's index does not.
      const before = items.slice(0, target).filter((it) => moving.has(it.id)).length;
      const move = { ids: inOrder, parentId, index: target - before };
      dlog('layer-list', 'onReorder', move);
      props.onReorder?.(move);
    },
    onPress: (id, mods) => {
      const item = items.find((it) => it.id === id);
      if (item) shared.press(item, mods);
    },
  });
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const bind = (node: HTMLDivElement | null) => {
    setEl(node);
    (drag.containerProps.ref as RefCallback<HTMLDivElement>)(node);
  };

  const bodies = items.map((it) => (props.renderBody ? props.renderBody(it) : null));
  const cards = bodies.some((b) => b !== null && b !== undefined);
  const { draggedIds, targetIndex, ghost } = drag.state;

  const entry = (item: LayerListItem, i: number, ghosted: boolean) => {
    const body = bodies[i];
    const kids = item.children ?? [];
    const open = !shared.collapsed.has(item.id);
    const childId = `${shared.uid}${path}-${i}`;
    const onPointerDown = ghosted ? undefined : drag.rowProps(item.id, i).onPointerDown;
    const isSelected = selected.includes(item.id);
    const cls = [s.entry];
    if (!ghosted) {
      if (draggedIds?.includes(item.id)) cls.push(s.dragging);
      if (targetIndex === i && !draggedIds?.includes(item.id)) cls.push(s.dropBefore);
      if (targetIndex === items.length && i === items.length - 1) cls.push(s.dropAfter);
    }
    const controls = <Controls item={item} shared={shared} />;
    const head =
      body !== null && body !== undefined ? (
        <PropertyGroup
          className={s.card}
          title={item.title ?? item.label}
          {...(item.tone === undefined ? {} : { tone: item.tone })}
          collapsed={ghosted || !open}
          onCollapsedChange={() => shared.toggle(item.id)}
          leading={
            <Handle item={item} reorder={props.onReorder !== undefined} onPointerDown={onPointerDown} />
          }
          actions={ghosted ? undefined : controls}
        >
          {ghosted ? null : body}
        </PropertyGroup>
      ) : (
        <div
          className={[rows.row, s.row, isSelected ? rows.selected : ''].filter(Boolean).join(' ')}
          data-selected={isSelected ? 'true' : undefined}
          data-locked={item.locked ? 'true' : undefined}
          onPointerDown={onPointerDown}
        >
          {shared.nested &&
            (kids.length > 0 ? (
              <span className={s.stop} onPointerDown={stop}>
                <Disclosure
                  open={open}
                  onToggle={() => shared.toggle(item.id)}
                  label={`${item.label} sublayers`}
                  controls={childId}
                />
              </span>
            ) : (
              <span className={s.twistyGap} />
            ))}
          <Grip item={item} reorder={props.onReorder !== undefined} />
          {props.onVisibilityChange &&
            (item.locked ? (
              <span className={s.check} />
            ) : (
              <input
                className={s.check}
                type="checkbox"
                checked={item.visible !== false}
                onPointerDown={stop}
                onChange={(e) => props.onVisibilityChange?.(item.id, e.target.checked)}
                aria-label={`Show ${item.label}`}
              />
            ))}
          {item.leading}
          <span className={rows.label}>{item.title ?? item.label}</span>
          {ghosted ? null : <Remove item={item} shared={shared} />}
        </div>
      );
    return (
      <div key={item.id} className={cls.join(' ')} data-selected={isSelected ? 'true' : undefined}>
        {head}
        {!ghosted && kids.length > 0 && open && (
          <div id={childId} className={s.children}>
            <Level items={kids} parentId={item.id} shared={shared} path={`${path}-${i}`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {cards ? (
        <PropertyList ref={bind} className={`${s.level} ${s.cards}`}>
          {items.map((it, i) => entry(it, i, false))}
        </PropertyList>
      ) : (
        <div ref={bind} className={s.level}>
          {items.map((it, i) => entry(it, i, false))}
        </div>
      )}
      {ghost && el ? (
        <DragGhost at={ghost} from={el}>
          {items.map((it, i) => (ghost.ids.includes(it.id) ? entry(it, i, true) : null))}
        </DragGhost>
      ) : null}
    </>
  );
}

// Keeps a press on a control inside a row from also starting the row's press.
const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

/** A row's grip: decoration, since the whole row takes the drag. */
function Grip({ item, reorder }: { item: LayerListItem; reorder: boolean }) {
  if (item.locked) {
    return (
      <span className={s.lock} role="img" aria-label="Locked">
        <LockIcon size={12} />
      </span>
    );
  }
  if (!reorder && item.badge === undefined) return null;
  return (
    <span className={s.grip} aria-hidden="true">
      {item.badge ?? <DragHandleGlyph size={13} />}
    </span>
  );
}

/** A card's handle: the drag target, since the rest of its head folds it. */
function Handle({
  item,
  reorder,
  onPointerDown,
}: {
  item: LayerListItem;
  reorder: boolean;
  onPointerDown: ((e: React.PointerEvent) => void) | undefined;
}) {
  if (item.locked) return <Grip item={item} reorder={reorder} />;
  if (!reorder && item.badge === undefined) return undefined;
  return (
    <button
      type="button"
      className={s.handle}
      aria-label={`Drag to reorder ${item.label}`}
      onPointerDown={onPointerDown}
    >
      {item.badge ?? <DragHandleGlyph />}
    </button>
  );
}

function Controls({ item, shared }: { item: LayerListItem; shared: Shared }) {
  const { onVisibilityChange } = shared.props;
  return (
    <>
      {onVisibilityChange && !item.locked && (
        <input
          className={s.check}
          type="checkbox"
          checked={item.visible !== false}
          onClick={stop}
          onChange={(e) => onVisibilityChange(item.id, e.target.checked)}
          aria-label={`Show ${item.label}`}
        />
      )}
      <Remove item={item} shared={shared} />
    </>
  );
}

function Remove({ item, shared }: { item: LayerListItem; shared: Shared }) {
  const { onRemove } = shared.props;
  if (!onRemove || item.locked) return null;
  return (
    <span className={s.stop} onPointerDown={stop}>
      <Button variant="ghost" size="sm" iconOnly ariaLabel={`Remove ${item.label}`} onClick={() => onRemove(item.id)}>
        <CloseIcon size={14} />
      </Button>
    </span>
  );
}

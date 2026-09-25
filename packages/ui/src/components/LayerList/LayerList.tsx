import {
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  /** Names the list for assistive tech when it has no `title`. */
  label?: string;
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
  /** Each layer's body, rendered once; a row where it is empty. */
  bodies: ReadonlyMap<string, ReactNode>;
  /** Per sibling group, keyed by parent: move a row one place, as its drag would. */
  nudgers: Map<string | null, (id: string, delta: -1 | 1) => boolean>;
  keys: RowKeys;
}

/** The roving focus over the rows: one row is in the tab order at a time. */
interface RowKeys {
  tabStop: string | undefined;
  register: (id: string) => (el: HTMLElement | null) => void;
  onKeyDown: (item: LayerListItem, parentId: string | null) => (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (id: string) => void;
}

interface VisibleRow {
  item: LayerListItem;
  parentId: string | null;
  level: number;
}

function hasBody(body: ReactNode): boolean {
  return body !== null && body !== undefined && body !== false;
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
    anchor.current = item.id;
    if (item.locked || !mods.shiftKey) {
      onSelect([item.id]);
      return;
    }
    // A leftover locked selection does not carry into a multi-selection.
    const locked = new Set(lockedIds(live.current.items));
    const kept = selectedIds.filter((id) => !locked.has(id));
    onSelect(kept.includes(item.id) ? kept.filter((id) => id !== item.id) : [...kept, item.id]);
  };

  const bodies = new Map<string, ReactNode>();
  const collectBodies = (list: LayerListItem[]) => {
    for (const it of list) {
      bodies.set(it.id, props.renderBody ? props.renderBody(it) : null);
      if (it.children) collectBodies(it.children);
    }
  };
  collectBodies(items);

  // The rows the arrow keys walk: open branches only, and not cards, whose
  // heads are their own controls.
  const visible: VisibleRow[] = [];
  const walk = (list: LayerListItem[], parentId: string | null, level: number) => {
    for (const item of list) {
      if (!hasBody(bodies.get(item.id))) visible.push({ item, parentId, level });
      if (item.children?.length && !collapsed.has(item.id)) walk(item.children, item.id, level + 1);
    }
  };
  walk(items, null, 1);

  const rowEls = useRef(new Map<string, HTMLElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const anchor = useRef<string | null>(null);
  const nudgers = useRef(new Map<string | null, (id: string, delta: -1 | 1) => boolean>()).current;
  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    const el = rowEls.current.get(id);
    if (el && document.activeElement !== el) el.focus();
  });

  const selectedIds = props.selectedIds ?? [];
  const tabStop = visible.some((v) => v.item.id === focusId)
    ? (focusId ?? undefined)
    : (visible.find((v) => selectedIds.includes(v.item.id)) ?? visible[0])?.item.id;

  const focusRow = (id: string) => {
    pendingFocus.current = id;
    setFocusId(id);
  };
  // Locked rows never join a multi-selection, so a range passes over them.
  const selectRange = (to: string) => {
    const from = anchor.current ?? to;
    const a = visible.findIndex((v) => v.item.id === from);
    const b = visible.findIndex((v) => v.item.id === to);
    if (a < 0 || b < 0) return;
    const range = visible
      .slice(Math.min(a, b), Math.max(a, b) + 1)
      .filter((v) => !v.item.locked)
      .map((v) => v.item.id);
    if (range.length > 0) live.current.onSelect?.(range);
  };

  const keys: RowKeys = {
    tabStop,
    register: (id) => (el) => {
      if (el) rowEls.current.set(id, el);
      else rowEls.current.delete(id);
    },
    onFocus: (id) => {
      setFocusId(id);
      anchor.current ??= id;
    },
    onKeyDown: (item, parentId) => (e) => {
      // Keys on a control inside the row are the control's.
      if (e.target !== e.currentTarget) return;
      const at = visible.findIndex((v) => v.item.id === item.id);
      const go = (index: number) => {
        const next = visible[Math.max(0, Math.min(visible.length - 1, index))];
        if (!next) return;
        focusRow(next.item.id);
        if (e.shiftKey && props.onSelect) selectRange(next.item.id);
        else anchor.current = next.item.id;
      };
      const branch = (item.children?.length ?? 0) > 0;
      const open = branch && !collapsed.has(item.id);
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          if (e.altKey) {
            if (nudgers.get(parentId)?.(item.id, delta)) pendingFocus.current = item.id;
          } else {
            go(at + delta);
          }
          break;
        }
        case 'Home':
          go(0);
          break;
        case 'End':
          go(visible.length - 1);
          break;
        case 'ArrowRight':
          if (branch && !open) toggle(item.id);
          else if (open) go(at + 1);
          else return;
          break;
        case 'ArrowLeft':
          if (open) toggle(item.id);
          else if (parentId !== null) go(visible.findIndex((v) => v.item.id === parentId));
          else return;
          break;
        case 'Enter':
        case ' ':
          press(item, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey });
          break;
        default:
          return;
      }
      e.preventDefault();
    },
  };

  const uid = useId();
  const shared: Shared = { props, collapsed, toggle, press, uid, nested: anyNested(items), bodies, nudgers, keys };
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
        <Level items={items} parentId={null} shared={shared} path="" level={1} />
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
  level: number;
}

/** One sibling group. Each has its own drag, so a drag stays under one parent. */
function Level({ items, parentId, shared, path, level }: LevelProps) {
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
  shared.nudgers.set(parentId, (id, delta) =>
    drag.nudge(id, items.findIndex((it) => it.id === id), delta),
  );
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const bind = (node: HTMLDivElement | null) => {
    setEl(node);
    (drag.containerProps.ref as RefCallback<HTMLDivElement>)(node);
  };

  const bodies = items.map((it) => shared.bodies.get(it.id));
  const cards = bodies.some(hasBody);
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
      hasBody(body) ? (
        <PropertyGroup
          className={s.card}
          title={item.title ?? item.label}
          {...(item.tone === undefined ? {} : { tone: item.tone })}
          collapsed={ghosted || !open}
          onCollapsedChange={() => shared.toggle(item.id)}
          leading={
            <Handle
              item={item}
              reorder={props.onReorder !== undefined}
              onPointerDown={onPointerDown}
              onNudge={(delta) => shared.nudgers.get(parentId)?.(item.id, delta)}
            />
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
          {...(ghosted
            ? {}
            : {
                role: 'row',
                'aria-level': level,
                ...(kids.length > 0 ? { 'aria-expanded': open } : {}),
                ...(props.onSelect ? { 'aria-selected': isSelected } : {}),
                tabIndex: shared.keys.tabStop === item.id ? 0 : -1,
                ref: shared.keys.register(item.id),
                onKeyDown: shared.keys.onKeyDown(item, parentId),
                onFocus: () => shared.keys.onFocus(item.id),
              })}
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
      <div key={item.id} role="none" className={cls.join(' ')} data-selected={isSelected ? 'true' : undefined}>
        {head}
        {!ghosted && kids.length > 0 && open && (
          <div id={childId} role="rowgroup" className={s.children}>
            <Level items={kids} parentId={item.id} shared={shared} path={`${path}-${i}`} level={level + 1} />
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
        <div
          ref={bind}
          className={s.level}
          {...(parentId === null
            ? {
                role: 'treegrid',
                'aria-label': props.label ?? props.title ?? 'Layers',
                ...(props.onSelect ? { 'aria-multiselectable': true } : {}),
              }
            : { role: 'none' })}
        >
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

/** A card's handle: the drag target, since the rest of its head folds it, and
 *  Alt+Up/Down on it moves the card. */
function Handle({
  item,
  reorder,
  onPointerDown,
  onNudge,
}: {
  item: LayerListItem;
  reorder: boolean;
  onPointerDown: ((e: React.PointerEvent) => void) | undefined;
  onNudge: (delta: -1 | 1) => void;
}) {
  if (item.locked) return <Grip item={item} reorder={reorder} />;
  if (!reorder && item.badge === undefined) return undefined;
  return (
    <button
      type="button"
      className={s.handle}
      aria-label={`Drag to reorder ${item.label}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        onNudge(e.key === 'ArrowUp' ? -1 : 1);
      }}
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

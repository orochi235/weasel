import {
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLatest } from '@weasel-js/core';
import { dlog } from '../../dlog';
import { intentOf, select, type SelectPolicy } from '@weasel-js/select';
import { LIST_KEYS, type PressModifiers, selectModifiers, useReorderDragList } from '../../useReorderDragList';
import { DragGhost } from '../DragGhost';
import rows from '../ItemList/ItemList.module.css';
import { PropertyGroup, PropertyList } from '../Properties';
import s from './LayerList.module.css';
import type { LayerListItem, LayerListProps, LayerMove } from './layerListProps';
import { Controls, Handle, Row, rowContextMenu } from './LayerRow';
export type { LayerListItem, LayerListProps, LayerMove };

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
export interface Shared {
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
  /** A row's own control is about to remove it. */
  onRemoving: (id: string) => void;
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
  const live = useLatest(props);
  // Fixed rows never join a multi-selection: pressed, one is selected alone, and a range or a
  // toggle passes over them.
  const unlocked = () => {
    const fixed = new Set(fixedIds(live.current.items));
    return (id: string) => !fixed.has(id);
  };
  const press = (item: LayerListItem, mods: PressModifiers) => {
    const { selectedIds = [], onSelect } = live.current;
    if (!onSelect) return;
    const next = select({ ids: selectedIds, anchor: anchor.current }, item.id, intentOf(selectModifiers(mods), PRESS_POLICY), {
      order: order.current, eligible: unlocked(),
    });
    anchor.current = next.anchor;
    onSelect([...next.ids]);
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
  const order = useLatest(visible.map((v) => v.item.id));

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
  // A row removed from inside itself takes focus with it; the row that takes its place gets it.
  const removing = useRef<{ id: string; at: number } | null>(null);
  useLayoutEffect(() => {
    const gone = removing.current;
    if (!gone) return;
    if (visible.some((v) => v.item.id === gone.id)) {
      if (!rowEls.current.get(gone.id)?.contains(document.activeElement)) removing.current = null;
      return;
    }
    removing.current = null;
    const next = visible[Math.min(gone.at, visible.length - 1)];
    if (next) rowEls.current.get(next.item.id)?.focus();
  });

  const selectedIds = props.selectedIds ?? [];
  const tabStop = visible.some((v) => v.item.id === focusId)
    ? (focusId ?? undefined)
    : (visible.find((v) => selectedIds.includes(v.item.id)) ?? visible[0])?.item.id;

  const focusRow = (id: string) => {
    pendingFocus.current = id;
    setFocusId(id);
  };
  const selectRange = (to: string) => {
    const before = { ids: live.current.selectedIds ?? [], anchor: anchor.current };
    const next = select(before, to, 'range', { order: order.current, eligible: unlocked() });
    anchor.current = next.anchor;
    if (next !== before) live.current.onSelect?.([...next.ids]);
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
    onRemoving: (id) => {
      const at = visible.findIndex((v) => v.item.id === id);
      if (at >= 0 && rowEls.current.get(id)?.contains(document.activeElement)) removing.current = { id, at };
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
          else {
            const parent = visible.findIndex((v) => v.item.id === parentId);
            if (parent < 0) return;
            go(parent);
          }
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
        <Level items={items} parentId={null} shared={shared} path="" level={1} grid={false} name={props.label ?? title ?? 'Layers'} />
      )}
    </div>
  );
}

const PRESS_POLICY: SelectPolicy = { mode: 'multi', ...LIST_KEYS };

function fixedIds(items: LayerListItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it.fixed) out.push(it.id);
    if (it.children) out.push(...fixedIds(it.children));
  }
  return out;
}

interface LevelProps {
  items: LayerListItem[];
  parentId: string | null;
  shared: Shared;
  path: string;
  /** A row's depth in the treegrid that holds it. */
  level: number;
  /** A treegrid above already holds this level's rows; otherwise the level opens its own. */
  grid: boolean;
  /** What a treegrid opened here is called: the card above, else the list. */
  name: string;
}

/** `entries` in order, with each run of consecutive rows (not cards) handed to `wrap`. */
function wrapRuns(entries: ReactNode[], isCard: boolean[], wrap: (run: ReactNode[], at: number) => ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ReactNode[] = [];
  entries.forEach((entry, i) => {
    if (!isCard[i]) run.push(entry);
    if (run.length > 0 && (isCard[i] || i === entries.length - 1)) {
      out.push(wrap(run, i));
      run = [];
    }
    if (isCard[i]) out.push(entry);
  });
  return out;
}

/** One sibling group. Each has its own drag, so a drag stays under one parent. */
function Level({ items, parentId, shared, path, level, grid, name }: LevelProps) {
  const { props } = shared;
  const selected = props.selectedIds ?? [];
  const drag = useReorderDragList({
    // With no `onReorder` every row is a wall to the drag, so a press still
    // reaches `onPress` and nothing ever engages. Locked content cannot move.
    items: items.map((it) => ({ id: it.id, label: it.label, locked: it.fixed || it.locked || !props.onReorder })),
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
    groupSelector: '[data-run]',
  });
  shared.nudgers.set(parentId, (id, delta) =>
    drag.nudge(id, items.findIndex((it) => it.id === id), delta),
  );
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // Stable, or every commit detaches and re-attaches it and re-renders the level.
  const dragRef = drag.containerProps.ref as RefCallback<HTMLDivElement>;
  const bind = useCallback(
    (node: HTMLDivElement | null) => {
      setEl(node);
      dragRef(node);
    },
    [dragRef],
  );

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
    // A card outside any grid starts one for the rows under it.
    const below = grid || !hasBody(body) ? { level: level + 1, grid: true, name } : { level: 1, grid: false, name: item.label };
    const head =
      hasBody(body) ? (
        <PropertyGroup
          className={s.card}
          title={item.title ?? item.label}
          {...(item.tint === undefined ? {} : { tint: item.tint })}
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
          onContextMenu={rowContextMenu(shared, item, ghosted)}
        >
          {ghosted ? null : body}
        </PropertyGroup>
      ) : (
        <Row
          item={item}
          shared={shared}
          parentId={parentId}
          level={level}
          ghosted={ghosted}
          selected={isSelected}
          open={open}
          childId={childId}
          onPointerDown={onPointerDown}
        />
      );
    return (
      <div key={item.id} role="none" className={cls.join(' ')} data-selected={isSelected ? 'true' : undefined}>
        {head}
        {!ghosted && kids.length > 0 && open && (
          <div id={childId} role={below.grid ? 'rowgroup' : undefined} className={s.children}>
            <Level items={kids} parentId={item.id} shared={shared} path={`${path}-${i}`} {...below} />
          </div>
        )}
      </div>
    );
  };

  const gridProps = {
    role: 'treegrid',
    'aria-label': name,
    ...(props.onSelect ? { 'aria-multiselectable': true } : {}),
  };
  const entries = items.map((it, i) => entry(it, i, false));

  return (
    <>
      {cards ? (
        <PropertyList ref={bind} className={`${s.level} ${s.cards}`}>
          {grid
            ? entries
            : wrapRuns(entries, bodies.map(hasBody), (run, at) => (
                <div key={`run-${at}`} data-run="" className={s.run} {...gridProps}>
                  {run}
                </div>
              ))}
        </PropertyList>
      ) : (
        <div ref={bind} className={s.level} {...(grid ? { role: 'none' } : gridProps)}>
          {entries}
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

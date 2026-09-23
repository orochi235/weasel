/**
 * A hierarchy of rows that expand and collapse: a file tree, a registry
 * browser, an outline.
 *
 * **Semantics.** WAI-ARIA `tree`: each node is a `treeitem` carrying
 * `aria-level`, `aria-setsize` and `aria-posinset`; a branch carries
 * `aria-expanded` and nests its children in a `group`, which is rendered only
 * while the branch is open. `aria-selected` appears only when `selectionMode`
 * is set. A treeitem may not contain interactive content, so `leading` and
 * `trailing` are decoration — an icon, a count — and the twisty is a drawn
 * `DisclosureMark`, not a button.
 *
 * **Keyboard.** One treeitem is in the tab order: the one last focused, else
 * the first selected, else the first. Up/Down move between visible rows,
 * Home/End go to the first and last. Right opens a closed branch, then moves
 * into it; Left closes an open branch, else moves to the parent. Enter and
 * Space activate, as a click does. Typing moves to the next row whose text
 * starts with what was typed.
 *
 * **Activating** a row — click, Enter, Space — toggles it if it is a branch,
 * selects it under `selectionMode`, and calls `onAction`. Clicking the twisty
 * only toggles.
 *
 * **Filtering** is the consumer's: narrow `nodes` with `filterTree`, and pass
 * `treeBranchIds` of the result as `expandedIds` so every match shows.
 */
import {
  forwardRef,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import type { PressModifiers } from '../../useReorderDragList';
import { DisclosureMark } from '../Disclosure';
import s from './Tree.module.css';

/** One node. A node with `children` is a branch, even when the array is empty. */
export interface TreeNode {
  /** Unique across the whole tree. */
  id: string;
  label: ReactNode;
  /** What type-ahead matches against. Defaults to `label` when that is a string. */
  textValue?: string;
  /** Decoration before the label — an icon. Not a control. */
  leading?: ReactNode;
  /** Decoration after the label — a count badge. Not a control. Read as part
   *  of the row's accessible name. */
  trailing?: ReactNode;
  children?: readonly TreeNode[];
  /** Present but not in effect. */
  muted?: boolean;
  /** Focusable and announced, but cannot be activated, expanded or selected. */
  disabled?: boolean;
  className?: string;
}

/** Whether and how rows are selectable. */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';

export interface TreeProps {
  nodes: readonly TreeNode[];
  /** Shown in place of the tree when `nodes` is empty. */
  empty?: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;

  /** Open branches, controlled. */
  expandedIds?: Iterable<string>;
  /** Open branches on first render, when uncontrolled. */
  defaultExpandedIds?: Iterable<string>;
  /** The whole set a toggle would produce. Called whether or not controlled. */
  onExpandedChange?(ids: Set<string>): void;

  /** Default `'none'`. `'multiple'` adds to the selection with Cmd/Ctrl and
   *  extends it over visible rows with Shift. */
  selectionMode?: TreeSelectionMode;
  /** Selected rows, controlled. */
  selectedIds?: Iterable<string>;
  /** Selected rows on first render, when uncontrolled. */
  defaultSelectedIds?: Iterable<string>;
  /** The whole set an activation would produce, when it differs. */
  onSelectionChange?(ids: Set<string>): void;

  /** A row was activated — click, Enter or Space — with the modifiers held. */
  onAction?(id: string, mods: PressModifiers): void;
}

interface Visible {
  node: TreeNode;
  parentId: string | null;
  level: number;
}

const TYPEAHEAD_MS = 500;

export const Tree = forwardRef(function Tree(
  {
    nodes, empty, className,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    expandedIds, defaultExpandedIds, onExpandedChange,
    selectionMode = 'none', selectedIds, defaultSelectedIds, onSelectionChange,
    onAction,
  }: TreeProps,
  ref: Ref<HTMLUListElement>,
) {
  const [expanded, setExpanded] = useControlledSet(expandedIds, defaultExpandedIds, onExpandedChange);
  const [selected, setSelected] = useControlledSet(selectedIds, defaultSelectedIds, onSelectionChange);
  const selectable = selectionMode !== 'none';
  const baseId = useId();

  const visible = useMemo(() => {
    const out: Visible[] = [];
    const walk = (list: readonly TreeNode[], parentId: string | null, level: number) => {
      for (const node of list) {
        out.push({ node, parentId, level });
        if (node.children && expanded.has(node.id)) walk(node.children, node.id, level + 1);
      }
    };
    walk(nodes, null, 1);
    return out;
  }, [nodes, expanded]);
  const indexOf = useMemo(() => new Map(visible.map((v, i) => [v.node.id, i])), [visible]);

  const items = useRef(new Map<string, HTMLLIElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const typed = useRef({ text: '', at: 0 });

  const stopId = focusId != null && indexOf.has(focusId)
    ? focusId
    : (visible.find((v) => selectable && selected.has(v.node.id)) ?? visible[0])?.node.id;

  if (nodes.length === 0) {
    return <div className={[s.empty, className].filter(Boolean).join(' ')}>{empty ?? '—'}</div>;
  }

  const focus = (id: string | undefined) => { if (id != null) items.current.get(id)?.focus(); };

  const toggle = (node: TreeNode) => {
    if (!node.children || node.disabled) return;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    setExpanded(next);
  };

  const select = (id: string, mods: PressModifiers) => {
    let next: Set<string>;
    if (selectionMode === 'multiple' && mods.shiftKey && anchor.current != null && indexOf.has(anchor.current)) {
      const a = indexOf.get(anchor.current)!;
      const b = indexOf.get(id)!;
      next = new Set(visible.slice(Math.min(a, b), Math.max(a, b) + 1)
        .filter((v) => !v.node.disabled).map((v) => v.node.id));
    } else if (selectionMode === 'multiple' && (mods.metaKey || mods.ctrlKey)) {
      next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = id;
    } else {
      next = new Set([id]);
      anchor.current = id;
    }
    if (next.size !== selected.size || [...next].some((x) => !selected.has(x))) setSelected(next);
  };

  const activate = (node: TreeNode, mods: PressModifiers) => {
    if (node.disabled) return;
    toggle(node);
    if (selectable) select(node.id, mods);
    onAction?.(node.id, mods);
  };

  const onKeyDown = (v: Visible) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return;
    const i = indexOf.get(v.node.id)!;
    const { node } = v;
    const open = !!node.children && expanded.has(node.id);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focus(visible[Math.min(i + 1, visible.length - 1)].node.id);
        return;
      case 'ArrowUp':
        e.preventDefault();
        focus(visible[Math.max(i - 1, 0)].node.id);
        return;
      case 'Home':
        e.preventDefault();
        focus(visible[0].node.id);
        return;
      case 'End':
        e.preventDefault();
        focus(visible[visible.length - 1].node.id);
        return;
      case 'ArrowRight':
        if (!node.children) return;
        e.preventDefault();
        if (!open) toggle(node);
        else focus(node.children[0]?.id);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        if (open) toggle(node);
        else focus(v.parentId ?? undefined);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(node, modsOf(e));
        return;
      default:
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        typeAhead(e, i);
    }
  };

  const typeAhead = (e: KeyboardEvent, from: number) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > TYPEAHEAD_MS ? e.key : t.text + e.key;
    t.at = now;
    const want = t.text.toLowerCase();
    // A fresh first letter looks past the current row; a longer prefix may still match it.
    const start = t.text.length === 1 ? from + 1 : from;
    for (let k = 0; k < visible.length; k++) {
      const v = visible[(start + k) % visible.length];
      if (textOf(v.node).toLowerCase().startsWith(want)) {
        e.preventDefault();
        focus(v.node.id);
        return;
      }
    }
  };

  const onRowClick = (node: TreeNode) => (e: MouseEvent<HTMLDivElement>) => activate(node, modsOf(e));

  const onTwistyClick = (node: TreeNode) => (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    toggle(node);
  };

  const itemRef = (id: string) => (el: HTMLLIElement | null) => {
    if (el) items.current.set(id, el);
    else items.current.delete(id);
  };

  let seq = 0;
  const renderLevel = (list: readonly TreeNode[], parentId: string | null, level: number): ReactNode =>
    list.map((node, pos) => {
      const n = seq++;
      const branch = !!node.children;
      const open = branch && expanded.has(node.id);
      const labelId = `${baseId}-${n}`;
      const trailingId = node.trailing != null ? `${baseId}-${n}-t` : undefined;
      return (
        <li
          key={node.id}
          ref={itemRef(node.id)}
          role="treeitem"
          className={[s.item, node.className].filter(Boolean).join(' ')}
          aria-level={level}
          aria-setsize={list.length}
          aria-posinset={pos + 1}
          aria-expanded={branch ? open : undefined}
          aria-selected={selectable ? selected.has(node.id) : undefined}
          aria-disabled={node.disabled || undefined}
          aria-labelledby={trailingId ? `${labelId} ${trailingId}` : labelId}
          data-muted={node.muted ? 'true' : undefined}
          tabIndex={node.id === stopId ? 0 : -1}
          onKeyDown={onKeyDown({ node, parentId, level })}
          onFocus={(e) => { if (e.target === e.currentTarget) setFocusId(node.id); }}
        >
          <div className={s.row} onClick={onRowClick(node)}>
            <span className={s.twisty} aria-hidden="true" onClick={branch ? onTwistyClick(node) : undefined}>
              {branch && <DisclosureMark open={open} />}
            </span>
            {node.leading != null && <span className={s.leading}>{node.leading}</span>}
            <span id={labelId} className={s.label}>{node.label}</span>
            {trailingId && <span id={trailingId} className={s.trailing}>{node.trailing}</span>}
          </div>
          {open && node.children!.length > 0 && (
            <ul role="group" className={s.group}>
              {renderLevel(node.children!, node.id, level + 1)}
            </ul>
          )}
        </li>
      );
    });

  return (
    <ul
      ref={ref}
      role="tree"
      className={[s.tree, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-multiselectable={selectionMode === 'multiple' || undefined}
    >
      {renderLevel(nodes, null, 1)}
    </ul>
  );
});

/**
 * `nodes` narrowed to those `match` accepts, plus their ancestors. A matching
 * node keeps its whole subtree; a branch with no match inside it is dropped.
 * Returns `nodes` itself when nothing is dropped.
 */
export function filterTree(
  nodes: readonly TreeNode[],
  match: (node: TreeNode) => boolean,
): readonly TreeNode[] {
  let changed = false;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (match(node)) {
      out.push(node);
      continue;
    }
    const kids = node.children ? filterTree(node.children, match) : [];
    if (kids.length === 0) {
      changed = true;
      continue;
    }
    if (kids !== node.children) changed = true;
    out.push(kids === node.children ? node : { ...node, children: kids });
  }
  return changed ? out : nodes;
}

/** Every branch id in `nodes`, depth first — `expandedIds` for a tree with everything open. */
export function treeBranchIds(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (!node.children) continue;
      out.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

function textOf(node: TreeNode): string {
  return node.textValue ?? (typeof node.label === 'string' ? node.label : '');
}

function modsOf(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): PressModifiers {
  return { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
}

function useControlledSet(
  value: Iterable<string> | undefined,
  initial: Iterable<string> | undefined,
  onChange: ((ids: Set<string>) => void) | undefined,
): [ReadonlySet<string>, (next: Set<string>) => void] {
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set(initial));
  const controlled = useMemo(() => (value === undefined ? undefined : new Set(value)), [value]);
  const set = (next: Set<string>) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return [controlled ?? own, set];
}

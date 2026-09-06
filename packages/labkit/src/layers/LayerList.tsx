import { openPointerSession, type PointerSession } from '@weasel-js/core';
import { Disclosure } from '@weasel-js/ui';
import {
  Fragment,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { LayerDescriptor } from '../instrument/types';
import { DragHandleGlyph } from '../passthrough/weasel-ui';

/** A layer that may itself contain layers. A plain `LayerDescriptor` is one
 *  of these with no children, so a flat list needs no change. */
export interface LayerTreeNode extends LayerDescriptor {
  children?: LayerTreeNode[];
  /** Render this node's children hidden on first paint. Ignored once
   *  `collapsedIds` is supplied. */
  defaultCollapsed?: boolean;
}

/** Props for `<LayerList>`. */
export interface LayerListProps {
  layers: LayerTreeNode[];
  visibility: Record<string, boolean>;
  /** The whole tree, with the dragged node moved. Reordering is scoped to a
   *  node's siblings: a drag never changes which parent a layer sits under. */
  onReorder: (newOrder: LayerTreeNode[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  /** Ids whose children are hidden. Supplying it makes collapse controlled;
   *  without it the list keeps its own, seeded from `defaultCollapsed`. */
  collapsedIds?: readonly string[];
  onCollapsedChange?: (ids: string[]) => void;
  className?: string;
}

interface DragState {
  /** Id of the dragged row's parent, or null at the top level. */
  parentId: string | null;
  fromIndex: number;
  toIndex: number;
  startY: number;
  /** Row height plus row gap, measured when the drag starts. */
  pitch: number;
}

/** Which row the drag currently marks. */
interface DragMark {
  parentId: string | null;
  index: number;
}

function findNode(nodes: LayerTreeNode[], id: string): LayerTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children ? findNode(node.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

function siblingsOf(layers: LayerTreeNode[], parentId: string | null): LayerTreeNode[] {
  if (parentId === null) return layers;
  return findNode(layers, parentId)?.children ?? [];
}

function withChildren(
  nodes: LayerTreeNode[],
  parentId: string | null,
  next: LayerTreeNode[],
): LayerTreeNode[] {
  if (parentId === null) return next;
  return nodes.map((node) => {
    if (node.id === parentId) return { ...node, children: next };
    if (node.children) return { ...node, children: withChildren(node.children, parentId, next) };
    return node;
  });
}

function collectCollapsed(nodes: LayerTreeNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.defaultCollapsed) into.add(node.id);
    if (node.children) collectCollapsed(node.children, into);
  }
  return into;
}

function anyNested(nodes: LayerTreeNode[]): boolean {
  return nodes.some((n) => (n.children?.length ?? 0) > 0);
}

/** A reorderable list of layers with per-layer visibility toggles. Layers
 *  marked `alwaysOn` are pinned and cannot be reordered or hidden. Layers with
 *  `children` render as an expandable subtree. */
export function LayerList({
  layers,
  visibility,
  onReorder,
  onToggle,
  collapsedIds,
  onCollapsedChange,
  className,
}: LayerListProps) {
  const [dragMark, setDragMark] = useState<DragMark | null>(null);
  const [ownCollapsed, setOwnCollapsed] = useState<Set<string>>(() =>
    collectCollapsed(layers, new Set()),
  );
  const dragRef = useRef<DragState | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const uid = useId();
  // The session's callbacks outlive the render that opened them, so the commit
  // reads its inputs here rather than from that render's closure.
  const commitRef = useRef({ layers, onReorder });
  commitRef.current = { layers, onReorder };

  useEffect(() => () => sessionRef.current?.cancel(), []);

  const collapsed = collapsedIds ? new Set(collapsedIds) : ownCollapsed;

  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!collapsedIds) setOwnCollapsed(next);
    onCollapsedChange?.([...next]);
  };

  if (layers.length === 0) {
    return (
      <div className={className ? `lk-layer-list ${className}` : 'lk-layer-list'}>
        <div className="lk-layer-list__empty">No layers</div>
      </div>
    );
  }

  const clearDrag = () => {
    dragRef.current = null;
    sessionRef.current = null;
    setDragMark(null);
  };

  const startDrag = (e: ReactPointerEvent<HTMLElement>, parentId: string | null, index: number) => {
    // Measured at grab time rather than hardcoded: a restyle that changes row
    // height or gap would otherwise silently skew every drag distance.
    const row = e.currentTarget.closest('.lk-layer-list__row');
    const list = row?.parentElement;
    const gap = list ? Number.parseFloat(getComputedStyle(list).rowGap) || 0 : 0;
    const pitch = row ? row.getBoundingClientRect().height + gap : 0;
    const drag: DragState = {
      parentId,
      fromIndex: index,
      toIndex: index,
      startY: e.clientY,
      pitch: pitch > 0 ? pitch : 1,
    };
    dragRef.current = drag;
    setDragMark({ parentId, index });
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        const delta = Math.round((ev.clientY - drag.startY) / drag.pitch);
        const siblings = siblingsOf(commitRef.current.layers, parentId);
        const last = siblings.filter((l) => !l.alwaysOn).length - 1;
        drag.toIndex = Math.min(last, Math.max(0, drag.fromIndex + delta));
        setDragMark({ parentId, index: drag.toIndex });
      },
      onEnd: () => {
        const { layers: tree, onReorder: commit } = commitRef.current;
        const { fromIndex, toIndex } = drag;
        clearDrag();
        if (toIndex === fromIndex) return;
        const siblings = siblingsOf(tree, parentId);
        const rows = siblings.filter((l) => !l.alwaysOn);
        const locked = siblings.filter((l) => l.alwaysOn);
        const next = [...rows];
        const [moved] = next.splice(fromIndex, 1);
        if (moved) next.splice(toIndex, 0, moved);
        commit(withChildren(tree, parentId, [...next, ...locked]));
      },
      // An interrupted drag never named a destination, so it reorders nothing.
      onCancel: clearDrag,
    });
  };

  // A twisty column on every row keeps labels aligned across depths, but a
  // flat list would only be paying 20px for it.
  const nested = anyNested(layers);

  function renderRow(
    layer: LayerTreeNode,
    parentId: string | null,
    index: number,
    path: string,
    pinned: boolean,
  ): ReactNode {
    const kids = layer.children ?? [];
    const open = kids.length > 0 && !collapsed.has(layer.id);
    const bodyId = `${uid}${path}`;
    const dragging = !pinned && dragMark?.parentId === parentId && dragMark.index === index;
    const cls = ['lk-layer-list__row'];
    if (dragging) cls.push('lk-layer-list__row--dragging');
    if (pinned) cls.push('lk-layer-list__row--pinned');
    return (
      <Fragment key={layer.id}>
        <div className={cls.join(' ')}>
          {nested &&
            (kids.length > 0 ? (
              <Disclosure
                open={open}
                onToggle={() => toggleCollapsed(layer.id)}
                label={`${layer.label} sublayers`}
                controls={bodyId}
              />
            ) : (
              <span className="lk-layer-list__twisty-gap" />
            ))}
          {pinned ? (
            <span className="lk-layer-list__lock" role="img" aria-label="Always on">
              🔒
            </span>
          ) : (
            <>
              <button
                type="button"
                className="lk-layer-list__handle"
                aria-label={`Reorder ${layer.label}`}
                onPointerDown={(e) => startDrag(e, parentId, index)}
              >
                <DragHandleGlyph size={13} />
              </button>
              <input
                className="lk-layer-list__check"
                type="checkbox"
                checked={visibility[layer.id] !== false}
                onChange={(e) => onToggle(layer.id, e.target.checked)}
                aria-label={`Toggle ${layer.label}`}
              />
            </>
          )}
          <span className="lk-layer-list__label">{layer.label}</span>
        </div>
        {open && (
          <div id={bodyId} className="lk-layer-list__children">
            {renderLevel(kids, layer.id, path)}
          </div>
        )}
      </Fragment>
    );
  }

  function renderLevel(nodes: LayerTreeNode[], parentId: string | null, path: string): ReactNode {
    const reorderable = nodes.filter((l) => !l.alwaysOn);
    const pinned = nodes.filter((l) => l.alwaysOn);
    return (
      <>
        {reorderable.map((layer, i) => renderRow(layer, parentId, i, `${path}-${i}`, false))}
        {pinned.map((layer, i) => renderRow(layer, parentId, i, `${path}-p${i}`, true))}
      </>
    );
  }

  return (
    <div className={className ? `lk-layer-list ${className}` : 'lk-layer-list'}>
      {renderLevel(layers, null, '')}
    </div>
  );
}

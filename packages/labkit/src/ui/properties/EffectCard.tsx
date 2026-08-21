import { type CSSProperties, type ReactNode, useState } from 'react';

// ── Subpanel ─────────────────────────────────────────────────────────
// Headered group of controls inside a wider panel/list. The header is a
// label flanked by a horizontal rule — no background, padding, or border;
// purely a typographic divider. Ported from speech-balloons styles.css:277-313.

/** Props for `<Subpanel>`. */
export interface SubpanelProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A typographic divider inside a property list: a small title flanked by a
 *  rule. Purely a heading — use `<PropertyGroup>` for a bordered section. */
export function Subpanel({ title, children, className }: SubpanelProps) {
  const cls = className ? `lk-subpanel ${className}` : 'lk-subpanel';
  return (
    <div className={cls}>
      <h4 className="lk-subpanel__title">
        <span>{title}</span>
        <hr />
      </h4>
      {children}
    </div>
  );
}

// ── EffectCard ───────────────────────────────────────────────────────
// Draggable, collapsible card for stacked effect editors. Optional --lk-panel-accent
// per-instance recolors the title bar, border-left, and (via re-binding --wzl-accent
// inside the card) every descendant control that reads from the accent token.

/** Props for `<EffectCard>`. */
export interface EffectCardProps {
  /** Card title rendered in the title bar (e.g. effect kind label or a select). */
  title: ReactNode;
  /** Optional badge/chip displayed before the remove button (e.g. primary value summary). */
  primary?: ReactNode;
  /** Optional accent color in any CSS color form. Sets --lk-panel-accent on the card. */
  accent?: string;
  /** Optional ordinal badge that doubles as the drag handle (used by tail cards in SB). */
  index?: number;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onRemove?: () => void;
  /**
   * Drag-handle wiring. When provided, an inline handle (⋮⋮ icon or `index`)
   * activates HTML5 drag on press. Consumer owns the drag/drop coordination —
   * see EffectCardList for the batteries-included wrapper.
   */
  draggable?: boolean;
  onPressHandle?: () => void;
  onReleaseHandle?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  dragging?: boolean;
  children?: ReactNode;
  className?: string;
}

/** An accented, collapsible card for one item in a list of like things —
 *  effects, layers, tails. The accent color rebinds the theme accent token
 *  within the card, so its controls pick it up too. */
export function EffectCard({
  title,
  primary,
  accent,
  index,
  expanded = true,
  onToggleExpanded,
  onRemove,
  draggable,
  onPressHandle,
  onReleaseHandle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  dragging,
  children,
  className,
}: EffectCardProps) {
  const stateClass = `${expanded ? 'is-expanded' : 'is-collapsed'}${dragging ? ' is-dragging' : ''}${accent ? ' has-accent' : ''}`;
  const cls = `lk-effect-card ${stateClass}${className ? ` ${className}` : ''}`;
  // Per-instance dynamic color → CSS custom property requires inline style.
  // The card's CSS re-binds --wzl-accent to --lk-panel-accent so descendants tint.
  const style = accent ? ({ '--lk-panel-accent': accent } as CSSProperties) : undefined;

  // When a toggle handler is supplied the header acts as a disclosure button:
  // role + tab stop + Enter/Space. Bundled together so the interactive props are
  // applied as a set (no half-interactive element when onToggleExpanded is absent).
  const headProps = onToggleExpanded
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onToggleExpanded,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpanded();
          }
        },
      }
    : {};

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: native HTML5 drag-and-drop container — drag events are not click/keyboard interactions and have no semantic element; the in-card handle and header carry the a11y affordances.
    <div
      className={cls}
      style={style}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="lk-effect-card__head" {...headProps}>
        {index != null ? (
          <button
            type="button"
            className="lk-effect-card__index-badge lk-effect-card__handle"
            title="Drag to reorder · click to toggle"
            aria-label={`Item ${index + 1} — drag to reorder, click to toggle`}
            onMouseDown={onPressHandle}
            onMouseUp={onReleaseHandle}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded?.();
            }}
          >
            {index + 1}
          </button>
        ) : (
          <span
            className="lk-effect-card__handle"
            aria-hidden="true"
            title="Drag to reorder"
            onMouseDown={onPressHandle}
            onMouseUp={onReleaseHandle}
          >
            <DragHandleIcon />
          </span>
        )}
        <span className="lk-effect-card__title">{title}</span>
        {primary != null && <span className="lk-effect-card__primary">{primary}</span>}
        {onRemove && (
          <button
            type="button"
            className="lk-effect-card__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove"
            aria-label="Remove"
          >
            ✕
          </button>
        )}
      </div>
      {expanded && <div className="lk-effect-card__body">{children}</div>}
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      <circle cx="3" cy="3" r="1.3" fill="currentColor" />
      <circle cx="7" cy="3" r="1.3" fill="currentColor" />
      <circle cx="3" cy="7" r="1.3" fill="currentColor" />
      <circle cx="7" cy="7" r="1.3" fill="currentColor" />
      <circle cx="3" cy="11" r="1.3" fill="currentColor" />
      <circle cx="7" cy="11" r="1.3" fill="currentColor" />
    </svg>
  );
}

// ── EffectCardList ───────────────────────────────────────────────────
// Batteries-included list wrapper that coordinates HTML5 drag-and-drop across
// a list of EffectCards. Consumer supplies items + a renderItem callback;
// onReorder fires with (sourceId, targetId, position) on drop. Mirrors the
// LayerStack pattern from speech-balloons Lab.tsx:630-707.

/** The minimum an item must carry to appear in an `<EffectCardList>`. */
export interface EffectCardListItem {
  id: string | number;
}

/** Props for `<EffectCardList>`. */
export interface EffectCardListProps<T extends EffectCardListItem> {
  items: ReadonlyArray<T>;
  renderItem: (
    item: T,
    helpers: {
      isExpanded: boolean;
      isDragging: boolean;
      toggleExpanded: () => void;
      cardProps: Pick<
        EffectCardProps,
        | 'expanded'
        | 'dragging'
        | 'draggable'
        | 'onToggleExpanded'
        | 'onPressHandle'
        | 'onReleaseHandle'
        | 'onDragStart'
        | 'onDragEnd'
        | 'onDragOver'
        | 'onDragLeave'
        | 'onDrop'
      >;
    },
  ) => ReactNode;
  onReorder: (sourceId: T['id'], targetId: T['id'], position: 'before' | 'after') => void;
  /** Optional rendered when the list is empty. */
  empty?: ReactNode;
  /** IDs to render expanded on first mount. Defaults to all collapsed. */
  defaultExpandedIds?: ReadonlyArray<T['id']>;
}

/** A drag-reorderable list of `<EffectCard>`s. Owns the expanded and dragging
 *  state and hands it back to `renderItem`, so the caller only supplies each
 *  card's contents. */
export function EffectCardList<T extends EffectCardListItem>({
  items,
  renderItem,
  onReorder,
  empty,
  defaultExpandedIds,
}: EffectCardListProps<T>) {
  const [expanded, setExpanded] = useState<Set<T['id']>>(() => new Set(defaultExpandedIds ?? []));
  const [draggingId, setDraggingId] = useState<T['id'] | null>(null);
  const [pressedId, setPressedId] = useState<T['id'] | null>(null);
  const [dropHint, setDropHint] = useState<{ id: T['id']; position: 'before' | 'after' } | null>(
    null,
  );

  if (items.length === 0) {
    return <>{empty ?? <div className="lk-effect-card-list__empty">No items.</div>}</>;
  }

  return (
    <div className="lk-effect-card-list">
      {items.map((item) => {
        const isExpanded = expanded.has(item.id);
        const isDragging = draggingId === item.id;
        const isPressed = pressedId === item.id;
        const showHintBefore =
          dropHint && dropHint.id === item.id && dropHint.position === 'before';
        const showHintAfter = dropHint && dropHint.id === item.id && dropHint.position === 'after';

        const toggleExpanded = () =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return next;
          });

        return (
          <div key={String(item.id)} className="lk-effect-card-list__wrap">
            {showHintBefore && <div className="lk-effect-card-list__drop-hint" />}
            {renderItem(item, {
              isExpanded,
              isDragging,
              toggleExpanded,
              cardProps: {
                expanded: isExpanded,
                dragging: isDragging,
                draggable: isPressed,
                onToggleExpanded: toggleExpanded,
                onPressHandle: () => setPressedId(item.id),
                onReleaseHandle: () => setPressedId(null),
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(item.id));
                  setDraggingId(item.id);
                },
                onDragEnd: () => {
                  setDraggingId(null);
                  setPressedId(null);
                  setDropHint(null);
                },
                onDragOver: (e) => {
                  if (draggingId === null || draggingId === item.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const position: 'before' | 'after' =
                    e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  setDropHint({ id: item.id, position });
                },
                onDragLeave: () => {
                  setDropHint((h) => (h && h.id === item.id ? null : h));
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (draggingId === null || draggingId === item.id) {
                    setDropHint(null);
                    return;
                  }
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const position: 'before' | 'after' =
                    e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  onReorder(draggingId, item.id, position);
                  setDropHint(null);
                },
              },
            })}
            {showHintAfter && <div className="lk-effect-card-list__drop-hint" />}
          </div>
        );
      })}
    </div>
  );
}

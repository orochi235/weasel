import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { icon } from '../../icons.gen';
import f from '../field.module.css';
import { ReorderHandle } from '../ReorderHandle/ReorderHandle';
import { Switch } from '../Switch';
import type { StackKind, StackListItem } from './StackList';
import s from './StackList.module.css';

interface StackCardProps {
  item: StackListItem;
  index: number;
  kind: StackKind | undefined;
  /** The kind's color as CSS. */
  color: string | undefined;
  open: boolean;
  dragging: boolean;
  drop: 'before' | 'after' | undefined;
  onGripDown(e: PointerEvent): void;
  onToggleOpen(): void;
  onKeyDown(e: KeyboardEvent): void;
  onPatch(next: Partial<StackListItem>): void;
  onDuplicate: (() => void) | undefined;
  onRemove: (() => void) | undefined;
  children: ReactNode;
}

/** One card of a `StackList`: its header row, and its body when it is open. */
export function StackCard({
  item, index, kind, color, open, dragging, drop, onGripDown, onToggleOpen, onKeyDown, onPatch, onDuplicate, onRemove, children,
}: StackCardProps) {
  return (
    <div
      className={s.card}
      style={color === undefined ? undefined : ({ '--_stack-kind': color } as CSSProperties)}
      data-open={open || undefined}
      data-off={!item.on || undefined}
      data-dragging={dragging || undefined}
      data-drop-before={drop === 'before' || undefined}
      data-drop-after={drop === 'after' || undefined}
      onKeyDown={onKeyDown}
    >
      <div className={s.head}>
        <ReorderHandle
          className={s.number}
          label={item.name}
          badge={index + 1}
          pressed={open}
          onPointerDown={onGripDown}
          onClick={onToggleOpen}
        />
        <Switch className={s.switch} isSelected={item.on} onChange={(on) => onPatch({ on })} aria-label={`Run ${item.name}`} />
        <span className={s.kind}>
          {kind?.icon !== undefined && <Icon name={kind.icon} size={14} />}
          {kind?.label ?? item.kind}
        </span>
        <input
          type="text"
          className={`${f.frame} ${s.name}`}
          aria-label={`Name of card ${index + 1}`}
          value={item.name}
          onChange={(e) => onPatch({ name: e.target.value })}
        />
        {onDuplicate && (
          <button type="button" className={s.action} aria-label={`Duplicate ${item.name}`} onClick={onDuplicate}>
            <Icon name={icon('core:duplicate')} size={16} />
          </button>
        )}
        {onRemove && (
          <button type="button" className={s.action} aria-label={`Remove ${item.name}`} onClick={onRemove}>
            <Icon name={icon('core:delete')} size={16} />
          </button>
        )}
      </div>
      {children !== undefined && children !== null && <div className={s.body}>{children}</div>}
    </div>
  );
}

import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { icon } from '../../icons.gen';
import f from '../field.module.css';
import { ReorderHandle } from '../ReorderHandle/ReorderHandle';
import { Switch } from '../Switch';
import type { EffectKind, EffectListItem } from './EffectList';
import s from './EffectList.module.css';

interface EffectCardProps {
  item: EffectListItem;
  index: number;
  kind: EffectKind | undefined;
  /** Every kind in the list, drawn unseen under this card's label so each label's column is as wide as the widest. */
  kinds: readonly EffectKind[];
  /** The kind's color as CSS. */
  color: string | undefined;
  open: boolean;
  dragging: boolean;
  drop: 'before' | 'after' | undefined;
  onGripDown(e: PointerEvent): void;
  onToggleOpen(): void;
  onKeyDown(e: KeyboardEvent): void;
  onPatch(next: Partial<EffectListItem>): void;
  onDuplicate: (() => void) | undefined;
  onRemove: (() => void) | undefined;
  children: ReactNode;
}

/** One card of a `EffectList`: its header row, and its body when it is open. */
export function EffectCard({
  item, index, kind, kinds, open, color, dragging, drop, onGripDown, onToggleOpen, onKeyDown, onPatch, onDuplicate, onRemove, children,
}: EffectCardProps) {
  return (
    <div
      className={s.card}
      style={color === undefined ? undefined : ({ '--_effect-kind': color } as CSSProperties)}
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
          <KindLabel kind={kind} fallback={item.kind} />
          {kinds.map((k, i) => (
            <KindLabel key={i} kind={k} sizer />
          ))}
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

function KindLabel({ kind, fallback, sizer = false }: { kind: EffectKind | undefined; fallback?: string; sizer?: boolean }) {
  return (
    <span className={sizer ? s.kindSizer : s.kindLabel} aria-hidden={sizer || undefined}>
      {kind?.icon !== undefined && <Icon name={kind.icon} size={14} />}
      {kind?.label ?? fallback}
    </span>
  );
}

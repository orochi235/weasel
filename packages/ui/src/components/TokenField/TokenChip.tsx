import type { HTMLAttributes, ReactNode, Ref } from 'react';
import type { ReorderDragState } from '../../useReorderDragList';
import { Badge } from '../Badge';
import s from './TokenField.module.css';

interface TokenChipProps {
  /** The chip's text; empty reads as `Empty` to assistive tech. */
  text: string;
  /** What is wrong with the token, if anything. */
  problem?: string;
  tooltip?: ReactNode;
  index: number;
  count: number;
  drag: ReorderDragState;
  chipRef: Ref<HTMLElement>;
  onEdit?: () => void;
  onRemove?: () => void;
  labelProps: HTMLAttributes<HTMLElement>;
}

/** One token: a badge in a slot that shows where a dragged token would land against it. */
export function TokenChip({ text, problem, tooltip, index, count, drag, chipRef, onEdit, onRemove, labelProps }: TokenChipProps) {
  const name = text === '' ? 'Empty' : text;
  return (
    <span
      data-token=""
      className={s.slot}
      data-drop-before={drag.targetIndex === index ? '' : undefined}
      data-drop-after={drag.targetIndex === count && index === count - 1 ? '' : undefined}
      data-dragging={drag.draggedIds?.includes(String(index)) ? '' : undefined}
    >
      <Badge
        ref={chipRef}
        className={s.token}
        variant="subtle"
        grade={problem === undefined ? undefined : 'danger'}
        aria-label={problem === undefined ? name : `${name}, ${problem}`}
        tooltip={problem === undefined ? tooltip : <>{tooltip}{tooltip != null && <br />}{problem}</>}
        onClick={onEdit}
        onRemove={onRemove}
        removeLabel={`Remove ${name}`}
        labelProps={labelProps}
      >
        {text === '' ? ' ' : text}
      </Badge>
    </span>
  );
}

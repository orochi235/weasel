import { useId } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { qty } from '@weasel-js/quantity';
import on from '../Along/onRun.module.css';
import s from './Slider.module.css';
import type { SliderGeometry } from './sliderGeometry';
import type { ThumbHoldAttrs } from './useSliderHold';
import type { SliderProps, Thumb, ThumbShape } from './types';
import { useFieldControl, type FieldControlAttrs } from '../Field/fieldSemantics';
import { describedBy } from '../Disabled/HoldReason';

/** What one thumb draws from: its value and place, the span it sits in, the box it measured, and its handlers. */
export interface SliderThumbProps<T extends Thumb> {
  thumb: T;
  /** The thumb's own shape, or the slider's default. */
  shape: ThumbShape | undefined;
  fraction: number;
  geometry: SliderGeometry;
  min: number;
  max: number;
  /** The slider's own name and description; with none, its field's. */
  own: Pick<SliderProps<T>, 'aria-label' | 'aria-labelledby' | 'aria-describedby'>;
  hold: ThumbHoldAttrs;
  display: SliderProps<T>['display'];
  /** The locale `display` speaks the value in. */
  locale: string;
  spoken: string | undefined;
  active: boolean;
  box: { width: number; height: number };
  elRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}

/** One draggable, focusable thumb, with its custom render when its shape has one. */
export function SliderThumb<T extends Thumb>(p: SliderThumbProps<T>): ReactElement {
  const { thumb, shape, active } = p;
  const naming = useFieldControl({ 'aria-label': p.own['aria-label'], 'aria-labelledby': p.own['aria-labelledby'], 'aria-describedby': p.own['aria-describedby'] });
  const id = useId();
  const customRender = typeof shape === 'object' && shape !== null ? shape.render : null;
  const cls = [s.thumb, p.geometry.curved && on.onRun, shape === 'notched' && s.notched, shape === 'dot' && s.dot, active && s.thumbActive].filter(Boolean).join(' ');
  return (
    <div
      ref={p.elRef}
      role="slider"
      {...p.hold}
      aria-orientation={p.geometry.curved ? undefined : 'horizontal'}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={thumb.value}
      aria-valuetext={thumb.valueText ?? p.spoken ?? (p.display ? qty(thumb.value, p.display, { locale: p.locale }).spoken : undefined)}
      {...thumbName(naming, thumb.label, id)}
      aria-describedby={describedBy(naming['aria-describedby'], p.hold['aria-describedby'])}
      className={cls}
      style={p.geometry.place(p.fraction)}
      onPointerDown={p.onPointerDown}
      onKeyDown={p.onKeyDown}
      onContextMenu={p.onContextMenu}
    >
      {customRender ? customRender({ width: p.box.width, height: p.box.height, isActive: active }) : (thumb.label ?? '')}
    </div>
  );
}

/** A thumb's name: the slider's, then the thumb's own `label`. Named by another element, the thumb lists itself
 *  after it, so its `aria-label` adds the label. */
function thumbName(naming: FieldControlAttrs, label: string | undefined, id: string): { id?: string; 'aria-label'?: string; 'aria-labelledby'?: string; 'aria-invalid'?: true } {
  const invalid = naming['aria-invalid'];
  const by = naming['aria-labelledby'];
  if (by === undefined) return { 'aria-label': [naming['aria-label'], label].filter(Boolean).join(' ') || undefined, 'aria-invalid': invalid };
  return label ? { id, 'aria-labelledby': `${by} ${id}`, 'aria-label': label, 'aria-invalid': invalid } : { 'aria-labelledby': by, 'aria-invalid': invalid };
}

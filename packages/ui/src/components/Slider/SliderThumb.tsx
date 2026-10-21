import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { qty } from '@weasel-js/quantity';
import on from '../Along/onRun.module.css';
import s from './Slider.module.css';
import type { SliderGeometry } from './sliderGeometry';
import type { SliderProps, Thumb } from './types';

/** What one thumb draws from: its value and place, the span it sits in, the box it measured, and its handlers. */
export interface SliderThumbProps<T extends Thumb> {
  thumb: T;
  fraction: number;
  geometry: SliderGeometry;
  min: number;
  max: number;
  ariaLabel: string | undefined;
  display: SliderProps<T>['display'];
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
  const { thumb, active } = p;
  const customRender = typeof thumb.shape === 'object' && thumb.shape !== null ? thumb.shape.render : null;
  const cls = [s.thumb, p.geometry.curved && on.onRun, thumb.shape === 'notched' && s.notched, active && s.thumbActive].filter(Boolean).join(' ');
  return (
    <div
      ref={p.elRef}
      role="slider"
      tabIndex={0}
      aria-orientation={p.geometry.curved ? undefined : 'horizontal'}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={thumb.value}
      aria-valuetext={thumb.valueText ?? p.spoken ?? (p.display ? qty(thumb.value, p.display).spoken : undefined)}
      aria-label={[p.ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
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

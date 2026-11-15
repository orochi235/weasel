import { chromeColorOf, clientToCanvas } from '@weasel-js/core';
import type { RefObject } from 'react';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import type { DragState } from './DragDropRuntime';

/** `layers` with a ring at the pointer while a palette drag has `onDragOver` feedback: green where a
 *  drop would land, red where it would be refused. `host` is the canvas's container. */
export function withDragFeedback(
  layers: CanvasLayerDescriptor[],
  drag: DragState | null,
  host: RefObject<HTMLElement | null>,
): CanvasLayerDescriptor[] {
  if (!drag?.feedback) return layers;
  const fb = drag.feedback;
  const screen = drag.screenPos;
  return [
    ...layers,
    {
      id: '__lk_drag_feedback',
      visible: true,
      render: (ctx) => {
        const el = host.current;
        if (!el) return;
        const [x, y] = clientToCanvas(el, screen.x, screen.y);
        ctx.save();
        ctx.strokeStyle = fb.ok
          ? chromeColorOf(el, '--wzl-success', '#3a7')
          : chromeColorOf(el, '--wzl-danger', '#c44');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    },
  ];
}

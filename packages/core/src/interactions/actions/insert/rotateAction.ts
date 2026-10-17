import type { Action } from '@weasel-js/routing';
import type { InsertLiveGesture } from './live';

/** Radians per unit of wheel deltaY. Tuned so a typical mouse-wheel click
 *  (deltaY ≈ 100) yields ~25°, while a trackpad event (deltaY ≈ 1–10)
 *  yields a smooth 0.25–2.5° increment. */
const ROTATION_SENSITIVITY = Math.PI / 720;

/**
 * Companion to `insertAction` — adjusts the live insert gesture's
 * `userRotation` based on wheel deltaY. Intended to be bound to
 * Shift+wheel during the insert tool's engaged phase. No-op when no
 * insert is in flight.
 */
export const insertRotateAction: Action = {
  id: 'insert.adjustRotation',
  label: 'Insert — rotate',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  invoker: {
    timing: 'immediate' as const,
    run: (deps, params) => {
      const gesture = deps.insertLive?.gesture as InsertLiveGesture | null | undefined;
      if (!gesture || !gesture.open) return;
      const deltaY = (params as { deltaY?: number } | undefined)?.deltaY ?? 0;
      if (deltaY === 0) return;
      gesture.userRotation += deltaY * ROTATION_SENSITIVITY;
    },
  },
  requires: ['insertLive'],
};

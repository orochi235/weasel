/**
 * Normalized input-event shape consumed by the pure matcher. Built by the
 * React seam (`useGestureDispatcher`) from DOM events. Pump-only events
 * (`pointermove`, `pointerup`, `pointercancel`) ride in the same union so
 * the dispatcher's handleInput signature stays uniform; the matcher itself
 * never matches them.
 *
 * The `affordance?` field on `pointerdown` is widened to `unknown` in this
 * package — the kit narrows it back to `AffordanceHit` at consumption. This
 * keeps `weasel-gestures` free of any kit-affordance type.
 */
export type InputEvent =
  | { kind: 'key'; key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; repeat?: boolean }
  | { kind: 'key-held'; key: string; phase: 'down' | 'up'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'wheel'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; deltaX: number; deltaY: number; clientX: number; clientY: number }
  | {
      kind: 'pointerdown';
      target?: unknown;
      x?: number;
      y?: number;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /** Generic affordance payload (the kit narrows this to `AffordanceHit`). */
      affordance?: unknown;
      /**
       * Body-target classification from the scene hit-test.
       * Populated by `useGestureDispatcher` when a `classifyTarget` thunk is
       * supplied to its options. Used by `matchTarget` to resolve string-form
       * `TargetSpec` values (`'empty'`, `'selected-body'`, `'unselected-body'`).
       * Absent when `classifyTarget` is not wired.
       */
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
    }
  | { kind: 'pointermove'; x: number; y: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'pointerup'; x: number; y: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'pointercancel'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | {
      kind: 'click';
      target?: unknown;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /**
       * Body-target classification from the scene hit-test.
       * Populated by `useGestureDispatcher` when a `classifyTarget` thunk is
       * supplied. Used by `matchTarget` to resolve string-form `TargetSpec`
       * values (`'empty'`, `'selected-body'`, `'unselected-body'`).
       * Absent when `classifyTarget` is not wired.
       */
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
    }
  | {
      kind: 'contextmenu';
      target?: unknown;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /**
       * Body-target classification from the scene hit-test.
       * Populated by `useGestureDispatcher` when a `classifyTarget` thunk is
       * supplied. Used by `matchTarget` to resolve string-form `TargetSpec`
       * values (`'empty'`, `'selected-body'`, `'unselected-body'`).
       * Absent when `classifyTarget` is not wired.
       */
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
    }
  | {
      kind: 'multitouch';
      fingers: number;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /**
       * Centroid of active pointers in screen space. Populated by
       * `useGestureDispatcher` when the event is a pointermove-pump of a
       * running multitouch handle (i.e. `centroid` is updated each frame).
       * Absent on the initial pointerdown-triggered multitouch event.
       */
      centroid?: { x: number; y: number };
      /**
       * Distance between the two primary pointers (screen space). Populated
       * on move-pump events alongside `centroid`. Absent on initial event.
       */
      spread?: number;
    }
  | {
      kind: 'multitouchtap';
      fingers: number;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
    };

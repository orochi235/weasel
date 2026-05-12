/**
 * jsdom does not ship PointerEvent. When @testing-library/dom tries to use
 * window.PointerEvent to create pointer events it falls back to window.Event,
 * which doesn't expose modifier-key properties (shiftKey, altKey, etc.).
 *
 * This polyfill extends MouseEvent so that:
 *   - clientX / clientY propagate correctly (via MouseEventInit)
 *   - modifier keys (shiftKey, altKey, metaKey, ctrlKey) work
 *   - basic PointerEvent fields (pointerId, isPrimary, pointerType) work
 */
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    // PointerEvent-specific fields
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  (window as any).PointerEvent = PointerEvent;
}

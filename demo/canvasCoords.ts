/**
 * Convert client coords to canvas CSS-pixel coords (relative to the canvas's
 * top-left). Demos draw in CSS-pixel space (the dpr scaling is pre-applied
 * via `setupCanvasDpr`), so these coords feed directly into world math when
 * pan/zoom is identity.
 */
export function clientToCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

/**
 * Convert client coords to canvas CSS-pixel coords (relative to the canvas's
 * top-left). Apps drawing in CSS-pixel space (after `setupCanvasDpr`) feed
 * the result directly into world math when pan/zoom is identity. With
 * pan/zoom, compose this with your inverse-viewport transform.
 */
export function clientToCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

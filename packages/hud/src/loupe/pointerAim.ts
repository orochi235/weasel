interface Point { x: number; y: number }

const POINTER_ENDS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

/**
 * Aims a lens from the pointer moving over `input`, in CSS px relative to it. A gesture that begins where
 * `holds` answers true freezes the aim until it ends: the lens camera follows the aim, so re-aiming mid-drag
 * would move the world under the pointer. Returns a detach.
 */
export function followPointer(
  input: HTMLElement,
  lens: { aimAt(p: Point): void; holds(p: Point): boolean },
): () => void {
  let holding = false;
  const local = (evt: PointerEvent): Point => {
    const r = input.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  };
  const onPointerMove = (evt: PointerEvent) => {
    if (!holding) lens.aimAt(local(evt));
  };
  const onPointerDown = (evt: PointerEvent) => {
    if (lens.holds(local(evt))) holding = true;
  };
  const onPointerEnd = () => { holding = false; };

  input.addEventListener('pointermove', onPointerMove);
  input.addEventListener('pointerdown', onPointerDown);
  for (const type of POINTER_ENDS) input.addEventListener(type, onPointerEnd);
  return () => {
    input.removeEventListener('pointermove', onPointerMove);
    input.removeEventListener('pointerdown', onPointerDown);
    for (const type of POINTER_ENDS) input.removeEventListener(type, onPointerEnd);
  };
}

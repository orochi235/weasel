import type { LoupeAimInput } from '@weasel-js/loupe';

interface Point { x: number; y: number }

/**
 * What `loupe.aim` drives on a HUD lens: each point relative to `input`, in its CSS px. A press that begins where
 * `holds` answers true freezes the aim until it ends: the lens camera follows the aim, so re-aiming mid-drag would
 * move the world under the pointer. The press begins where the pointer last moved unpressed, or, with no such move
 * since it left (a touch), at its first held move.
 */
export function lensAimInput(
  input: HTMLElement,
  lens: { aimAt(p: Point): void; holds(p: Point): boolean },
): LoupeAimInput {
  let free: Point | null = null;
  let pressed = false;
  let holding = false;
  const local = (clientX: number, clientY: number): Point => {
    const r = input.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  return {
    aimAt(clientX, clientY, held) {
      const p = local(clientX, clientY);
      if (!held) {
        pressed = holding = false;
        free = p;
      } else if (!pressed) {
        pressed = true;
        holding = lens.holds(free ?? p);
      }
      if (!holding) lens.aimAt(p);
    },
    leave() {
      pressed = holding = false;
      free = null;
    },
  };
}

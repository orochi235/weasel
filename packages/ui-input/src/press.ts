/** Where a press stands: the pointer over the control, a press held on it, and a press that went down on it,
 *  over the control or dragged off it. */
export interface PressState {
  readonly hovered: boolean;
  readonly held: boolean;
  readonly down: boolean;
}

/** Nothing over the control and nothing held. */
export const IDLE_PRESS: PressState = { hovered: false, held: false, down: false };

/** One pointer event as a press reads it. `inside` says whether the point is over the control. */
export type PressInput =
  | { type: 'down' }
  | { type: 'move' | 'up'; inside: boolean }
  | { type: 'cancel' | 'enter' | 'leave' };

/** What a pointer event does to a press: the new state, and whether it completed one (released over the control
 *  it went down on). A drag off the control lets go of the hold and a drag back on takes it again, as a native
 *  button's `:active` does. */
export function pressStep(s: PressState, input: PressInput): { state: PressState; pressed: boolean } {
  switch (input.type) {
    case 'down': return { state: { ...s, held: true, down: true }, pressed: false };
    case 'move': {
      const held = s.down && input.inside;
      return { state: s.held === held ? s : { ...s, held }, pressed: false };
    }
    case 'up': return { state: { ...s, held: false, down: false }, pressed: s.held && input.inside };
    case 'cancel': return { state: { ...s, held: false, down: false }, pressed: false };
    case 'enter': return { state: { ...s, hovered: true }, pressed: false };
    case 'leave': return { state: { ...s, hovered: false }, pressed: false };
  }
}

/** Whether a key presses a focused button: Enter or Space, as a native `<button>` takes them. */
export function isPressKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

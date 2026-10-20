import { parseColor } from '@weasel-js/paint';
import type { DrawState } from './drawCommands';

export type Rgba = [number, number, number, number];

/** Every color the writer emits comes through here, so a color matrix has one place to apply. */
export function colorFor(color: string | readonly [number, number, number, number], _state: DrawState): Rgba {
  return typeof color === 'string' ? parseColor(color) : [color[0], color[1], color[2], color[3]];
}

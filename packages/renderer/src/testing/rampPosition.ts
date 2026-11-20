import { RAMP_U_OFFSET, RAMP_U_SCALE } from '../cache/GradientRampAtlas';

/** The ramp position a staged texture `u` samples: `rampU` undone. */
export function rampPosition(u: number): number {
  return (u - RAMP_U_OFFSET) / RAMP_U_SCALE;
}

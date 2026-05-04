import type { EasingFn, SpringPreset, SpringPresetName } from './types';

export const linear: EasingFn = (t) => t;
export const easeIn: EasingFn = (t) => t * t;
export const easeOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

export const SPRING_PRESETS: Record<SpringPresetName, SpringPreset> = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff: { stiffness: 210, damping: 20, mass: 1 },
  slow: { stiffness: 80, damping: 20, mass: 1 },
};

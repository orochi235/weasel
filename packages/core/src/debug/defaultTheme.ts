import type { DebugStrokes, DebugTheme } from './types';

/**
 * Default colors per the spec's Visual Style section. High contrast against
 * the demo's dark backdrop. Override by passing `theme: { ... }` on
 * `DebugConfig`.
 */
export const DEFAULT_DEBUG_THEME: DebugTheme = {
  hitboxFill: 'rgba(255, 0, 255, 0.25)',
  hitboxStroke: '#ff00ff',
  handle: '#00e5ff',
  bounds: '#ffeb3b',
  origin: '#69f0ae',
  snap: '#ffa726',
  layerText: '#e0e0e0',
  layerTextBg: 'rgba(0, 0, 0, 0.6)',
  idText: '#ffeb3b',
  fpsText: '#e0e0e0',
  fpsTextBg: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Default line widths and dashes. Hairline everywhere so the overlay never
 * hides the geometry it is describing; the dash on hitboxes is what
 * distinguishes them from the solid bounds box at the same rect.
 * Override by passing `strokes: { ... }` on `DebugConfig`.
 */
export const DEFAULT_DEBUG_STROKES: DebugStrokes = {
  hitbox: { width: 1, dash: [2, 2] },
  bounds: { width: 1 },
  handle: { width: 1 },
  snap: { width: 1 },
};

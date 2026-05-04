import type { DebugTheme } from './types';

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
};

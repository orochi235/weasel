export { THEMES, type TokenName, type GeneratedTheme } from './generated/themes';
export { TOKEN_MANIFEST, type TokenManifestEntry } from './generated/manifest';

import { THEMES } from './generated/themes';

/**
 * Default token values for the built-in theme's default mode.
 *
 * Retained under its original name because `@weasel-js/hud` reads it as a
 * boot-window fallback. Plan B replaces that consumer with a resolved theme.
 */
export const DEFAULT_TOKENS = THEMES.weasel.modes[THEMES.weasel.defaultMode];

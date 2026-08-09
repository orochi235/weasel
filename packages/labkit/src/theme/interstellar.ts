import { loadDTCG, type Theme } from '@weasel-js/theme';
import doc from './interstellar.tokens.json' with { type: 'json' };

/**
 * labkit's theme: a cosmic dark and a warm parchment light, extending the
 * built-in weasel theme. Authored as DTCG and loaded at import time — the
 * interchange path a theme exported from a design tool would take.
 */
export const interstellarTheme: Theme = loadDTCG(doc);

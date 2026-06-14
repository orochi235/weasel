import { DEFAULT_TOKENS, type TokenName } from '@orochi235/weasel-theme';

export interface ResolvedTokens {
  text: string;
  textMuted: string;
  panelBg: string;
  panelBorder: string;
  inputBg: string;
  accent: string;
  danger: string;
  trackBg: string;
  trackBorder: string;
  thumbFill: string;
  thumbBorder: string;
  thumbText: string;
  buttonFill: string;
  buttonFillHover: string;
  buttonFillPressed: string;
  buttonText: string;
}

const TOKEN_KEYS: Record<keyof ResolvedTokens, TokenName> = {
  text: '--wzl-text',
  textMuted: '--wzl-text-muted',
  panelBg: '--wzl-panel-bg',
  panelBorder: '--wzl-panel-border',
  inputBg: '--wzl-input-bg',
  accent: '--wzl-accent',
  danger: '--wzl-danger',
  trackBg: '--wzl-track-bg',
  trackBorder: '--wzl-track-border',
  thumbFill: '--wzl-thumb-fill',
  thumbBorder: '--wzl-thumb-border',
  thumbText: '--wzl-thumb-text',
  buttonFill: '--wzl-button-fill',
  buttonFillHover: '--wzl-button-fill-hover',
  buttonFillPressed: '--wzl-button-fill-pressed',
  buttonText: '--wzl-button-text',
};

/**
 * Resolve the current theme tokens for the canvas element.
 *
 * Pass `null` (or an element not yet attached to the DOM) to get the
 * default tokens — useful during the boot window before the canvas ref
 * has populated.
 *
 * Reads via `getComputedStyle`, which is cached by the browser between
 * layouts; calling this once per draw is sub-millisecond.
 */
export function readTokens(canvasEl: HTMLCanvasElement | null): ResolvedTokens {
  const out = {} as ResolvedTokens;
  const cs = canvasEl ? getComputedStyle(canvasEl) : null;
  for (const [field, cssVar] of Object.entries(TOKEN_KEYS) as [keyof ResolvedTokens, TokenName][]) {
    const raw = cs ? cs.getPropertyValue(cssVar).trim() : '';
    out[field] = raw || DEFAULT_TOKENS[cssVar];
  }
  return out;
}

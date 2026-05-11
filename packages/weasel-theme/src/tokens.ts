/**
 * Source of truth for token default values. Mirrors tokens.css exactly,
 * with var(--*) references resolved to their literal target value (TS
 * exports can't reference each other syntactically the way CSS can with
 * var()). The parity test in tokens.test.ts catches drift.
 */
export const DEFAULT_TOKENS = {
  '--wzl-text': '#1a1a1a',
  '--wzl-text-muted': '#6a6a6a',
  '--wzl-panel-bg': '#f4f4f4',
  '--wzl-panel-border': '#d4d4d4',
  '--wzl-input-bg': '#ffffff',
  '--wzl-accent': '#4a8fd4',
  '--wzl-danger': '#c64a3a',
  '--wzl-track-bg': '#e3e3e3',
  '--wzl-track-border': '#c2c2c2',
  '--wzl-thumb-fill': '#ffffff',
  '--wzl-thumb-border': '#6a6a6a',
  '--wzl-thumb-text': '#1a1a1a',
  '--wzl-button-fill': '#ffffff',
  '--wzl-button-fill-hover': '#f5f5f5',
  '--wzl-button-fill-pressed': '#e0e0e0',
  '--wzl-button-text': '#1a1a1a',
} as const;

export type TokenName = keyof typeof DEFAULT_TOKENS;

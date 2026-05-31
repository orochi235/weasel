/**
 * Source of truth for token default values. Mirrors tokens.css exactly,
 * with var(--*) references resolved to their literal target value (TS
 * exports can't reference each other syntactically the way CSS can with
 * var()). The parity test in tokens.test.ts catches drift.
 *
 * color-mix() expressions are resolved to plausible hex approximations
 * — consumers that need exact mixed values should read getComputedStyle
 * from the live DOM rather than relying on these defaults.
 */
export const DEFAULT_TOKENS = {
  // Primitive — grays
  '--wzl-gray-50':  '#f5f5f6',
  '--wzl-gray-100': '#e6e7e9',
  '--wzl-gray-200': '#c9cbcf',
  '--wzl-gray-300': '#9ea1a8',
  '--wzl-gray-400': '#6f737b',
  '--wzl-gray-500': '#4d5058',
  '--wzl-gray-600': '#383b42',
  '--wzl-gray-700': '#25272c',
  '--wzl-gray-800': '#181a1e',
  '--wzl-gray-900': '#0e0f12',

  // Primitive — accent + status
  '--wzl-accent-soft':   '#1d1454',
  '--wzl-accent-base':   '#2e1f7a',
  '--wzl-accent-strong': '#5841b8',
  '--wzl-danger-base':   '#d94a3f',
  '--wzl-warning-base':  '#d99a3f',

  // Geometry
  '--wzl-radius-sm':   '3px',
  '--wzl-radius-md':   '5px',
  '--wzl-border-w':    '1px',
  '--wzl-line-width':  '2px',
  '--wzl-curve-width': '3px',

  // Structural lines — three opacity levels of fg. color-mix at runtime;
  // hex approximations here resolve against the dark default fg.
  '--wzl-line-subtle': 'rgba(230, 231, 233, 0.10)',
  '--wzl-line':        'rgba(230, 231, 233, 0.20)',
  '--wzl-line-strong': 'rgba(230, 231, 233, 0.40)',

  // Curve color — semantic alias for the accent.
  '--wzl-curve-color': '#5841b8',

  // Typography
  '--wzl-font-ui':            "'Oswald', 'Helvetica Neue Condensed', 'Arial Narrow', system-ui, sans-serif",
  '--wzl-font-display':       "'Oswald', 'Helvetica Neue Condensed', 'Arial Narrow', system-ui, sans-serif",
  '--wzl-font-body':          "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  '--wzl-font-mono':          'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  '--wzl-font-weight-light':  '200',
  '--wzl-font-weight-normal': '300',
  '--wzl-font-weight-bold':   '400',

  // Semantic — surfaces
  '--wzl-surface':        '#181a1e',
  '--wzl-surface-raised': '#25272c',
  '--wzl-surface-sunken': '#0e0f12',

  // Semantic — text
  '--wzl-fg':           '#e6e7e9',
  '--wzl-fg-muted':     '#9ea1a8',
  '--wzl-fg-subtle':    '#6f737b',
  '--wzl-fg-on-accent': '#f5f5f6',

  // Semantic — borders
  '--wzl-border':        '#25272c',
  '--wzl-border-strong': '#383b42',

  // Semantic — interactive
  '--wzl-accent':       '#2e1f7a',
  '--wzl-accent-hover': '#5841b8',
  '--wzl-danger':       '#d94a3f',
  '--wzl-warning':      '#d99a3f',
  '--wzl-focus-ring':   '#5841b8',

  // Semantic — glass
  '--wzl-glass-tint': '#2e1f7a',

  // Deprecated aliases (kept for older consumers)
  '--wzl-text':                '#e6e7e9',
  '--wzl-text-muted':          '#9ea1a8',
  '--wzl-bg':                  '#181a1e',
  '--wzl-muted':               '#9ea1a8',
  '--wzl-panel-bg':            '#181a1e',
  '--wzl-panel-border':        '#25272c',
  '--wzl-input-bg':            '#0e0f12',
  '--wzl-track-bg':            '#0e0f12',
  '--wzl-track-border':        '#25272c',
  '--wzl-thumb-fill':          '#9ea1a8',
  '--wzl-thumb-border':        '#383b42',
  '--wzl-thumb-text':          '#0e0f12',
  '--wzl-button-fill':         '#25272c',
  '--wzl-button-fill-hover':   '#2f3138',
  '--wzl-button-fill-pressed': '#363941',
  '--wzl-button-text':         '#e6e7e9',
} as const;

export type TokenName = keyof typeof DEFAULT_TOKENS;

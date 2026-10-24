/** The angle a component comes from: who it is for, how it speaks, what an action does. */
export const STANCES = ['clarify', 'aside', 'advanced', 'debug', 'preview', 'confirm', 'cancel'] as const;
export type Stance = (typeof STANCES)[number];

/** How serious, or how good. The only axis that paints red. */
export const GRADES = ['info', 'success', 'warn', 'danger'] as const;
export type Grade = (typeof GRADES)[number];

/** The token each grade paints with. */
export const GRADE_TOKENS: Readonly<Record<Grade, string>> = {
  info: '--wzl-info',
  success: '--wzl-success',
  warn: '--wzl-warning',
  danger: '--wzl-danger',
};

/** How loudly a component reads. Unset is normal. */
export const EMPHASES = ['high', 'low'] as const;
export type Emphasis = (typeof EMPHASES)[number];

/** The text color an emphasis lends to everything inside it, as `--wzl-emphasis-fg`. */
export const EMPHASIS_FG: Readonly<Record<Emphasis, string>> = {
  high: 'var(--wzl-accent-fg)',
  low: 'var(--wzl-fg-muted)',
};

/** The surface slots an emphasis repaints, beyond the text color it hands down. */
export const EMPHASIS_SLOTS: Readonly<Record<Emphasis, Partial<Record<'border-color' | 'title-color', string>>>> = {
  high: { 'border-color': 'var(--wzl-accent-fg)', 'title-color': 'var(--wzl-accent-fg)' },
  low: { 'title-color': 'var(--wzl-fg-muted)' },
};

/** The surface slots a grade repaints in its color. */
export const GRADE_SLOTS = ['tint', 'border-color', 'title-color'] as const;

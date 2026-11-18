/** How serious, or how good: what a notice, a menu row, an action, or a control's tint says about itself. */
export const GRADES = ['info', 'success', 'warn', 'danger'] as const;
/** One grade. */
export type Grade = (typeof GRADES)[number];

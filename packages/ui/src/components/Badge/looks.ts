import type { AppearanceProps } from '../appearance';

/**
 * One choice from the grades and emphases a badge can wear, for the stories,
 * lab, and tests that sweep them. `tint` stands for an exact color.
 */
export type BadgeLook = 'high' | 'info' | 'success' | 'warn' | 'danger' | 'low' | 'none' | 'tint';

/** Every look but `tint`, which needs a color. */
export const BADGE_LOOKS: readonly Exclude<BadgeLook, 'tint'>[] = ['high', 'info', 'success', 'warn', 'danger', 'low', 'none'];

/** The appearance props that draw `look`; `tint` colors the `tint` look. */
export function lookProps(look: BadgeLook, tint?: string): Pick<AppearanceProps, 'grade' | 'emphasis' | 'tint'> {
  switch (look) {
    case 'high': return { emphasis: 'high' };
    case 'low': return { emphasis: 'low' };
    case 'none': return {};
    case 'tint': return { tint };
    default: return { grade: look };
  }
}

/** The JSX attributes for {@link lookProps}, for a pasteable snippet. */
export function lookAttrs(look: BadgeLook, tint?: string): string {
  switch (look) {
    case 'high': return 'emphasis="high"';
    case 'low': return 'emphasis="low"';
    case 'none': return '';
    case 'tint': return `tint=${JSON.stringify(tint)}`;
    default: return `grade="${look}"`;
  }
}

/** The look that draws a badge's `grade` and `emphasis`, a grade first. */
export function lookOf({ grade, emphasis }: Pick<AppearanceProps, 'grade' | 'emphasis'>): BadgeLook {
  return grade ?? emphasis ?? 'none';
}

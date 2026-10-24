import {
  EMPHASIS_SLOTS, GRADE_SLOTS, GRADE_TOKENS, resolveCurrentColor, resolveStanceSlots,
  type Emphasis, type Grade, type Stance,
} from '@weasel-js/theme';

export type WindowLook = Record<
  'surface' | 'border-color' | 'border-style' | 'border-width' | 'tint-mix' | 'tint' | 'title-color' | 'title-case',
  string
>;

/** A canvas has no cascade: a `var(--wzl-x)` the generated CSS would write is read from the tokens instead. */
function tokenValue(tokens: Readonly<Record<string, string>>, css: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(css)?.[1];
  return name === undefined ? css : tokens[name];
}

/**
 * The slots a window draws from, resolved as its DOM twin's generated CSS
 * does: the stance's values, then the emphasis's, then the grade's.
 */
export function windowLook(
  tokens: Readonly<Record<string, string>>,
  { stance, grade, emphasis }: { stance?: Stance; grade?: Grade; emphasis?: Emphasis },
): WindowLook {
  const surface = tokens['--wzl-surface-raised'];
  const look = resolveStanceSlots<keyof WindowLook>(tokens, {
    surface,
    'border-color': tokens['--wzl-border'],
    'border-style': 'solid',
    'border-width': '1px',
    'tint-mix': tokens['--wzl-panel-tint-mix'],
    tint: surface,
    'title-color': tokens['--wzl-fg-muted'],
    'title-case': 'none',
  }, { stance });
  if (emphasis !== undefined) {
    for (const [slot, css] of Object.entries(EMPHASIS_SLOTS[emphasis])) look[slot as keyof WindowLook] = tokenValue(tokens, css);
  }
  if (grade !== undefined) {
    const graded = tokens[GRADE_TOKENS[grade]];
    for (const slot of GRADE_SLOTS) look[slot] = graded;
  }
  look['title-color'] = resolveCurrentColor(look['title-color'], tokens['--wzl-fg']);
  return look;
}
